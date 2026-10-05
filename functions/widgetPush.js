// Aviso instantáneo al widget de Android: cuando registras, cambias o borras un gasto, el
// servidor le manda un mensaje de datos (sin notificación) a tus teléfonos con el widget y
// el widget se actualiza al momento. Los teléfonos se registran con el mismo código del widget.
import { createHash } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onRequest } from 'firebase-functions/v2/https'

const huella = (token) => createHash('sha256').update(token).digest('hex')

// El teléfono manda { t: código del widget, fcm: su identificador de avisos }.
export const registrarDispositivoWidget = onRequest({ region: 'us-central1', maxInstances: 3, cors: false }, async (req, res) => {
  if (req.method !== 'POST') return void res.status(405).json({ error: 'metodo' })
  const t = String(req.body?.t || '')
  const fcm = String(req.body?.fcm || '')
  if (!/^[0-9a-f]{48}$/.test(t) || fcm.length < 100 || fcm.length > 400) return void res.status(400).json({ error: 'datos' })
  const db = getFirestore()
  const dueno = await db.collection('widgetTokens').doc(huella(t)).get()
  if (!dueno.exists) return void res.status(404).json({ error: 'codigo' })
  await db.collection('users').doc(dueno.data().uid).collection('dispositivosWidget').doc(fcm.slice(0, 40)).set({ token: fcm, actualizadoEn: Date.now() })
  res.json({ ok: true })
})

// Cualquier cambio en tus gastos avisa a tus widgets.
export const avisarWidgetGastos = onDocumentWritten({ document: 'users/{uid}/gastos/{gastoId}', region: 'us-central1', maxInstances: 5 }, async (evento) => {
  const uid = evento.params.uid
  const coleccion = getFirestore().collection('users').doc(uid).collection('dispositivosWidget')
  const snap = await coleccion.get()
  if (snap.empty) return
  const dispositivos = snap.docs.map((d) => ({ token: d.data().token, ref: d.ref })).filter((d) => d.token)
  const res = await getMessaging().sendEachForMulticast({
    tokens: dispositivos.map((d) => d.token),
    data: { tipo: 'widget' },
    android: { priority: 'high', ttl: 600000 },
  })
  // Teléfonos que ya no existen: se borran para no seguir intentando.
  await Promise.all(res.responses.map((r, i) => (!r.success && /registration-token-not-registered|invalid-registration-token/.test(r.error?.code || '') ? dispositivos[i].ref.delete() : null)))
})
