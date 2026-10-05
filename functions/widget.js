// Datos para el widget de Android. La app nativa no inicia sesión: usa un código
// personal (token) que se genera en Perfil > Widget. Solo se guarda su huella (hash)
// para buscar a la persona, y se puede renovar para dejar sin efecto el anterior.
import { createHash, randomBytes } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { cargarDatos } from './datos.js'
import { gastoNeto, todayISO } from './whital/budget.js'
import { aMillis } from './whital/recordatorio.js'
import { calcularVistaInicio } from './whital/vista.js'

const huella = (token) => createHash('sha256').update(token).digest('hex')

export const crearTokenWidget = onCall({ region: 'us-central1', maxInstances: 2 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.')
  const db = getFirestore()
  const uid = req.auth.uid
  const refConfig = db.collection('users').doc(uid).collection('config').doc('widget')
  const actual = (await refConfig.get()).data()?.token
  if (actual && !req.data?.renovar) return { token: actual }
  if (actual) await db.collection('widgetTokens').doc(huella(actual)).delete()
  const token = randomBytes(24).toString('hex')
  await db.collection('widgetTokens').doc(huella(token)).set({ uid, creado: Date.now() })
  await refConfig.set({ token, creado: Date.now() })
  return { token }
})

export const datosWidget = onRequest({ region: 'us-central1', maxInstances: 3, memory: '256MiB', cors: false }, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const token = String(req.query.t || '')
  if (!/^[0-9a-f]{48}$/.test(token)) return void res.status(404).json({ error: 'codigo' })
  const dueno = await getFirestore().collection('widgetTokens').doc(huella(token)).get()
  if (!dueno.exists) return void res.status(404).json({ error: 'codigo' })

  const datos = await cargarDatos(dueno.data().uid)
  const hoy = todayISO()
  const vista = calcularVistaInicio(datos, hoy)
  const proxima = vista.proximaCompra
  const tema = datos.config?.tema || {}

  // Gastos de hoy (los Vitalls no cuentan, igual que en la app) y el último que registraste.
  const deHoy = (datos.gastos || []).filter((g) => g?.categoria !== 'Vitall' && g?.fecha === hoy)
  const ultimo = deHoy.reduce((m, g) => (!m || aMillis(g.creadoEn) >= aMillis(m.creadoEn) ? g : m), null)
  const generico = (t) => !t || /^gasto$/i.test(String(t).trim())
  const temaUltimo = ultimo ? (!generico(ultimo.concepto) ? ultimo.concepto : ultimo.etiqueta || ultimo.concepto || 'Gasto') : null

  res.json({
    gastoHoy: Math.round(deHoy.reduce((s, g) => s + gastoNeto(g), 0)),
    gastoSemana: Math.round(vista.bolsas.gastadoSemanaActual),
    presupuestoSemana: Math.round(vista.bolsas.presupuestoSemanaActual),
    ultimoGasto: ultimo ? { tema: String(temaUltimo).slice(0, 40), monto: Math.round(gastoNeto(ultimo)) } : null,
    paraHoy: Math.round(vista.paraHoy),
    restanteSemana: Math.round(vista.bolsas.disponibleSemana),
    diasSemana: vista.bolsas.diasRestantesSemana,
    // Sin nombres: el widget solo dice si hay un Whimm disponible hoy o cuánto falta para el próximo.
    whimmsHoy: vista.comprablesHoy,
    proximoWhimmDias: proxima && proxima.dias > 0 ? proxima.dias : null,
    tema: { paleta: tema.paleta === 'bosque' ? 'salvia' : tema.paleta || 'vino', fondo: tema.fondo || 'beige' },
    hoy,
    generado: Date.now(),
  })
})
