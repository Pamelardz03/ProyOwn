// Avisos de la app (Whimms, Vitalls, sueldos, gastos y registro). Lógica PURA:
// a partir de los datos y de la proyección del motor dice QUÉ hay que avisar y
// CADA CUÁNTO. Quién lo muestra (banner, notificación del sistema) está en el hook.
//
// Cada tipo tiene una frecuencia GENERAL. Un Whimm, Vitall o sueldo puede tener la
// suya (`notifCadaMin`): 0 = no avisar, N = cada N minutos, vacío = usar la general.
// Lo que se pone en el producto manda sobre la general, para más o para menos.
import { ocurrenciasSueldo, proximosVitalls, addDaysISO } from './budget'
import { aMillis, textoTranscurrido } from './recordatorio'
import { enDias, fechaCorta, fmt } from './vista'

// Pocas opciones a propósito. Si algo ya guardado tiene otra frecuencia (de antes),
// `opcionesFrecuencia` la sigue mostrando para que no aparezca vacío.
export const FRECUENCIAS = [
  { min: 0, label: 'No avisar' },
  { min: 180, label: 'Cada 3 horas' },
  { min: 1440, label: 'Cada día' },
  { min: 4320, label: 'Cada 3 días' },
]
export function opcionesFrecuencia(actual) {
  const n = Number(actual)
  if (!n || FRECUENCIAS.some((f) => f.min === n)) return FRECUENCIAS
  return [...FRECUENCIAS, { min: n, label: n % 60 === 0 ? `Cada ${n / 60} h` : `Cada ${n} min` }]
}

// `item`: de qué producto cuelga el aviso (permite frecuencia propia).
export const TIPOS = [
  { clave: 'whimmComprable', grupo: 'Whimms', titulo: 'Ya puedes comprarlo', defecto: 1440, item: 'whimm' },
  { clave: 'whimmAvance', grupo: 'Whimms', titulo: 'Cuánto falta para comprarlo', defecto: 0, item: 'whimm' },
  { clave: 'whimmFecha', grupo: 'Whimms', titulo: 'Se movió la fecha de compra', defecto: 1440, item: 'whimm' },
  { clave: 'vitallPorVencer', grupo: 'Vitalls', titulo: 'Se cobra mañana o en 2 días', defecto: 1440, item: 'vitall' },
  { clave: 'sueldoProximo', grupo: 'Sueldos', titulo: 'Te depositan hoy o mañana', defecto: 1440, item: 'sueldo' },
  { clave: 'gastoPasaste', grupo: 'Gastos', titulo: 'Te pasaste del presupuesto', defecto: 1440 },
  { clave: 'gastoHoy', grupo: 'Gastos', titulo: 'Cuánto puedes gastar hoy', defecto: 1440 },
  { clave: 'gastoSobra', grupo: 'Gastos', titulo: 'Cuánto te sobra hasta el domingo', defecto: 0 },
  { clave: 'registro', grupo: 'Registro', titulo: 'Registrar tus gastos', defecto: 1440 },
]
// Valor del selector de un producto: vacío = general; si no, minutos (0 = no avisar).
export const aNotif = (v) => (v === '' ? null : Number(v))
export const deNotif = (n) => (n == null ? '' : String(n))

export const GRUPOS = ['Whimms', 'Vitalls', 'Sueldos', 'Gastos', 'Registro']

// Frecuencia (minutos) que aplica a un aviso: la del producto si la tiene, si no la
// general de su tipo, si no la de fábrica. 0 = no avisar.
export function cadenciaEfectiva({ tipo, item, general }) {
  const propia = item?.notifCadaMin
  if (propia === 0) return 0
  if (Number(propia) > 0) return Number(propia)
  const g = general?.[tipo]
  if (g === 0) return 0
  if (Number(g) > 0) return Number(g)
  return TIPOS.find((t) => t.clave === tipo)?.defecto || 0
}

const LIMITE_CAMBIO_FECHA_MS = 24 * 3600 * 1000

