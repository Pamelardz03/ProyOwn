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

function esMSI(p) {
  return p?.tipo === 'MSI'
}

// Suma de vencimientos Vitall-like (NO MSI) en una fecha exacta.
function vencimientosVitallEnFecha(pagosFijos, fechaISO) {
  return (pagosFijos || [])
    .filter((p) => !esMSI(p))
    .reduce((sum, p) => sum + (fechasVencimientoVivas(p, fechaISO).includes(fechaISO) ? montoOcurrenciaPagoFijo(p, fechaISO) : 0), 0)
}

// Reserva Vitalls (rampa proporcional, sección B.1): dinero que hay que
// apartar de ESTE ingreso para cubrir los Vitalls (no-MSI) que vencen antes
// del siguiente cobro — es decir, todo lo que vence en [desdeISO, hastaISOExclusivo).
function reservaVitallsTramo(pagosFijos, desdeISO, hastaISOExclusivo) {
  let total = 0
  let f = desdeISO
  let guard = 0
  while (f < hastaISOExclusivo && guard < 3660) {
    total += vencimientosVitallEnFecha(pagosFijos, f)
    f = addDaysISO(f, 1)
    guard++
  }
  return total
}

// ---------------------------------------------------------------------------
// Línea de tiempo de ingresos (sección B) — sueldos fijos (incluye fechas
// futuras ya generadas, necesarias para calcular la tasa diaria de la
// semana en curso) + sueldos rápidos (siempre puntuales).
// ---------------------------------------------------------------------------
function eventosIngreso(sueldosFijos, sueldosRapidos, hastaISO) {
  const eventos = []
  ;(sueldosFijos || []).forEach((s) => {
    fechasPagoVivas(s, hastaISO).forEach((f) => {
      eventos.push({ fecha: f, monto: montoOcurrenciaSueldo(s, f) })
    })
  })
  ;(sueldosRapidos || []).forEach((r) => {
    if (r?.fecha && r.fecha <= hastaISO) {
      eventos.push({ fecha: r.fecha, monto: Number(r.monto) || 0 })
    }
  })
  eventos.sort((a, b) => compareISOAsc(a.fecha, b.fecha))
  return eventos
}

// Construye los "tramos" entre un evento de ingreso y el siguiente —
// necesarios tanto para la Reserva Vitalls (B.1) como para la tasa diaria de
// la Bolsa Gastos Semanales (B.3, "distribuido entre las semanas cubiertas
// por el tramo").
function construirTramos({ sueldosFijos, sueldosRapidos, pagosFijos, porcentajeWhimms, horizonteISO }) {
  const eventos = eventosIngreso(sueldosFijos, sueldosRapidos, horizonteISO)
  const tramos = []
  for (let i = 0; i < eventos.length; i++) {
    const evento = eventos[i]
    const finTramo = i + 1 < eventos.length ? eventos[i + 1].fecha : horizonteISO
    const reserva = Math.min(reservaVitallsTramo(pagosFijos, evento.fecha, finTramo), evento.monto)
    const dineroLibre = Math.max(evento.monto - reserva, 0)
    const bolsaWhimmsDelta = dineroLibre * porcentajeWhimms
    const gastosTramoTotal = dineroLibre * (1 - porcentajeWhimms)
    const diasTramo = Math.max(diasEntreISO(evento.fecha, finTramo), 1)
    const tasaDiariaGastos = gastosTramoTotal / diasTramo
    tramos.push({ inicio: evento.fecha, fin: finTramo, evento, reserva, dineroLibre, bolsaWhimmsDelta, tasaDiariaGastos })
  }
  return tramos
}

// Cuántos días de un tramo [tramo.inicio, tramo.fin) caen dentro de
// [desdeISO, hastaISOExclusivo) — para sumar la tasa diaria de gastos de
// cada tramo dentro de una semana concreta sin tener que construir un mapa
// día-por-día completo.
function diasTraslape(tramo, desdeISO, hastaISOExclusivo) {
  const ini = tramo.inicio > desdeISO ? tramo.inicio : desdeISO
  const fin = tramo.fin < hastaISOExclusivo ? tramo.fin : hastaISOExclusivo
  const dias = diasEntreISO(ini, fin)
  return dias > 0 ? dias : 0
}

function presupuestoSemana(tramos, semanaInicioISO) {
  const semanaFinExclusivo = addDaysISO(semanaInicioISO, 7)
  return tramos.reduce((sum, t) => sum + diasTraslape(t, semanaInicioISO, semanaFinExclusivo) * t.tasaDiariaGastos, 0)
}

