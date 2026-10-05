// Tus datos: descargarlos y eliminar la cuenta completa.
import { collection, getDocs } from 'firebase/firestore'
import { deleteUser, reauthenticateWithPopup } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth, db, googleProvider } from '../../lib/firebase'

const COLECCIONES = ['gastos', 'sueldosFijos', 'sueldosRapidos', 'pagosFijos', 'whimms', 'ajustesSaldo', 'config']

// Junta todo lo tuyo y lo entrega como archivo .json (sin el código del widget, que es un secreto).
export async function exportarMisDatos(uid) {
  const datos = {}
  for (const nombre of COLECCIONES) {
    const snap = await getDocs(collection(db, 'users', uid, nombre))
    datos[nombre] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }
  datos.config = datos.config.filter((d) => d.id !== 'widget')
  const cuerpo = JSON.stringify({ app: 'Whital', exportado: new Date().toISOString(), datos }, (_, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v), 2)
  const url = URL.createObjectURL(new Blob([cuerpo], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `whital-mis-datos-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return Object.fromEntries(COLECCIONES.map((c) => [c, datos[c].length]))
}

// Elimina TODO: pide confirmar tu identidad con Google, borra tus datos y archivos en el
// servidor, y al final borra tu usuario. No se puede deshacer.
export async function eliminarMiCuenta() {
  const usuario = auth.currentUser
  if (!usuario) throw new Error('Sin sesión')
  await reauthenticateWithPopup(usuario, googleProvider) // evita que alguien con tu teléfono desbloqueado la borre sin saber tu cuenta
  await httpsCallable(getFunctions(app, 'us-central1'), 'borrarMisDatos')({ confirmar: 'ELIMINAR' })
  await deleteUser(usuario)
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('whital')).forEach((k) => localStorage.removeItem(k))
  } catch {
    /* sin almacenamiento */
  }
}
