// ============================================================================
// WHITAL — motor de presupuesto nuevo, reescrito desde cero (sección 4 del doc
// WHITAL — Estado Actual del Sistema y Reglas de Arquitectura, 2 oct).
//
// Filosofía (sección A del doc): RECÁLCULO PURO EN VIVO. A diferencia del
// motor real de producción (src/lib/budget.js, 3 bolsillos persistidos en
// Firestore que se liquidan día por día), este motor NUNCA persiste un saldo
// derivado. Cada vez que se necesita el estado (Inicio, Gastos, Whimms...) se
// recalcula desde cero a partir de la línea de tiempo completa de eventos
// reales (sueldos, gastos, vencimientos, compras). Esto es deliberadamente
// más simple y más parecido al motor original pre-"tanda 32" — decisión
// explícita de Pame tras conocer el motor real (ver
// organizador-gastos-reglas-actuales.md sección 10, punto 4, en el doc del
// proyecto de Claude).
//
// Este archivo se validó con 11 pruebas en un script de Node aislado ANTES
// de tocar nada de la UI real, a pedido explícito de Pame ("Validar con
// scripts de Node aislados antes de UI"). Nunca se persiste ni se asienta
// día por día — cada llamada recalcula todo desde los arrays de Firestore.
// ============================================================================

