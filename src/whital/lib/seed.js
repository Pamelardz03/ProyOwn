// Carga de datos de prueba para la cuenta de prueba (UDEM). Los datos viven en
// src/whital/seed/datos.local.js, que NO se sube a git (repo público); si ese
// archivo no existe (producción, CI) todo esto simplemente no aparece.
// Escribe usando las mismas funciones que los formularios de la app, con la
// sesión de quien pulsa el botón.
import { addUserDoc, deleteUserDoc, setUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import { generarFechasPago } from './budget'

const modulos = import.meta.glob('../seed/*.local.js')

export function hayDatosDePrueba() {
  return Object.keys(modulos).length > 0
}

export async function leerDatosDePrueba() {
  const cargar = Object.values(modulos)[0]
  return cargar ? (await cargar()).default : null
}

export const COLECCIONES = ['gastos', 'sueldosFijos', 'sueldosRapidos', 'pagosFijos', 'whimms', 'ajustesSaldo']

// Borra todos los documentos de las colecciones de Whital. `datos` = lo que la
// app ya leyó ({ gastos: [...], ... }, cada doc con su `id`).
export async function borrarDatos(uid, datos) {
  let borrados = 0
  for (const coleccion of COLECCIONES) {
    for (const d of datos[coleccion] || []) {
      await deleteUserDoc(uid, coleccion, d.id)
      borrados++
    }
  }
  return borrados
}

export async function sembrarDatos(uid, seed) {
  let escritos = 0
  const add = async (coleccion, data) => {
    escritos++
    return addUserDoc(uid, coleccion, data)
  }

  await setUserDoc(uid, 'config', 'presupuesto', seed.config)

  for (const s of seed.sueldosFijos || []) {
    await add('sueldosFijos', {
      ...s,
      fechasPago: generarFechasPago({ frecuencia: s.frecuencia, fechaInicio: s.fechaInicio }),
      excepciones: s.excepciones || {},
      notifFormal: false,
      notifMini: false,
    })
  }
  for (const r of seed.sueldosRapidos || []) await add('sueldosRapidos', r)

  // Whimms primero (los pagos MSI se ligan a su Whimm por id).
  const idsWhimm = new Map()
  for (const w of seed.whimms || []) {
    const ref = await add('whimms', { montoApartado: 0, notifFormal: false, notifMini: false, ...w })
    idsWhimm.set(w.name, ref.id)
  }

  for (const { msiDe, ...p } of seed.pagosFijos || []) {
    const whimmId = msiDe ? idsWhimm.get(msiDe) : undefined
    const ref = await add('pagosFijos', { activo: true, excepciones: {}, notifFormal: false, notifMini: false, ...p, ...(whimmId ? { whimmId } : {}) })
    if (whimmId) await updateUserDoc(uid, 'whimms', whimmId, { pagoFijoMsiId: ref.id })
  }

  for (const g of seed.gastos || []) await add('gastos', { categoria: 'General', reembolso: 0, ...g })
  for (const a of seed.ajustesSaldo || []) await add('ajustesSaldo', a)
  return escritos
}

// Pone la imagen a los Whimms que no la tienen (por nombre), sin borrar nada.
export async function completarImagenes(uid, whimmsActuales, seed) {
  const porNombre = new Map((seed.whimms || []).filter((w) => w.imagenUrl).map((w) => [w.name, w.imagenUrl]))
  let n = 0
  for (const w of whimmsActuales || []) {
    const url = porNombre.get(w.name)
    if (url && !w.imagenUrl) {
      await updateUserDoc(uid, 'whimms', w.id, { imagenUrl: url })
      n++
    }
  }
  return n
}
