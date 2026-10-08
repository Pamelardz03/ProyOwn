// Push real (FCM): pide permiso, saca el token de ESTE dispositivo y lo guarda en
// users/{uid}/dispositivos para que la función programada le mande los avisos aunque
// la app esté cerrada. La clave VAPID es pública (no es un secreto).
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app } from '../../lib/firebase'
import { setUserDoc } from '../../lib/firestoreCollections'

const VAPID_KEY = 'BIykhENRPUQXJwrJtLwSxbx3M2Ds9wTgt6XkkBVqC9ZxlA86B8d0LFEl3VCtgw1eBvlk9k_GT55NNjOUUL4s3Hg'

const pushSoportado = () => isSupported().catch(() => false)

// Devuelve 'activado' | 'denegado' | 'no-soportado'. Seguro de llamar varias veces
// (renueva el token si cambió).
export async function activarPush(uid, { pedirPermiso = true } = {}) {
  if (!app || !(await pushSoportado())) return 'no-soportado'
  if (Notification.permission === 'default' && pedirPermiso) await Notification.requestPermission()
  if (Notification.permission !== 'granted') return 'denegado'
  const registro = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro })
  if (!token) return 'denegado'
  await setUserDoc(uid, 'dispositivos', token.slice(0, 40), { token, plataforma: navigator.userAgent.slice(0, 120), actualizadoEn: Date.now() })
  return 'activado'
}
