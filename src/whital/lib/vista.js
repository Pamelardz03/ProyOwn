// Datos derivados que necesitan las pantallas de Whital. Función PURA (sin
// React ni Firebase): recibe las colecciones ya leídas y regresa todo lo que
// pinta Inicio, siempre a partir del motor (budget.js). Se puede probar en
// Node sin abrir la app.
import {
  PRESUPUESTO_SEMANAL_DEFAULT,
  addDaysISO,
  analizarPresupuestoSemanal,
  computeBolsas,
  diasEntreISO,
  distribucionCajitas,
  gastoNeto,
  ocurrenciasPagoFijo,
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

// "hoy", "mañana", "en 15 días" (o "hace 2 días" si ya pasó).
export function enDias(fechaISO, hoyISO) {
  const n = diasEntreISO(hoyISO, fechaISO)
  if (n == null) return ''
  if (n === 0) return 'hoy'
  if (n === 1) return 'mañana'
  if (n < 0) return `hace ${-n} ${n === -1 ? 'día' : 'días'}`
  return `en ${n} días`
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
    cierresSemana: config?.cierresSemana || {},
    inicioISO: config?.inicioFecha || null, // día en que la persona empezó: la primera semana vale solo por lo que quedaba
    presupuestoSemanal: Number.isFinite(presupuesto) && presupuesto > 0 ? presupuesto : PRESUPUESTO_SEMANAL_DEFAULT,
    whimmsSimultaneos: Number(config?.whimmsSimultaneos) > 0 ? Math.round(Number(config.whimmsSimultaneos)) : 1,
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

  // Próxima compra = el Whimm con la fecha proyectada más cercana.
  const itemCola = (r) => ({ ...r, whimm: porId.get(r.id) })
  const conFecha = cola.filter((r) => r.fechaProyectada).sort((a, b) => a.fechaProyectada.localeCompare(b.fechaProyectada) || b.prioridad - a.prioridad)
  const proximaCompra = conFecha[0] ? { ...itemCola(conFecha[0]), dias: diasEntreISO(hoyISO, conFecha[0].fechaProyectada) } : null

  // Lo que pasa HOY: cobros, vencimientos y Whimms listos para comprar.
  const accionesHoy = [
    ...(base.sueldosFijos || []).flatMap((s) =>
      ocurrenciasSueldo(s, hoyISO, addDaysISO(hoyISO, -14))
        .filter((o) => (o.fecha === hoyISO && (!o.omitida || o.pendiente)) || (o.fecha < hoyISO && o.pendiente))
        .map((o) => ({ id: `sueldo-${s.id}-${o.fecha}`, sueldoId: s.id, fecha: o.fecha, pendiente: o.pendiente, titulo: s.name || s.nombre || 'Sueldo', sub: o.pendiente ? `Sueldo · esperando el depósito${o.fecha < hoyISO ? ` (${fechaCorta(o.fecha)})` : ''}` : 'Sueldo · ya está en tu saldo', monto: o.monto }))
    ),
    ...(base.pagosFijos || []).flatMap((p) =>
      ocurrenciasPagoFijo(p, hoyISO, hoyISO).filter((o) => !o.omitida).map((o) => ({ id: `pago-${p.id}`, titulo: p.name, sub: p.tipo === 'MSI' ? 'Pago a meses' : p.tipo === 'Vitall' ? 'Vitall' : 'Pago fijo', monto: -o.monto }))
    ),
    ...cola.filter((r) => r.estatus === 'comprable_hoy').map((r) => ({ id: `whimm-${r.id}`, titulo: porId.get(r.id)?.name || 'Whimm', sub: 'Listo para comprar', monto: -r.faltante })),
  ]

  // Sin ingresos que cubran el presupuesto, el dinero libre sale negativo: para las cajitas cuenta como 0.
  const cajitas = distribucionCajitas({ saldoReal, bolsaWhimms: Math.max(0, bolsas.bolsaWhimms), ...base })
  // "Para gastar hoy" = la guía de la caja de la semana (lo que queda entre los días que faltan), sin pasar
  // del dinero real sin comprometer hasta el próximo cobro (por si el cobro tarda y el dinero no alcanza).
  // `limitadoPor` dice cuál manda. Es lo que TE TOCABA hoy antes de gastar; de ahí se resta lo gastado.
  const caja = bolsas.caja
  const gastoHoy = caja.gastadoHoy
  const msi = cajitas.cajitaWhimms - Math.max(0, bolsas.bolsaWhimms)
  const topes = {
    semana: caja.guiaHoy,
    dinero: (saldoReal - cajitas.cajitaVitalls - msi + gastoHoy) / Math.max(cajitas.dias, 1),
  }
  const limitadoPor = topes.dinero < topes.semana ? 'dinero' : 'semana'

  return {
    saldoReal,
    asignadoHoy: topes[limitadoPor],
    caja,
    cierrePendiente: caja.cierrePendiente,
    gastoHoy,
    paraHoy: topes[limitadoPor] - gastoHoy,
    limitadoPor,
    proximaCompra,
    accionesHoy,
    colaDetallada: cola.map(itemCola),
    bolsas,
    presupuestoSemanal: base.presupuestoSemanal,
    dias,
    analisis,
    proximoWhimm,
    whimmsEnRiesgo: enRiesgo,
    whimmsIntercambiados: cola.filter((r) => r.intercambiado).map((r) => ({ ...r, whimm: porId.get(r.id) })),
    comprablesHoy: cola.filter((r) => r.estatus === 'comprable_hoy').length,
    vitalls: proximosVitalls({ pagosFijos: base.pagosFijos, hoyISO, dias: 7 }),
    cajitas,
  }
}

// Avisos dentro de la app (banners de Inicio). Cada aviso trae un `id` estable
// para poder descartarlo. (El recordatorio de registrar gastos es aparte: se
// configura en Ajustes, ver hooks/useRecordatorioRegistro.js.)
export function calcularAvisos(datos, hoyISO) {
  const avisos = []

  // Vitalls que vencen mañana o pasado (los de hoy ya salen en "Acciones de hoy"), con opción de omitir.
  proximosVitalls({ pagosFijos: datos.pagosFijos, hoyISO, dias: 2 })
    .filter((v) => !v.omitida && v.fecha > hoyISO)
    .forEach((v) => {
      avisos.push({
        id: `vitall-${v.pagoId}-${v.fecha}`,
        tipo: 'vitall',
        vitall: v,
        texto: `${v.fecha === addDaysISO(hoyISO, 1) ? 'Mañana' : `El ${diaSemanaCorto(v.fecha)} ${fechaCorta(v.fecha)}`} vence ${v.name}: ${fmt(v.monto)}.`,
      })
    })

  return avisos
}
