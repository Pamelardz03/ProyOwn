// Foto de un enlace de producto: abre la página, busca la imagen principal (og:image,
// twitter:image o JSON-LD), la descarga y la guarda en el Storage de la persona.
// Seguridad: solo https, nada de direcciones internas (ni tras redirecciones), con
// límites de tiempo y de tamaño. Solo para personas con sesión iniciada.
import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

const TIEMPO_MS = 8000
const MAX_HTML = 1.5 * 1024 * 1024
const MAX_IMAGEN = 5 * 1024 * 1024
const MAX_REDIRECCIONES = 3
const NAVEGADOR = 'Mozilla/5.0 (Linux; Android 14; Pixel 9a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

function esPrivada(ip) {
  if (ip.includes(':')) return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80') || ip.startsWith('::ffff:')
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
}

async function validar(texto) {
  let url
  try {
    url = new URL(texto)
  } catch {
    throw new HttpsError('invalid-argument', 'El enlace no es válido.')
  }
  if (url.protocol !== 'https:') throw new HttpsError('invalid-argument', 'Solo se aceptan enlaces https.')
  const host = url.hostname
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new HttpsError('invalid-argument', 'Enlace no permitido.')
  const direcciones = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!direcciones.length || direcciones.some((d) => esPrivada(d.address))) throw new HttpsError('invalid-argument', 'Enlace no permitido.')
  return url
}

// GET con redirecciones manuales (cada salto se vuelve a validar) y tope de bytes.
async function descargar(texto, maxBytes, aceptar) {
  let actual = texto
  for (let i = 0; i <= MAX_REDIRECCIONES; i++) {
    const url = await validar(actual)
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIEMPO_MS), headers: { 'user-agent': NAVEGADOR, accept: aceptar, 'accept-language': 'es-MX,es;q=0.9' } })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      actual = new URL(res.headers.get('location'), url).href
      continue
    }
    if (!res.ok) throw new HttpsError('not-found', `La tienda respondió ${res.status}.`)
    const tipo = res.headers.get('content-type') || ''
    const partes = []
    let total = 0
    for await (const trozo of res.body) {
      total += trozo.length
      if (total > maxBytes) break
      partes.push(trozo)
    }
    return { buffer: Buffer.concat(partes), tipo }
  }
  throw new HttpsError('aborted', 'Demasiadas redirecciones.')
}

function metaContenido(html, nombre) {
  const reg = new RegExp(`<meta[^>]+(?:property|name)=["']${nombre}["'][^>]*>`, 'i')
  const etiqueta = html.match(reg)?.[0]
  return etiqueta?.match(/content=["']([^"']+)["']/i)?.[1] || null
}

function imagenJsonLd(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const pila = [JSON.parse(m[1])]
      while (pila.length) {
        const nodo = pila.pop()
        if (Array.isArray(nodo)) pila.push(...nodo)
        else if (nodo && typeof nodo === 'object') {
          const img = Array.isArray(nodo.image) ? nodo.image[0] : nodo.image
          const url = typeof img === 'string' ? img : img?.url
          if (url) return url
          pila.push(...Object.values(nodo).filter((v) => v && typeof v === 'object'))
        }
      }
    } catch {
      /* JSON-LD mal formado: se ignora */
    }
  }
  return null
}

const desescapar = (t) => t.replace(/&amp;/g, '&')

export const imagenDeEnlace = onCall({ region: 'us-central1', maxInstances: 3, timeoutSeconds: 40, memory: '256MiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.')
  const enlace = String(req.data?.enlace || '').trim()
  if (!enlace) throw new HttpsError('invalid-argument', 'Falta el enlace.')

  const pagina = await descargar(enlace, MAX_HTML, 'text/html,application/xhtml+xml')
  const html = pagina.buffer.toString('utf8')
  const candidata = metaContenido(html, 'og:image') || metaContenido(html, 'twitter:image') || imagenJsonLd(html)
  if (!candidata) throw new HttpsError('not-found', 'No encontré una foto en esa página.')

  const imagen = await descargar(new URL(desescapar(candidata), enlace).href, MAX_IMAGEN, 'image/*')
  if (!imagen.tipo.startsWith('image/') || imagen.buffer.length < 1000) throw new HttpsError('not-found', 'La foto de esa página no se pudo descargar.')

  const bucket = getStorage().bucket()
  const ruta = `users/${req.auth.uid}/whimms/${Date.now()}.jpg`
  const token = randomUUID()
  await bucket.file(ruta).save(imagen.buffer, { contentType: imagen.tipo.split(';')[0], metadata: { metadata: { firebaseStorageDownloadTokens: token } } })
  return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}` }
})