// Lista de avisos que existen AHORA (con su frecuencia ya resuelta; los de 0 se omiten).
//   vista: resultado de calcularVistaInicio    general: { tipo: minutos }
//   cambiosFecha: [{ id, de, a, ts }]  cambios de fecha proyectada ya detectados
//   inicioMs: cuándo se abrió la app (referencia del recordatorio si aún no hay gastos)
export function generarAlertas({ datos, vista, hoyISO, ahoraMs, inicioMs, general, cambiosFecha = [] }) {
  const alertas = []
  const agregar = (a) => { if (a.cadaMin > 0) alertas.push(a) }
  const manana = addDaysISO(hoyISO, 1)

  // --- Whimms ---
  const porId = new Map()
  vista.colaDetallada.forEach((r) => porId.set(r.id, r))
  vista.colaDetallada.forEach((r) => {
    const w = r.whimm
    if (!w) return
    const ir = { ruta: '/whimms', estado: { openWhimmId: w.id } }
    const apartado = Number(w.montoApartado) || 0
    const precio = Number(w.precio) || 0
    const llevado = apartado + (r.avanceHoy || 0)
    if (r.estatus === 'comprable_hoy' && !r.intercambiado) {
      agregar({ clave: `whimmComprable:${w.id}`, tipo: 'whimmComprable', texto: `Ya puedes comprar ${w.name} (${fmt(precio)})`, cadaMin: cadenciaEfectiva({ tipo: 'whimmComprable', item: w, general }), ir })
    } else if (llevado > 0 && llevado < precio) {
      agregar({ clave: `whimmAvance:${w.id}`, tipo: 'whimmAvance', texto: `A ${w.name} le faltan ${fmt(precio - llevado)} (${Math.round((llevado / precio) * 100)}%)${r.fechaProyectada ? ` · estimado ${fechaCorta(r.fechaProyectada)}, ${enDias(r.fechaProyectada, hoyISO)}` : ''}`, cadaMin: cadenciaEfectiva({ tipo: 'whimmAvance', item: w, general }), ir })
    }
  })
  cambiosFecha.forEach((c) => {
    const r = porId.get(c.id)
    if (!r || !r.whimm || r.fechaProyectada !== c.a || ahoraMs - c.ts > LIMITE_CAMBIO_FECHA_MS) return
    agregar({ clave: `whimmFecha:${c.id}:${c.a}`, tipo: 'whimmFecha', unico: true, texto: `La fecha de compra de ${r.whimm.name} cambió: ${fechaCorta(c.de)} → ${fechaCorta(c.a)}`, cadaMin: cadenciaEfectiva({ tipo: 'whimmFecha', item: r.whimm, general }), ir: { ruta: '/whimms', estado: { openWhimmId: c.id } } })
  })

  // --- Vitalls ---
  const pagos = new Map((datos.pagosFijos || []).map((p) => [p.id, p]))
  proximosVitalls({ pagosFijos: datos.pagosFijos, hoyISO, dias: 2 })
    .filter((v) => !v.omitida)
    .forEach((v) => {
      const p = pagos.get(v.pagoId)
      agregar({ clave: `vitallPorVencer:${v.pagoId}:${v.fecha}`, tipo: 'vitallPorVencer', texto: `${v.name} se cobra ${enDias(v.fecha, hoyISO)} (${fmt(v.monto)})`, cadaMin: cadenciaEfectiva({ tipo: 'vitallPorVencer', item: p, general }), ir: { ruta: '/vitalls', estado: { openPagoId: v.pagoId } } })
    })

  // --- Sueldos ---
  ;(datos.sueldosFijos || []).forEach((s) => {
    ocurrenciasSueldo(s, manana, hoyISO)
      .filter((o) => !o.omitida)
      .forEach((o) => {
        agregar({ clave: `sueldoProximo:${s.id}:${o.fecha}`, tipo: 'sueldoProximo', texto: `${o.fecha === hoyISO ? 'Hoy' : 'Mañana'} te depositan ${s.name || s.nombre || 'tu sueldo'}: ${fmt(o.monto)}`, cadaMin: cadenciaEfectiva({ tipo: 'sueldoProximo', item: s, general }), ir: { ruta: '/calendar', estado: null } })
      })
  })

  // --- Gastos de la semana ---
  const disponible = vista.bolsas.disponibleSemana
  const paraHoy = vista.bolsas.promedioDiarioRestante
  agregar({ clave: 'gastoHoy', tipo: 'gastoHoy', texto: paraHoy >= 0 ? `Para gastar hoy: ${fmt(paraHoy)}` : `Hoy ya no te queda para gastar (te pasaste ${fmt(-paraHoy)})`, cadaMin: cadenciaEfectiva({ tipo: 'gastoHoy', general }), ir: { ruta: '/gastos', estado: null } })
  if (disponible < 0) {
    agregar({ clave: `gastoPasaste:${vista.bolsas.semanaInicio}`, tipo: 'gastoPasaste', texto: `Te pasaste ${fmt(-disponible)} del presupuesto de la semana`, cadaMin: cadenciaEfectiva({ tipo: 'gastoPasaste', general }), ir: { ruta: '/gastos', estado: null } })
  } else if (disponible > 0) {
    agregar({ clave: `gastoSobra:${vista.bolsas.semanaInicio}`, tipo: 'gastoSobra', texto: `Te sobran ${fmt(disponible)} hasta el domingo`, cadaMin: cadenciaEfectiva({ tipo: 'gastoSobra', general }), ir: { ruta: '/gastos', estado: null } })
  }

  // --- Registrar gastos ---
  const cadaRegistro = cadenciaEfectiva({ tipo: 'registro', general })
  if (cadaRegistro > 0) {
    const ultimo = (datos.gastos || []).reduce((max, g) => Math.max(max, aMillis(g.creadoEn)), 0) || inicioMs
    if (ahoraMs - ultimo >= cadaRegistro * 60000) {
      agregar({ clave: 'registro', tipo: 'registro', texto: `Llevas ${textoTranscurrido(ahoraMs - ultimo)} sin registrar gastos. ¿Se te pasó alguno?`, cadaMin: cadaRegistro, ir: { ruta: '/gastos', estado: { nuevo: true } } })
    }
  }
  return alertas
}
