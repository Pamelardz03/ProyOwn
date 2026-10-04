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
  ocurrenciasSueldo,
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
  const centavos = Math.round(abs * 100) % 100 !== 0
  const texto = abs.toLocaleString('es-MX', { minimumFractionDigits: centavos ? 2 : 0, maximumFractionDigits: centavos ? 2 : 0 })
  return (num < 0 ? '-$' : '$') + texto
}

export function textoDias(n) {
  return `${n} ${n === 1 ? 'día' : 'días'}`
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

// Avisos dentro de la app (banners de Inicio). Cada aviso trae un `id` estable
// para poder descartarlo. `ahora` es un Date (se pasa para poder probarlo).
export function calcularAvisos(datos, hoyISO, bolsas, ahora = new Date()) {
  const avisos = []
  const diaSemana = (parseISODate(hoyISO).getDay() + 6) % 7 // 0 = lunes
  const semanaInicio = startOfWeekISO(hoyISO)

  // Cierre de semana: lunes y martes.
  const cierre = bolsas.cierreSemanaPasada
  if (diaSemana <= 1 && cierre.gastado > 0) {
    const sobro = cierre.resultado >= 0
    avisos.push({
      id: `cierre-${semanaInicio}`,
      tipo: 'cierre',
      texto: sobro
        ? `Cerró la semana: te sobraron ${fmt(cierre.resultado)} de ${fmt(cierre.presupuesto)}. Ese dinero adelanta tu fila de Whimms.`
        : `Cerró la semana: te pasaste ${fmt(-cierre.resultado)} de ${fmt(cierre.presupuesto)}. Eso retrasa un poco tu fila de Whimms.`,
    })
  }

  // Cobros de hoy y de mañana.
  const manana = addDaysISO(hoyISO, 1)
  ;(datos.sueldosFijos || []).forEach((s) => {
    ocurrenciasSueldo(s, manana, hoyISO)
      .filter((o) => !o.omitida)
      .forEach((o) => {
        avisos.push({
          id: `cobro-${s.id}-${o.fecha}`,
          tipo: 'cobro',
          texto: `${o.fecha === hoyISO ? 'Hoy' : 'Mañana'} te toca cobrar ${s.name || s.nombre || 'tu sueldo'}: ${fmt(o.monto)}.`,
        })
      })
  })

  // Vitalls que vencen hoy o en los próximos 2 días (con opción de omitir).
  proximosVitalls({ pagosFijos: datos.pagosFijos, hoyISO, dias: 2 })
    .filter((v) => !v.omitida)
    .forEach((v) => {
      avisos.push({
        id: `vitall-${v.pagoId}-${v.fecha}`,
        tipo: 'vitall',
        vitall: v,
        texto: `${v.fecha === hoyISO ? 'Hoy' : v.fecha === manana ? 'Mañana' : `El ${diaSemanaCorto(v.fecha)} ${fechaCorta(v.fecha)}`} vence ${v.name}: ${fmt(v.monto)}.`,
      })
    })

  // Recordatorio del día: después de las 8 pm sin gastos registrados hoy.
  const hayGastoHoy = (datos.gastos || []).some((g) => g.fecha === hoyISO)
  if (ahora.getHours() >= 20 && !hayGastoHoy) {
    avisos.push({ id: `registro-${hoyISO}`, tipo: 'registro', texto: 'Hoy no has registrado gastos. ¿Se te pasó alguno?' })
  }
  return avisos
}