function gastoSemanaReal(gastos, semanaInicioISO, hastaISO) {
  const semanaFinExclusivo = addDaysISO(semanaInicioISO, 7)
  const limite = hastaISO < semanaFinExclusivo ? addDaysISO(hastaISO, 1) : semanaFinExclusivo
  return (gastos || [])
    .filter((g) => g?.categoria !== 'Vitall') // un Gasto tipo Vitall no resta del real (sección 3)
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

// ---------------------------------------------------------------------------
// SECCIÓN B+C — Las 2 Bolsas: Gastos Semanales (con cierre autorregulador
// cada lunes) + Whimms (acumulado puro). Ver el comentario grande al
// principio del archivo para la derivación de por qué la "Reserva Vitalls"
// nunca necesita ser un bolsillo persistido/replayado: simplemente nunca
// entra a ninguna de las 2 bolsas, y se resta sola de `saldoRealEnBanco`
// cuando el Vitall de verdad se cobra.
// ---------------------------------------------------------------------------
export function computeBolsas({ sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, porcentajeWhimms, hoyISO }) {
  const semanaHoyInicio = startOfWeekISO(hoyISO)
  // Horizonte EXCLUSIVO: el día después del domingo de la semana actual,
  // para poder calcular la tasa diaria de gastos de TODA la semana en curso
  // (incluye días futuros de esta misma semana, p.ej. si hoy es martes)
  // usando sueldos fijos ya programados a futuro. OJO: tiene que ser
  // exclusivo (igual que `semanaFinExclusivo` en presupuestoSemana/
  // gastoSemanaReal) o el domingo de la semana actual se queda sin tasa.
  const horizonte = addDaysISO(semanaHoyInicio, 7)
  const tramos = construirTramos({ sueldosFijos, sueldosRapidos, pagosFijos, porcentajeWhimms, horizonteISO: horizonte })

  // --- Bolsa Whimms: acumulado de depósitos de ingresos reales (<= hoy) ---
  let bolsaWhimms = 0
  tramos.forEach((t) => {
    if (t.evento.fecha <= hoyISO) bolsaWhimms += t.bolsaWhimmsDelta
  })

  // --- + resultado de cada semana YA CERRADA (antes de la semana de hoy) ---
  // (sección C: sobrante -> bono directo a Whimms; déficit -> se descuenta
  // de Whimms; la Bolsa Gastos siempre arranca limpia la semana siguiente,
  // lo cual ya es cierto aquí porque cada semana se calcula con su propio
  // presupuesto, sin cargar el arrastre de la anterior).
  if (tramos.length) {
    let semanaCursor = startOfWeekISO(tramos[0].inicio)
    while (semanaCursor < semanaHoyInicio) {
      const presupuesto = presupuestoSemana(tramos, semanaCursor)
      const gastado = gastoSemanaReal(gastos, semanaCursor, hoyISO)
      bolsaWhimms += presupuesto - gastado
      semanaCursor = addDaysISO(semanaCursor, 7)
    }
  }

  // --- - Whimms comprados (precioComprado - montoApartado) ---
  ;(whimms || []).forEach((w) => {
    if (w?.estado === 'comprado' && w.compradoEn && w.compradoEn <= hoyISO) {
      const precioFinal = Number(w.precioComprado ?? w.precio) || 0
      const yaApartado = Number(w.montoApartado) || 0
      bolsaWhimms -= Math.max(precioFinal - yaApartado, 0)
    }
  })

  // --- - Mensualidades MSI (siempre de la Bolsa Whimms, nunca de Gastos ni
  // de la Reserva Vitalls — Entidades, "MSI") ---
  ;(pagosFijos || []).filter(esMSI).forEach((p) => {
    fechasVencimientoVivas(p, hoyISO).forEach((f) => { bolsaWhimms -= montoOcurrenciaPagoFijo(p, f) })
  })

  // --- Bolsa Gastos Semanales — la semana EN CURSO (todavía no cierra) ---
  const presupuestoSemanaActual = presupuestoSemana(tramos, semanaHoyInicio)
  const gastadoSemanaActual = gastoSemanaReal(gastos, semanaHoyInicio, hoyISO)
  const disponibleSemana = presupuestoSemanaActual - gastadoSemanaActual
  const diasRestantesSemana = diasEntreISO(hoyISO, addDaysISO(semanaHoyInicio, 7))

  return {
    bolsaWhimms,
    presupuestoSemanaActual,
    gastadoSemanaActual,
    disponibleSemana,
    diasRestantesSemana,
    semanaInicio: semanaHoyInicio,
    semanaFin: endOfWeekISO(hoyISO),
    promedioDiarioRestante: diasRestantesSemana > 0 ? disponibleSemana / diasRestantesSemana : disponibleSemana,
    _tramos: tramos, // expuesto solo para debug/tests, no lo consume la UI
  }
}

// ---------------------------------------------------------------------------
// SECCIÓN D (parcial) — reparto proporcional entre los primeros N Whimms por
// score. Reutiliza exactamente el mismo criterio que el motor real
// (asignarSaldoWhimms), adaptado a un solo saldo disponible.
// ---------------------------------------------------------------------------
export function repartoWhimms(whimmsActivosOrdenados, saldoDisponible, whimmsSimultaneos) {
  const n = Math.max(Number(whimmsSimultaneos) || 1, 1)
  const objetivo = whimmsActivosOrdenados.slice(0, n)
  let restante = Math.max(saldoDisponible, 0)
  const acumulado = {}
  objetivo.forEach((w) => {
    if (restante <= 0) { acumulado[w.id] = 0; return }
    const precio = Number(w.precio) || 0
    const yaJuntado = Number(w.montoApartado) || 0
    const falta = Math.max(precio - yaJuntado, 0)
    const asignado = Math.min(restante, falta)
    acumulado[w.id] = asignado
    restante -= asignado
  })
  // El resto de la fila (fuera de los primeros N) no recibe nada todavía.
  whimmsActivosOrdenados.slice(n).forEach((w) => { acumulado[w.id] = 0 })
  return acumulado
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

// ---------------------------------------------------------------------------
// SECCIÓN D — Proyección de fechas de compra de la cola de Whimms.
//
// Mismo criterio que el motor real (construirFlujoFuturo/proyectarColaWhimms
// en src/lib/budget.js), adaptado a un solo pool de dinero (Bolsa Whimms)
// en vez de 3 bolsillos. Simula evento por evento hacia el futuro:
//   - cada ingreso futuro deposita su `bolsaWhimmsDelta` en el pool,
//   - cada cierre de semana futuro se asume NEUTRO por defecto (presupuesto
//     = gasto, bono/déficit = 0) salvo que se pase `gastoHormigaDiarioEst`
//     (p.ej. el promedio histórico real) para restar una estimación de
//     gasto hormiga futuro de cada cierre semanal — sección D no especifica
//     cómo proyectar gasto futuro, así que esto es una estimación razonable,
//     a ajustar con datos reales una vez conectado a la cuenta de prueba,
//   - cada vencimiento MSI futuro resta del pool (nunca de Gastos/Vitalls),
//   - el pool creciente se reparte en cascada (repartoWhimms) entre los
//     primeros `whimmsSimultaneos` Whimms activos por score; en cuanto un
//     Whimm llega al 100% de su precio se marca con la fecha de ESE evento
//     y sale de la fila, liberando el resto del pool al siguiente evento.
//   - Cadencia mínima ("Turno especial", sección D): si pasan >= 14 días
//     sin completar NINGÚN Whimm, el 20% del pool de ESE momento se desvía
//     por completo al Whimm pendiente más barato (marcado `viaCadencia`),
//     fuera del reparto normal por score.
// ---------------------------------------------------------------------------
const CADENCIA_DIAS = 14
const RESERVA_CADENCIA = 0.2
const HORIZONTE_PROYECCION_DIAS = 540 // ~18 meses — suficiente para wishlists largas, sin loop infinito

function elegirBaratoPendiente(pendientes) {
  if (!pendientes.length) return null
  return pendientes.reduce((min, w) => (Number(w.precio) < Number(min.precio) ? w : min), pendientes[0])
}

export function proyectarColaWhimms({
  whimmsActivos, // [{id, precio, montoApartado, necesidad, deseo}], estado !== comprado/pagando
  bolsaWhimmsHoy, // de computeBolsas(...).bolsaWhimms
  sueldosFijos,
  sueldosRapidos,
  pagosFijos,
  porcentajeWhimms,
  whimmsSimultaneos,
  hoyISO,
  ultimaCompraISO, // fecha de compra más reciente entre los Whimms ya comprados (o null)
  gastoHormigaDiarioEst = 0,
}) {
  const horizonte = addDaysISO(hoyISO, HORIZONTE_PROYECCION_DIAS)
  const tramos = construirTramos({ sueldosFijos, sueldosRapidos, pagosFijos, porcentajeWhimms, horizonteISO: horizonte })
  const msiFuturos = (pagosFijos || [])
    .filter(esMSI)
    .flatMap((p) => fechasVencimientoVivas(p, horizonte).filter((f) => f > hoyISO).map((f) => ({ fecha: f, monto: montoOcurrenciaPagoFijo(p, f) })))

  // Línea de eventos futuros: depósitos de ingreso (en su fecha real) +
  // cierres de semana (cada domingo->lunes, estimados) + pagos MSI.
  const eventos = []
  tramos.forEach((t) => {
    if (t.evento.fecha > hoyISO) eventos.push({ fecha: t.evento.fecha, tipo: 'ingreso', monto: t.bolsaWhimmsDelta })
  })
  {
    let semanaCursor = addDaysISO(startOfWeekISO(hoyISO), 7) // primer cierre futuro = inicio de la próxima semana
    while (semanaCursor <= horizonte) {
      const presupuesto = presupuestoSemana(tramos, semanaCursor)
      const estimadoGasto = Math.min(presupuesto, gastoHormigaDiarioEst * 7)
      eventos.push({ fecha: semanaCursor, tipo: 'cierreSemana', monto: presupuesto - estimadoGasto })
      semanaCursor = addDaysISO(semanaCursor, 7)
    }
  }
  msiFuturos.forEach((m) => eventos.push({ fecha: m.fecha, tipo: 'msi', monto: -m.monto }))
  eventos.sort((a, b) => compareISOAsc(a.fecha, b.fecha))

  let pool = Math.max(bolsaWhimmsHoy, 0)
  const pendientes = (whimmsActivos || [])
    .map((w) => ({ ...w, _score: computeWhimmScore(w), _comprado: false, _fechaProyectada: null, _viaCadencia: false }))
  let ultimaCompra = ultimaCompraISO || null

  for (const ev of eventos) {
    pool += ev.monto
    if (pool < 0) pool = 0 // nunca proyectamos un pool negativo; un déficit fuerte solo retrasa todo lo demás

    // Cadencia mínima: si ya pasaron >=14 días sin completar nada, se desvía
    // un 20% del pool ACTUAL directo al más barato pendiente, fuera del
    // reparto normal.
    const faltanActivos = pendientes.filter((w) => !w._comprado)
    if (!faltanActivos.length) break
    const diasSinComprar = ultimaCompra ? diasEntreISO(ultimaCompra, ev.fecha) : Infinity
    if (diasSinComprar >= CADENCIA_DIAS) {
      const barato = elegirBaratoPendiente(faltanActivos)
      const falta = Math.max(Number(barato.precio) - Number(barato.montoApartado || 0), 0)
      const viaCadenciaMonto = Math.min(pool * RESERVA_CADENCIA, falta)
      if (viaCadenciaMonto > 0) {
        barato.montoApartado = (Number(barato.montoApartado) || 0) + viaCadenciaMonto
        pool -= viaCadenciaMonto
        if (barato.montoApartado >= Number(barato.precio)) {
          barato._comprado = true
          barato._fechaProyectada = ev.fecha
          barato._viaCadencia = true
          ultimaCompra = ev.fecha
        }
      }
    }

    // Reparto normal por score entre los primeros N activos pendientes.
    const ordenados = pendientes.filter((w) => !w._comprado).sort((a, b) => b._score - a._score)
    const n = Math.max(Number(whimmsSimultaneos) || 1, 1)
    let restante = pool
    for (const w of ordenados.slice(0, n)) {
      if (restante <= 0) break
      const falta = Math.max(Number(w.precio) - Number(w.montoApartado || 0), 0)
      const asignado = Math.min(restante, falta)
      w.montoApartado = (Number(w.montoApartado) || 0) + asignado
      restante -= asignado
      if (asignado > 0 && w.montoApartado >= Number(w.precio)) {
        w._comprado = true
        w._fechaProyectada = ev.fecha
        ultimaCompra = ev.fecha
      }
    }
    pool = restante

    if (pendientes.every((w) => w._comprado)) break
  }

  return pendientes.map((w) => ({
    id: w.id,
    score: w._score,
    fechaProyectada: w._fechaProyectada, // null = no se alcanza a proyectar dentro del horizonte
    viaCadencia: w._viaCadencia,
    acumuladoProyectado: Math.min(Number(w.montoApartado) || 0, Number(w.precio) || 0),
  }))
}