// ---------------------------------------------------------------------------
// Helpers de fecha (mismos que src/lib/date.js del motor real — duplicados
// aquí a propósito para que src/whital/ sea un árbol aislado del motor
// viejo y no haya riesgo de romper producción si algo de date.js cambia).
// ---------------------------------------------------------------------------
export function parseISODate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toISO(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO() {
  return toISO(new Date())
}

export function addDaysISO(iso, days) {
  const date = parseISODate(iso)
  if (!date) return iso
  date.setDate(date.getDate() + days)
  return toISO(date)
}

export function diasEntreISO(desdeISO, hastaISO) {
  const a = parseISODate(desdeISO)
  const b = parseISODate(hastaISO)
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}

export function compareISOAsc(a, b) {
  return (a || '').localeCompare(b || '')
}

function startOfDay(d) {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

// Lunes de la semana que contiene `iso` (semana Lunes-Domingo, confirmado
// semanaInicioDay=1 en config/presupuesto por el doc Whital sección 3).
export function startOfWeekISO(iso) {
  const date = parseISODate(iso)
  if (!date) return iso
  const c = startOfDay(date)
  const dow = c.getDay() // 0=domingo
  const diff = dow === 0 ? -6 : 1 - dow
  c.setDate(c.getDate() + diff)
  return toISO(c)
}

export function endOfWeekISO(iso) {
  return addDaysISO(startOfWeekISO(iso), 6)
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

// ---------------------------------------------------------------------------
// Score (sección D) — SIN CAMBIOS respecto a src/lib/score.js. Necesidad y
// deseo ahora 1-10 desde el inicio (antes 1-5 en producción), pero la
// fórmula no asume ningún rango, así que no cambia nada aquí.
// ---------------------------------------------------------------------------
export function computeWhimmScore({ necesidad, deseo, precio }) {
  const n = Number(necesidad) || 5
  const d = Number(deseo) || 5
  const p = Math.max(Number(precio) || 1, 1)
  return (n * 2 + d) / Math.pow(p, 0.25)
}

// ---------------------------------------------------------------------------
// Gastos (sección 3 / A)
// ---------------------------------------------------------------------------
export function gastoNeto(g) {
  return Math.max((Number(g?.monto) || 0) - (Number(g?.reembolso) || 0), 0)
}

// ---------------------------------------------------------------------------
// Excepciones — AHORA con la misma forma en sueldosFijos Y pagosFijos
// (sección 3 del doc Whital: `excepciones: { fechaISO: { omitida, montoReal } }`
// en AMBAS colecciones — antes (motor real) solo pagosFijos tenía excepciones,
// y usaban la llave `monto` en vez de `montoReal`). Para no perder las
// excepciones ya copiadas desde la cuenta real al poblar la cuenta de
// prueba UDEM, se lee `montoReal` con fallback a `monto` (nombre viejo);
// cualquier excepción NUEVA que la UI de Whital escriba usa siempre
// `montoReal`.
// ---------------------------------------------------------------------------
function excepcionDe(entidad, fechaISO) {
  return entidad?.excepciones?.[fechaISO] || null
}

function montoRealDeExcepcion(exc, montoBase) {
  if (!exc) return montoBase
  if (exc.montoReal != null) return Number(exc.montoReal) || 0
  if (exc.monto != null) return Number(exc.monto) || 0 // compat con datos viejos copiados
  return montoBase
}

// ---------------------------------------------------------------------------
// Sueldos fijos — genera ocurrencias vivas hasta una fecha, respetando
// `omitida`/`montoReal` por excepción puntual (sección E.1 del doc Whital —
// NUEVO: antes esto solo existía para pagosFijos).
// ---------------------------------------------------------------------------
export function fechasPagoVivas(sueldo, hastaISO) {
  const fechas = Array.isArray(sueldo?.fechasPago) ? [...sueldo.fechasPago] : []
  const fechaFin = sueldo?.fechaFin || null
  return fechas
    .filter((f) => f && f <= hastaISO && (!fechaFin || f <= fechaFin))
    .filter((f) => !excepcionDe(sueldo, f)?.omitida)
    .sort(compareISOAsc)
}

export function montoOcurrenciaSueldo(sueldo, fechaISO) {
  const exc = excepcionDe(sueldo, fechaISO)
  return montoRealDeExcepcion(exc, Number(sueldo?.monto) || 0)
}

// ---------------------------------------------------------------------------
// Pagos fijos (Vitalls + MSI) — ocurrencias vivas respetando excepciones.
// Separadas en dos vistas: Vitall-like (todo lo que NO es MSI — entra a la
// "Reserva Vitalls" del doc, sección B.1) y MSI (se paga directo de la Bolsa
// Whimms, sección D / "MSI" en Entidades — NUNCA de Gastos ni de la reserva
// Vitalls).
// ---------------------------------------------------------------------------
function fechasVencimientoVivas(pagoFijo, hastaISO) {
  if (pagoFijo?.activo === false) return []
  const freq = pagoFijo?.frecuencia
  const base = pagoFijo?.fecha
  if (!base) return []
  const fechas = []
  let f = base
  let guard = 0
  const numPagos = pagoFijo?.finito ? Number(pagoFijo.numPagos) || 1 : Infinity
  let count = 0
  while (f <= hastaISO && count < numPagos && guard < 5000) {
    fechas.push(f)
    count++
    guard++
    if (freq === 'Semanal') f = addDaysISO(f, 7)
    else if (freq === 'Quincenal') f = addDaysISO(f, 15)
    else f = addMonthsISO(f, 1) // Mensual (default)
  }
  return fechas.filter((fx) => !excepcionDe(pagoFijo, fx)?.omitida)
}

function addMonthsISO(iso, n) {
  const date = parseISODate(iso)
  if (!date) return iso
  const dia = date.getDate()
  let y = date.getFullYear()
  let m = date.getMonth() + n
  while (m > 11) { m -= 12; y += 1 }
  while (m < 0) { m += 12; y -= 1 }
  return toISO(new Date(y, m, Math.min(dia, daysInMonth(y, m))))
}

export function montoOcurrenciaPagoFijo(pagoFijo, fechaISO) {
  const exc = excepcionDe(pagoFijo, fechaISO)
  return montoRealDeExcepcion(exc, Number(pagoFijo?.monto) || 0)
}

// ---------------------------------------------------------------------------
// MODELO DE CAJA (decisión 4 oct, escenario A): presupuesto semanal FIJO.
//
// Ya no se reparte cada sueldo en un % para Whimms y otro para Gastos. En su
// lugar:
//   - Gastos Semanales = un monto fijo por semana Lun-Dom (`presupuestoSemanal`).
//   - Todo lo demás es dinero libre para Whimms, SIEMPRE que el saldo diario
//     proyectado nunca baje de $0 (RN-03): se simula día por día con sueldos,
//     Vitalls, mensualidades MSI y el gasto semanal esperado.
// Esto hace que los meses se comporten solos "por quincena": al inicio del mes
// caen casi todos los pagos y el dinero libre baja; después de cobrar sube.
// ---------------------------------------------------------------------------
export const PRESUPUESTO_SEMANAL_DEFAULT = 840 // $120 al día; la usuaria aún no define el definitivo
const HORIZONTE_PROYECCION_DIAS = 540 // ~18 meses
const EPS = 0.005

function presupuestoDe(valor) {
  const n = Number(valor)
  return Number.isFinite(n) && n >= 0 ? n : PRESUPUESTO_SEMANAL_DEFAULT
}

function esWhimmPendiente(w) {
  return w?.estado === 'espera' || w?.estado === 'apartando'
}

// Gasto neto real de una semana (Lun-Dom) hasta `hastaISO` inclusive. Un Gasto
// tipo Vitall es solo historial visual y no cuenta (sección 3 del doc Whital).
function gastoSemanaReal(gastos, semanaInicioISO, hastaISO) {
  const semanaFinExclusivo = addDaysISO(semanaInicioISO, 7)
  const limite = hastaISO < semanaFinExclusivo ? addDaysISO(hastaISO, 1) : semanaFinExclusivo
  return (gastos || [])
    .filter((g) => g?.categoria !== 'Vitall')
    .filter((g) => g?.fecha && g.fecha >= semanaInicioISO && g.fecha < limite)
    .reduce((sum, g) => sum + gastoNeto(g), 0)
}

// ---------------------------------------------------------------------------
// SECCIÓN A — Saldo Real en Banco (recálculo puro, igual que la fórmula del
// doc Whital).
// ---------------------------------------------------------------------------
export function saldoRealEnBanco({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, hoyISO }) {
  let saldo = Number(saldoInicial) || 0

  ;(sueldosFijos || []).forEach((s) => {
    fechasPagoVivas(s, hoyISO).forEach((f) => { saldo += montoOcurrenciaSueldo(s, f) })
  })
  ;(sueldosRapidos || []).forEach((r) => {
    if (r?.fecha && r.fecha <= hoyISO) saldo += Number(r.monto) || 0
  })
  ;(gastos || []).forEach((g) => {
    // Un Gasto tipo 'Vitall' es solo un registro visual de "ya pagué esto" —
    // no resta del saldo real, porque el vencimiento del pagoFijo ya lo
    // resta más abajo (sección 3 del doc Whital / convención ya existente).
    if (g?.categoria === 'Vitall') return
    if (g?.fecha && g.fecha <= hoyISO) saldo -= gastoNeto(g)
  })
  ;(pagosFijos || []).forEach((p) => {
    fechasVencimientoVivas(p, hoyISO).forEach((f) => { saldo -= montoOcurrenciaPagoFijo(p, f) })
  })
  ;(whimms || []).forEach((w) => {
    if (w?.estado === 'comprado' && w.compradoEn && w.compradoEn <= hoyISO) {
      const precioFinal = Number(w.precioComprado ?? w.precio) || 0
      const yaApartado = Number(w.montoApartado) || 0
      saldo -= Math.max(precioFinal - yaApartado, 0)
    }
  })

  return saldo
}

// Línea de caja: saldo proyectado de cada día desde hoy (índice 0) hasta el
// horizonte, SIN contar compras de Whimms futuras. Hoy solo suma el gasto
// esperado de hoy (los demás eventos de hoy ya están en el saldo real).
function lineaDeCaja({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, presupuestoSemanal, hoyISO }) {
  const presupuesto = presupuestoDe(presupuestoSemanal)
  const horizonte = addDaysISO(hoyISO, HORIZONTE_PROYECCION_DIAS)
  const saldoHoy = saldoRealEnBanco({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, hoyISO })

  const semanaInicio = startOfWeekISO(hoyISO)
  const restanteSemana = Math.max(presupuesto - gastoSemanaReal(gastos, semanaInicio, hoyISO), 0)
  const diasRestantes = Math.max(diasEntreISO(hoyISO, addDaysISO(semanaInicio, 7)), 1)

  const delta = new Map()
  const sumar = (fecha, monto) => delta.set(fecha, (delta.get(fecha) || 0) + monto)
  ;(sueldosFijos || []).forEach((s) => {
    fechasPagoVivas(s, horizonte).filter((f) => f > hoyISO).forEach((f) => sumar(f, montoOcurrenciaSueldo(s, f)))
  })
  ;(sueldosRapidos || []).forEach((r) => {
    if (r?.fecha && r.fecha > hoyISO && r.fecha <= horizonte) sumar(r.fecha, Number(r.monto) || 0)
  })
  ;(pagosFijos || []).forEach((p) => {
    fechasVencimientoVivas(p, horizonte).filter((f) => f > hoyISO).forEach((f) => sumar(f, -montoOcurrenciaPagoFijo(p, f)))
  })

  const fechas = []
  const saldos = []
  let acumulado = saldoHoy
  for (let i = 0; i <= HORIZONTE_PROYECCION_DIAS; i++) {
    const f = addDaysISO(hoyISO, i)
    const gastoEsperado = i < diasRestantes ? restanteSemana / diasRestantes : presupuesto / 7
    acumulado += (delta.get(f) || 0) - gastoEsperado
    fechas.push(f)
    saldos.push(acumulado)
  }
  return { fechas, saldos, saldoHoy, restanteSemana, presupuesto }
}

// minimos[i] = el saldo más bajo que se proyecta del día i en adelante.
function minimosDesdeElFinal(saldos) {
  const minimos = new Array(saldos.length)
  let min = Infinity
  for (let i = saldos.length - 1; i >= 0; i--) {
    min = Math.min(min, saldos[i])
    minimos[i] = min
  }
  return minimos
}

function apartadoTotalPendiente(whimms) {
  return (whimms || []).filter(esWhimmPendiente).reduce((sum, w) => sum + (Number(w.montoApartado) || 0), 0)
}

// ---------------------------------------------------------------------------
// Bolsas (secciones B y C). `bolsaWhimms` = dinero libre HOY para Whimms: lo
// máximo que se puede gastar ahora sin que el saldo proyectado baje de $0.
// El cierre semanal es implícito: lo no gastado de una semana se queda en el
// saldo (bono) y lo gastado de más ya salió de él (déficit).
// ---------------------------------------------------------------------------
export function computeBolsas({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, presupuestoSemanal, hoyISO }) {
  const linea = lineaDeCaja({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, presupuestoSemanal, hoyISO })
  const bolsaWhimms = minimosDesdeElFinal(linea.saldos)[0] - apartadoTotalPendiente(whimms)

  const semanaHoyInicio = startOfWeekISO(hoyISO)
  const gastadoSemanaActual = gastoSemanaReal(gastos, semanaHoyInicio, hoyISO)
  const disponibleSemana = linea.presupuesto - gastadoSemanaActual
  const diasRestantesSemana = diasEntreISO(hoyISO, addDaysISO(semanaHoyInicio, 7))

  const semanaPasadaInicio = addDaysISO(semanaHoyInicio, -7)
  const gastadoPasada = gastoSemanaReal(gastos, semanaPasadaInicio, hoyISO)

  return {
    bolsaWhimms,
    presupuestoSemanaActual: linea.presupuesto,
    gastadoSemanaActual,
    disponibleSemana,
    diasRestantesSemana,
    semanaInicio: semanaHoyInicio,
    semanaFin: endOfWeekISO(hoyISO),
    promedioDiarioRestante: diasRestantesSemana > 0 ? disponibleSemana / diasRestantesSemana : disponibleSemana,
    // Resultado del último cierre (lunes 00:00): + sobró (bono), - se pasó (déficit).
    cierreSemanaPasada: { semanaInicio: semanaPasadaInicio, presupuesto: linea.presupuesto, gastado: gastadoPasada, resultado: linea.presupuesto - gastadoPasada },
  }
}

// ---------------------------------------------------------------------------
// Recomendación del presupuesto semanal: avisa (sin bloquear nada) cuando se
// gasta de más y sugiere el número que de verdad se ha gastado con más
// frecuencia (mediana de las últimas semanas cerradas, redondeada a $10).
// ---------------------------------------------------------------------------
function percentil(ordenados, p) {
  if (!ordenados.length) return 0
  const idx = (ordenados.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (idx - lo)
}

export function analizarPresupuestoSemanal({ gastos, presupuestoSemanal, hoyISO, semanas = 8 }) {
  const presupuesto = presupuestoDe(presupuestoSemanal)
  const fechasGasto = (gastos || []).filter((g) => g?.categoria !== 'Vitall' && g?.fecha && g.fecha <= hoyISO).map((g) => g.fecha).sort(compareISOAsc)
  const semanaHoy = startOfWeekISO(hoyISO)
  const gastadoActual = gastoSemanaReal(gastos, semanaHoy, hoyISO)

  const cerradas = []
  if (fechasGasto.length) {
    let cursor = startOfWeekISO(fechasGasto[0])
    while (cursor < semanaHoy) {
      cerradas.push({ semanaInicio: cursor, gastado: gastoSemanaReal(gastos, cursor, hoyISO) })
      cursor = addDaysISO(cursor, 7)
    }
  }
  const recientes = cerradas.slice(-semanas)
  const ordenados = recientes.map((s) => s.gastado).sort((a, b) => a - b)
  const mediana = percentil(ordenados, 0.5)
  const promedio = ordenados.length ? ordenados.reduce((s, x) => s + x, 0) / ordenados.length : 0
  const sugerido = ordenados.length ? Math.round(mediana / 10) * 10 : presupuesto

  const ultimas3 = recientes.slice(-3)
  const excedidasRecientes = ultimas3.filter((s) => s.gastado > presupuesto).length
  const semanaActualExcedida = gastadoActual > presupuesto
  const recurrente = ultimas3.length >= 2 && excedidasRecientes >= 2
  const difiereMucho = presupuesto > 0 ? Math.abs(sugerido - presupuesto) / presupuesto >= 0.1 : sugerido > 0

  return {
    presupuesto,
    semanaActualExcedida,
    excedidoActual: Math.max(gastadoActual - presupuesto, 0),
    semanasCerradasAnalizadas: recientes.length,
    confiable: recientes.length >= 3, // con menos semanas la mediana es solo orientativa
    mediana,
    promedio,
    p75: percentil(ordenados, 0.75),
    sugerido,
    // Aviso: nunca bloquea; solo recomienda mover el presupuesto fijo.
    aviso: recurrente ? 'recurrente' : semanaActualExcedida ? 'excedida' : null,
    recomendarCambio: recurrente && difiereMucho,
  }
}

// ---------------------------------------------------------------------------
// Score y prioridad (sección D). Fecha límite OPCIONAL: sin fecha, la
// prioridad es solo el score (no se penaliza). Con fecha, la prioridad sube
// hasta x1.5 conforme se acerca (60 días o más antes: x1.0).
// ---------------------------------------------------------------------------
const URGENCIA_DIAS = 60
const URGENCIA_MAX = 0.5

export function urgenciaFechaLimite(fechaLimite, hoyISO) {
  if (!fechaLimite) return 1
  const dias = diasEntreISO(hoyISO, fechaLimite)
  if (dias == null || dias >= URGENCIA_DIAS) return 1
  return 1 + URGENCIA_MAX * (1 - Math.max(dias, 0) / URGENCIA_DIAS)
}

export function computeWhimmPrioridad(whimm, hoyISO) {
  return computeWhimmScore(whimm) * urgenciaFechaLimite(whimm?.fechaLimite, hoyISO)
}

// ---------------------------------------------------------------------------
// SECCIÓN D — Proyección de fechas de compra.
//
// La fecha de un Whimm es el primer día en que su compra cabe sin que el saldo
// proyectado baje de $0 en ningún día posterior. Se acomodan en orden de
// prioridad; cada compra reservada baja el saldo desde su fecha, así que un
// Whimm menor puede caber antes pero NUNCA retrasa a uno de mayor prioridad
// (RN-04). Reemplaza al reparto en cascada + "turno especial" del modelo por
// porcentaje: aquí lo barato se compra apenas cabe.
// `montoApartado` (Apartar fondos extra) es dinero ya reservado: no se ofrece a
// otros Whimms y reduce lo que le falta al suyo.
// ---------------------------------------------------------------------------
export function proyectarColaWhimms({ whimms, sueldosFijos, sueldosRapidos, pagosFijos, gastos, saldoInicial, presupuestoSemanal, hoyISO }) {
  const linea = lineaDeCaja({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, presupuestoSemanal, hoyISO })
  const apartado = apartadoTotalPendiente(whimms)
  const saldos = linea.saldos.map((s) => s - apartado)

  const ordenados = (whimms || [])
    .filter(esWhimmPendiente)
    .map((w) => ({ w, score: computeWhimmScore(w), prioridad: computeWhimmPrioridad(w, hoyISO) }))
    .sort((a, b) => b.prioridad - a.prioridad || (Number(a.w.precio) || 0) - (Number(b.w.precio) || 0))

  return ordenados.map(({ w, score, prioridad }) => {
    const faltante = Math.max((Number(w.precio) || 0) - (Number(w.montoApartado) || 0), 0)
    const minimos = minimosDesdeElFinal(saldos)
    const idx = minimos.findIndex((m) => m + EPS >= faltante)
    let fechaProyectada = null
    if (idx >= 0) {
      fechaProyectada = linea.fechas[idx]
      for (let j = idx; j < saldos.length; j++) saldos[j] -= faltante
    }
    const diasMargen = fechaProyectada && w.fechaLimite ? diasEntreISO(fechaProyectada, w.fechaLimite) : null
    let estatus = 'sin_fecha_segura'
    if (fechaProyectada) {
      if (diasMargen != null && diasMargen < 0) estatus = 'tarde'
      else estatus = fechaProyectada === hoyISO ? 'comprable_hoy' : 'en_fecha'
    }
    return { id: w.id, score, prioridad, faltante, fechaProyectada, fechaLimite: w.fechaLimite || null, diasMargen, estatus }
  })
}

// ---------------------------------------------------------------------------
// modoAhorro (sección 5.3 del doc Whital) — 3 niveles en vez del slider
// 0-100%. Reemplaza `porcentajeWhimms` como el campo que el usuario edita;
// `porcentajeWhimms` sigue siendo el número real que usa el motor (se
// deriva de `modoAhorro` justo antes de llamar a computeBolsas/proyección).
// ---------------------------------------------------------------------------
export const MODOS_AHORRO = {
  Tranquilo: 0.3,
  Balanceado: 0.5,
  Acelerado: 0.7,
}

export function porcentajeDeModoAhorro(modoAhorro) {
  return MODOS_AHORRO[modoAhorro] ?? MODOS_AHORRO.Balanceado
}
