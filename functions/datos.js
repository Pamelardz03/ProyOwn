// Lectura de los datos de una persona (los mismos que usa la app) para calcular avisos
// y el widget con el motor de Whital.
import { getFirestore } from 'firebase-admin/firestore'

const COLECCIONES = ['gastos', 'sueldosFijos', 'sueldosRapidos', 'pagosFijos', 'whimms', 'ajustesSaldo']

const lista = async (uid, nombre) => {
  const snap = await getFirestore().collection('users').doc(uid).collection(nombre).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function cargarDatos(uid) {
  const [listas, config] = await Promise.all([
    Promise.all(COLECCIONES.map((n) => lista(uid, n))),
    getFirestore().collection('users').doc(uid).collection('config').doc('presupuesto').get(),
  ])
  const datos = Object.fromEntries(COLECCIONES.map((n, i) => [n, listas[i]]))
  datos.config = config.exists ? config.data() : null
  return datos
}
