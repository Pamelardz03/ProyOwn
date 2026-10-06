// Fotos de los Whimms: se elige una de la galería/cámara y se
// guarda en Firebase Storage, así no dependes de enlaces externos que luego se rompen.
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../../lib/storage'

const LADO_SALIDA = 720 // la foto se guarda en un cuadrado de 720 px (unos 100 KB en JPEG)

// Dibuja la foto como quedó en el cuadro de ajuste: `s` es la escala (px de pantalla por px de la
// foto), `x`,`y` su posición dentro del cuadro de `marco` px. Lo que la foto no cubre queda blanco.
export async function recortarFoto(archivo, { s, x, y, marco, anchoReal }) {
  if (!archivo?.type?.startsWith('image/')) throw new Error('No es una imagen')
  const bmp = await createImageBitmap(archivo)
  const k = LADO_SALIDA / marco
  const lienzo = document.createElement('canvas')
  lienzo.width = LADO_SALIDA
  lienzo.height = LADO_SALIDA
  const ctx = lienzo.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, LADO_SALIDA, LADO_SALIDA)
  ctx.imageSmoothingQuality = 'high'
  // `anchoReal` es el ancho que usó la pantalla; si el navegador decodifica distinto, se ajusta.
  const ajuste = anchoReal && bmp.width ? anchoReal / bmp.width : 1
  ctx.drawImage(bmp, x * k, y * k, bmp.width * ajuste * s * k, bmp.height * ajuste * s * k)
  bmp.close?.()
  return new Promise((resolve, reject) => lienzo.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('imagen'))), 'image/jpeg', 0.85))
}

// Sube la foto ya ajustada y devuelve su URL.
export async function subirBlobWhimm(uid, blob) {
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
