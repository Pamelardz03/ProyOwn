// Avisos push de Whital. Cada 30 min revisa a cada dispositivo registrado, calcula los
// avisos con el mismo motor que la app y manda por FCM los que ya les toca según su
// frecuencia. No manda de noche. Solo toca users/{uid}/dispositivos y estadoPush.
process.env.TZ = 'America/Monterrey'

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { cargarDatos } from './datos.js'
import { todayISO } from './whital/budget.js'
import { generarAlertas } from './whital/notificaciones.js'
import { calcularVistaInicio } from './whital/vista.js'

initializeApp({ storageBucket: 'admin-gastos-985f7.firebasestorage.app' })
const db = getFirestore()

const HORA_DESDE = 8 // no avisar antes de las 8:00
const HORA_HASTA = 22 // ni a partir de las 22:00
const MAX_POR_CORRIDA = 3
const TOLERANCIA_MS = 2 * 60000 // la corrida puede llegar unos segundos antes de tiempo
const urlDe = (a) => (a.ir?.ruta === '/gastos' && a.ir.estado?.nuevo ? './?ir=gastos&nuevo=1' : './')

async function avisarUsuario(uid, dispositivos, ahora) {
  const datos = await cargarDatos(uid)
  // Horario de avisos de la persona (por defecto 8:00 a 22:00; "todo" = sin límite).
  const hora = new Date(ahora).getHours()
  if (datos.config?.horarioAvisos !== 'todo' && (hora < HORA_DESDE || hora >= HORA_HASTA)) return 0
  const hoy = todayISO()
  const vista = calcularVistaInicio(datos, hoy)
  const general = { ...(datos.config?.recordatorioCadaMin != null ? { registro: datos.config.recordatorioCadaMin } : {}), ...(datos.config?.notificaciones || {}) }
  const alertas = generarAlertas({ datos, vista, hoyISO: hoy, ahoraMs: ahora, inicioMs: ahora, general })

  const refEstado = db.collection('users').doc(uid).collection('estadoPush').doc('ultimos')
  const previo = (await refEstado.get()).data()?.ultimos || {}
  const ultimos = { ...previo }
  const toca = []
  for (const a of alertas) {
    if (toca.length >= MAX_POR_CORRIDA) break
    const ultimo = previo[a.clave] || 0
    if ((a.unico && ultimo > 0) || ahora < ultimo + a.cadaMin * 60000 - TOLERANCIA_MS) continue
    toca.push(a)
    ultimos[a.clave] = ahora
  }
  for (const [clave, ts] of Object.entries(ultimos)) if (ahora - ts > 7 * 86400000) delete ultimos[clave]

  const tokens = dispositivos.map((d) => d.token)
  for (const a of toca) {
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      data: { title: 'Whital', body: a.texto, tag: a.clave, url: urlDe(a) },
      webpush: { headers: { Urgency: 'high', TTL: '3600' } },
    })
    // Tokens caducados o dados de baja: se borran para no seguir intentando.
    await Promise.all(res.responses.map((r, i) => (!r.success && /registration-token-not-registered|invalid-registration-token/.test(r.error?.code || '') ? dispositivos[i].ref.delete() : null)))
  }
  await refEstado.set({ ultimos, corrida: ahora })
  return toca.length
}

export const avisosWhital = onSchedule({ schedule: 'every 30 minutes', timeZone: 'America/Monterrey', region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async () => {
  const ahora = Date.now()

  const snap = await db.collectionGroup('dispositivos').get()
  const porUsuario = new Map()
  snap.docs.forEach((d) => {
    const token = d.data().token
    const uid = d.ref.parent.parent?.id
    if (!token || !uid) return
    if (!porUsuario.has(uid)) porUsuario.set(uid, [])
    porUsuario.get(uid).push({ token, ref: d.ref })
  })
  for (const [uid, dispositivos] of porUsuario) {
    try {
      const n = await avisarUsuario(uid, dispositivos, ahora)
      console.log(`Avisos enviados a ${uid}: ${n}`)
    } catch (e) {
      console.error(`Falló el aviso de ${uid}`, e)
    }
  }
})

export { crearTokenWidget, datosWidget } from './widget.js'

export { avisarWidgetGastos, registrarDispositivoWidget } from './widgetPush.js'

export { borrarMisDatos, respaldoSemanal } from './cuenta.js'
