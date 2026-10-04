// Datos derivados que necesitan las pantallas de Whital. Función PURA (sin
// React ni Firebase): recibe las colecciones ya leídas y regresa todo lo que
// pinta Inicio, siempre a partir del motor (budget.js). Se puede probar en
// Node sin abrir la app.
import {
  PRESUPUESTO_SEMANAL_DEFAULT,
  addDaysISO,
  analizarPresupuestoSemanal,
  computeBolsas,
  distribucionCajitas,
  gastoNeto,
  parseISODate,
  proximosVitalls,
  proyectarColaWhimms,
  saldoRealEnBanco,
  startOfWeekISO,
} from './budget'

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fmt(n) {
  const num = Number(n) || 0
  const abs = Math.abs(num)
  const texto = abs.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: abs < 1000 && abs % 1 !== 0 ? 2 : 0 })
  return (num < 0 ? '-$' : '$') + texto
}

export function fechaCorta(iso) {
  const d = parseISODate(iso)
  if (!d) return ''
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

export function diaSemanaCorto(iso) {
  const d = parseISODate(iso)
  if (!d) return ''
  return DIAS_CORTOS[(d.getDay() + 6) % 7]
}

export function parametrosMotor(datos, hoyISO) {
  const { gastos, sueldosFijos, sueldosRapidos, pagosFijos, whimms, ajustesSaldo, config } = datos
  const presupuesto = Number(config?.presupuestoSemanal)
  return {
    gastos,
    sueldosFijos,
    sueldosRapidos,
    pagosFijos,
    whimms,
    ajustesSaldo,
    saldoInicial: Number(config?.saldoInicial) || 0,
    presupuestoSemanal: Number.isFinite(presupuesto) && presupuesto > 0 ? presupuesto : PRESUPUESTO_SEMANAL_DEFAULT,
    hoyISO,
  }
}

export function calcularVistaInicio(datos, hoyISO) {
  const base = parametrosMotor(datos, hoyISO)
  const saldoReal = saldoRealEnBanco(base)
  const bolsas = computeBolsas(base)
  const cola = proyectarColaWhimms(base)
  const analisis = analizarPresupuestoSemanal({ gastos: base.gastos, presupuestoSemanal: base.presupuestoSemanal, hoyISO })

  // Semana Lun-Dom en curso, gasto neto por día (los gastos tipo Vitall son
  // solo historial visual y no cuentan, igual que en el motor).
  const inicioSemana = startOfWeekISO(hoyISO)
  const dias = DIAS_CORTOS.map((label, i) => {
    const fecha = addDaysISO(inicioSemana, i)
    const gastado = (base.gastos || [])
      .filter((g) => g?.categoria !== 'Vitall' && g?.fecha === fecha)
      .reduce((sum, g) => sum + gastoNeto(g), 0)
    return { fecha, label, gastado, esHoy: fecha === hoyISO, futuro: fecha > hoyISO }
  })

  // Próximo Whimm = top-1 por prioridad, con los datos de su documento.
  const porId = new Map((base.whimms || []).map((w) => [w.id, w]))
  const top = cola.reduce((mejor, r) => (!mejor || r.prioridad > mejor.prioridad ? r : mejor), null)
  const proximoWhimm = top ? { ...top, whimm: porId.get(top.id) } : null

  const enRiesgo = cola
    .filter((r) => r.fechaLimite && (r.estatus === 'tarde' || r.estatus === 'sin_fecha_segura'))
    .map((r) => ({ ...r, whimm: porId.get(r.id) }))

  return {
    saldoReal,
    bolsas,
    presupuestoSemanal: base.presupuestoSemanal,
    dias,
    analisis,
    proximoWhimm,
    whimmsEnRiesgo: enRiesgo,
    whimmsIntercambiados: cola.filter((r) => r.intercambiado).map((r) => ({ ...r, whimm: porId.get(r.id) })),
    comprablesHoy: cola.filter((r) => r.estatus === 'comprable_hoy').length,
    vitalls: proximosVitalls({ pagosFijos: base.pagosFijos, hoyISO, dias: 7 }),
    cajitas: distribucionCajitas({ saldoReal, bolsaWhimms: bolsas.bolsaWhimms, ...base }),
  }
}
