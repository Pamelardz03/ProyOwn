// Datos para el widget de Android. La app nativa no inicia sesión: usa un código
// personal (token) que se genera en Perfil > Widget. Solo se guarda su huella (hash)
// para buscar a la persona, y se puede renovar para dejar sin efecto el anterior.
import { createHash, randomBytes } from 'node:crypto'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
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
    // Compatibilidad con el widget ya instalado: esa franja ahora dice "lo que queda de lo que hay".
    gastoSemana: Math.round(vista.bolsas.disponibleSemana),
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

// Registro rápido desde el reloj: solo el monto, para no olvidarlo. El gasto queda con la etiqueta
// "Rápido" y `rapido: true` para revisarlo después contra el movimiento de Nu. Usa el mismo código
// del widget. El `id` lo genera el reloj, así que un reintento no duplica el gasto.
export const registrarGastoRapido = onRequest({ region: 'us-central1', maxInstances: 3, memory: '256MiB', cors: false }, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'POST') return void res.status(405).json({ error: 'metodo' })
  const { t, monto, id } = req.body || {}
  const token = String(t || '')
  if (!/^[0-9a-f]{48}$/.test(token)) return void res.status(404).json({ error: 'codigo' })
  const importe = Math.round(Number(monto) * 100) / 100
  if (!Number.isFinite(importe) || importe <= 0 || importe > 100000) return void res.status(400).json({ error: 'monto' })
  const clave = String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
  if (!clave) return void res.status(400).json({ error: 'id' })

  const db = getFirestore()
  const dueno = await db.collection('widgetTokens').doc(huella(token)).get()
  if (!dueno.exists) return void res.status(404).json({ error: 'codigo' })

  const ref = db.collection('users').doc(dueno.data().uid).collection('gastos').doc(`rapido-${clave}`)
  if (!(await ref.get()).exists) {
    await ref.set({
      concepto: 'Gasto',
      monto: importe,
      lugar: '',
      etiqueta: 'Rápido',
      fecha: todayISO(),
      reembolso: 0,
      categoria: 'General',
      rapido: true,
      origen: 'reloj',
      creadoEn: FieldValue.serverTimestamp(),
    })
  }
  res.json({ ok: true })
})
