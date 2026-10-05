// Fotos de los Whimms: se elige una de la galería/cámara y se
// guarda en Firebase Storage, así no dependes de enlaces externos que luego se rompen.
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../../lib/storage'

const LADO_MAX = 900

// Reduce la foto a 900 px de lado máximo en JPEG (unos 100 KB): sube rápido y gasta poco.
async function reducir(archivo) {
  const bmp = await createImageBitmap(archivo)
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(bmp.width * escala)
  lienzo.height = Math.round(bmp.height * escala)
  const ctx = lienzo.getContext('2d')
  ctx.fillStyle = '#fff' // PNG con fondo transparente: se rellena de blanco
  ctx.fillRect(0, 0, lienzo.width, lienzo.height)
  ctx.drawImage(bmp, 0, 0, lienzo.width, lienzo.height)
  bmp.close?.()
  return new Promise((resolve, reject) => lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('imagen'))), 'image/jpeg', 0.82))
}

// Devuelve la URL pública de la foto subida.
export async function subirFotoWhimm(uid, archivo) {
  if (!archivo?.type?.startsWith('image/')) throw new Error('No es una imagen')
  const blob = await reducir(archivo)
  const destino = ref(storage, `users/${uid}/whimms/${Date.now()}.jpg`)
  await uploadBytes(destino, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(destino)
}

// Borra del almacenamiento una foto que subiste tú (las de enlaces externos no se tocan).
// Si ya no existe o falla, no pasa nada: la foto solo deja de usarse.
export async function borrarFotoPropia(url, uid) {
  if (!url || !url.includes('firebasestorage.googleapis.com') || !decodeURIComponent(url).includes(`/users/${uid}/`)) return
  try {
    await deleteObject(ref(storage, url))
  } catch {
    /* ya no está o no hay permiso: se ignora */
  }
}
