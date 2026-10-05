// Datos de cada persona: borrar todo lo suyo y respaldo semanal. Solo toca lo que ya tiene
// permiso (Firestore y Storage). El usuario de inicio de sesión lo borra la propia app
// (con la persona presente), porque el servidor no tiene permiso para administrar usuarios.
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'

const COLECCIONES = ['gastos', 'sueldosFijos', 'sueldosRapidos', 'pagosFijos', 'whimms', 'ajustesSaldo', 'config']
const RESPALDOS_A_CONSERVAR = 8

// Borra TODO lo de una persona: su documento y subcolecciones, el código del widget y sus archivos.
export async function borrarDatosDeUsuario(db, bucket, uid) {
  if (!uid || typeof uid !== 'string' || uid.includes('/')) throw new Error('uid inválido')
  await db.recursiveDelete(db.collection('users').doc(uid))
  const codigos = await db.collection('widgetTokens').where('uid', '==', uid).get()
  await Promise.all(codigos.docs.map((d) => d.ref.delete()))
  await bucket.deleteFiles({ prefix: `users/${uid}/`, force: true })
}

// Guarda una copia de los datos de una persona en su carpeta de Storage y conserva solo las últimas.
export async function respaldarUsuario(db, bucket, uid, ahora = new Date()) {
  const datos = {}
  let total = 0
  for (const c of COLECCIONES) {
    const snap = await db.collection('users').doc(uid).collection(c).get()
    datos[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    total += datos[c].length
  }
  if (total === 0) return null
  // El código del widget es un secreto: no va en el respaldo.
  datos.config = datos.config.filter((d) => d.id !== 'widget')
  const fecha = ahora.toISOString().slice(0, 10)
  await bucket.file(`users/${uid}/respaldos/${fecha}.json`).save(JSON.stringify({ version: 1, generado: ahora.toISOString(), datos }), { contentType: 'application/json' })
  const [archivos] = await bucket.getFiles({ prefix: `users/${uid}/respaldos/` })
  const nombres = archivos.map((f) => f.name).sort()
  await Promise.all(nombres.slice(0, Math.max(0, nombres.length - RESPALDOS_A_CONSERVAR)).map((n) => bucket.file(n).delete()))
  return Object.fromEntries(COLECCIONES.map((c) => [c, datos[c].length]))
}

// La app llama a esto después de pedir la confirmación escrita ("ELIMINAR").
export const borrarMisDatos = onCall({ region: 'us-central1', maxInstances: 2, timeoutSeconds: 120 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.')
  if (req.data?.confirmar !== 'ELIMINAR') throw new HttpsError('failed-precondition', 'Falta la confirmación.')
  await borrarDatosDeUsuario(getFirestore(), getStorage().bucket(), req.auth.uid)
  return { ok: true }
})

// Cada domingo de madrugada se respalda a todas las personas con datos.
export const respaldoSemanal = onSchedule({ schedule: 'every sunday 03:00', timeZone: 'America/Monterrey', region: 'us-central1', timeoutSeconds: 300, memory: '256MiB' }, async () => {
  const db = getFirestore()
  const bucket = getStorage().bucket()
  const personas = await db.collection('users').listDocuments()
  for (const ref of personas) {
    try {
      const r = await respaldarUsuario(db, bucket, ref.id)
      console.log(`Respaldo de ${ref.id}:`, r ? JSON.stringify(r) : 'sin datos')
    } catch (e) {
      console.error(`Falló el respaldo de ${ref.id}`, e)
    }
  }
})
