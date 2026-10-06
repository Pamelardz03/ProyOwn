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

export function toISO(d) {
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
export const NIVEL_MIN = 1
export const NIVEL_MAX = 5 // necesidad y deseo: 5 niveles (decisión 4 oct; antes 1-10)
export const NIVEL_DEFAULT = 3

export function normalizarNivel(valor) {
  const n = Math.round(Number(valor))
  if (!Number.isFinite(n)) return NIVEL_DEFAULT
  // Un 6-10 solo puede venir de la escala vieja de 1-10: se convierte a 1-5 (8 -> 4), no se topa en 5.
  const nivel = n > NIVEL_MAX ? Math.ceil(n / 2) : n
  return Math.min(Math.max(nivel, NIVEL_MIN), NIVEL_MAX)
}

// Para datos viejos capturados con la escala 1-10 (cuenta real de producción).
export function nivelDeEscala10(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return NIVEL_DEFAULT
  return normalizarNivel(Math.ceil(n / 2))
}

export function computeWhimmScore({ necesidad, deseo, precio }) {
  const n = normalizarNivel(necesidad)
  const d = normalizarNivel(deseo)
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
// Calendario de pagos de un sueldo hasta `hastaISO`. Si el calendario guardado se acaba antes
// (cuentas con calendarios cortos), se extiende con el mismo patrón desde donde terminó, para
// que la proyección no crea que dejaste de cobrar.
export function calendarioDePagos(sueldo, hastaISO) {
  const fechas = Array.isArray(sueldo?.fechasPago) ? [...sueldo.fechasPago] : []
  const ultima = fechas.reduce((m, f) => (f && f > m ? f : m), '')
  if (!ultima || ultima >= hastaISO || !sueldo?.frecuencia || !sueldo?.fechaInicio) return fechas
  const meses = Math.min(Math.ceil((diasEntreISO(sueldo.fechaInicio, hastaISO) || 0) / 28) + 2, 240)
  const extra = generarFechasPago({ frecuencia: sueldo.frecuencia, fechaInicio: sueldo.fechaInicio, meses }).filter((f) => f > ultima)
  return [...fechas, ...extra]
}

export function fechasPagoVivas(sueldo, hastaISO) {
  const fechas = calendarioDePagos(sueldo, hastaISO)
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
function fechasVencimientoBase(pagoFijo, hastaISO) {
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
  return fechas
}

function fechasVencimientoVivas(pagoFijo, hastaISO) {
  return fechasVencimientoBase(pagoFijo, hastaISO).filter((fx) => !excepcionDe(pagoFijo, fx)?.omitida)
}

export function addMonthsISO(iso, n) {
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
export function saldoRealEnBanco({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, ajustesSaldo, hoyISO }) {
  let saldo = Number(saldoInicial) || 0

  // Ajustes de saldo ("Ajustar saldo a mi banco"): diferencias confirmadas
  // contra el banco real; a futuro las generará la conexión con Nu.
  ;(ajustesSaldo || []).forEach((a) => {
    if (a?.fecha && a.fecha <= hoyISO) saldo += Number(a.monto) || 0
  })

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

// Día (ISO, hora local) en que se guardó un documento, a partir de su `creadoEn` de Firestore.
function isoDeRegistro(creadoEn) {
  const ms = typeof creadoEn?.toMillis === 'function' ? creadoEn.toMillis() : creadoEn?.seconds != null ? creadoEn.seconds * 1000 : creadoEn?._seconds != null ? creadoEn._seconds * 1000 : null
  return ms == null ? null : toISO(new Date(ms))
}

// Dinero reservado para gastos hasta el próximo cobro. La semana arranca con su presupuesto
// cubierto (840) y cada día sin gastar lo deja para repartirse entre los días que faltan
// (reserva / días al cobro). Nunca se reserva más del promedio diario (presupuesto / 7) por día
// que falta: lo que sobra de ese tope pasa a Whimms y ya no regresa. Lo gastado baja la reserva
// y se va regenerando en los días que no gastas, hasta volver a topar con el promedio. Gastar más
// que la reserva ya no sale de aquí sino del saldo (o sea, de Whimms). Se calcula desde el lunes.
export function reservaGastos(base) {
  const { sueldosFijos, sueldosRapidos, gastos, presupuestoSemanal, hoyISO } = base
  const presupuesto = presupuestoDe(presupuestoSemanal)
  const tope = presupuesto / 7
  const diasAlCobro = (dia) => {
    const cobro = proximoCobroPrincipalISO({ sueldosFijos, hoyISO: dia })
    return Math.max(cobro ? diasEntreISO(dia, cobro) : 30, 1)
  }
  const gastoDelDia = (dia) => (gastos || []).filter((g) => g?.categoria !== 'Vitall' && g?.fecha === dia).reduce((sum, g) => sum + gastoNeto(g), 0)
  // Todo ingreso (sueldos e ingresos rápidos) se reparte en este orden: 1) Vitalls, si el saldo no los
  // alcanza; 2) lo que falte en la reserva de gastos (hasta lo que tocaría tener: el presupuesto de la
  // semana, hasta el promedio diario por cada día que falta); 3) lo que sobra, a Whimms. Los omitidos o
  // "aún no llega" no cuentan hasta que lleguen. `destinos` se indexa por id del ingreso.
  const destinos = {}
  // Un ingreso agregado o marcado como llegado tarde (de un día pasado o de otra semana) cuenta como
  // si llegara el día en que lo registraste: `marcadoEn` en los sueldos y `creadoEn` en los rápidos.
  const llegada = (fecha, registroISO) => (registroISO && registroISO > fecha && registroISO <= hoyISO ? registroISO : fecha)
  const semana = startOfWeekISO(hoyISO)
  const ingresos = [
    ...(sueldosRapidos || []).filter((r) => r?.fecha && r.fecha <= hoyISO).map((r) => ({ id: r.id, fecha: llegada(r.fecha, isoDeRegistro(r.creadoEn)), monto: Number(r.monto) || 0 })),
    ...(sueldosFijos || []).flatMap((s) =>
      fechasPagoVivas(s, hoyISO).map((f) => ({ id: `sf-${s.id}-${f}`, fecha: llegada(f, excepcionDe(s, f)?.marcadoEn), monto: montoOcurrenciaSueldo(s, f) }))
    ),
  ].filter((i) => i.fecha >= semana)
  let faltaVitalls = 0
  if (base.saldoInicial !== undefined || base.ajustesSaldo) {
    const hoyIngresos = ingresos.filter((i) => i.fecha === hoyISO).reduce((sum, i) => sum + i.monto, 0)
    const antes = saldoRealEnBanco(base) - hoyIngresos
    faltaVitalls = Math.max(vitallsHastaCobro(base) - Math.max(antes, 0), 0)
  }
  const rellenar = (dia, objetivoDia) => {
    ingresos.filter((i) => i.fecha === dia).forEach((i) => {
      const aVitalls = dia === hoyISO ? Math.min(i.monto, faltaVitalls) : 0
      if (aVitalls) faltaVitalls -= aVitalls
      const aGastos = Math.min(i.monto - aVitalls, Math.max(tope * objetivoDia - reserva, 0))
      reserva += aGastos
      destinos[i.id] = { monto: i.monto, aVitalls, aGastos, aWhimms: i.monto - aVitalls - aGastos }
    })
  }
  let dia = startOfWeekISO(hoyISO)
  let reserva = Math.min(presupuesto, tope * diasAlCobro(dia))
  while (dia < hoyISO) {
    reserva = Math.max(reserva - gastoDelDia(dia), 0)
    dia = addDaysISO(dia, 1)
    const diasHoy = diasAlCobro(dia)
    rellenar(addDaysISO(dia, -1), diasHoy)
    reserva = Math.min(reserva, tope * diasHoy)
  }
  const dias = diasAlCobro(hoyISO)
  rellenar(hoyISO, dias)
  return { reserva, dias, tope, destinos, asignado: Math.min(tope, reserva / dias), gastoHoy: gastoDelDia(hoyISO) }
}

function vitallsHastaCobro({ pagosFijos, sueldosFijos, hoyISO }) {
  const proximo = proximoCobroPrincipalISO({ sueldosFijos, hoyISO }) || addDaysISO(hoyISO, 30)
  return (pagosFijos || [])
    .filter((p) => p?.tipo !== 'MSI')
    .flatMap((p) => fechasVencimientoVivas(p, addDaysISO(proximo, -1)).filter((f) => f > hoyISO).map((f) => montoOcurrenciaPagoFijo(p, f)))
    .reduce((sum, x) => sum + x, 0)
}

// Línea de caja: saldo proyectado de cada día desde hoy (índice 0) hasta el
// horizonte, SIN contar compras de Whimms futuras. Hoy solo suma el gasto
// esperado de hoy (los demás eventos de hoy ya están en el saldo real).
function lineaDeCaja({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, ajustesSaldo, presupuestoSemanal, hoyISO }) {
  const presupuesto = presupuestoDe(presupuestoSemanal)
  const horizonte = addDaysISO(hoyISO, HORIZONTE_PROYECCION_DIAS)
  const saldoHoy = saldoRealEnBanco({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, ajustesSaldo, hoyISO })

  const reserva = reservaGastos({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, ajustesSaldo, presupuestoSemanal, hoyISO })

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
    // Hasta el cobro se aparta lo reservado para gastos repartido por día (hoy, menos lo ya gastado);
    // después, el promedio diario (presupuesto / 7).
    const asignado = reserva.reserva / reserva.dias
    const gastoEsperado = i < reserva.dias ? (i === 0 ? Math.max(asignado - reserva.gastoHoy, 0) : asignado) : presupuesto / 7
    acumulado += (delta.get(f) || 0) - gastoEsperado
    fechas.push(f)
    saldos.push(acumulado)
  }
  return { fechas, saldos, saldoHoy, presupuesto }
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
export function computeBolsas({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, ajustesSaldo, presupuestoSemanal, hoyISO }) {
  const linea = lineaDeCaja({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, ajustesSaldo, presupuestoSemanal, hoyISO })
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
export function proyectarColaWhimms({ whimms, sueldosFijos, sueldosRapidos, pagosFijos, gastos, saldoInicial, ajustesSaldo, presupuestoSemanal, whimmsSimultaneos = 1, hoyISO }) {
  const linea = lineaDeCaja({ saldoInicial, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, ajustesSaldo, presupuestoSemanal, hoyISO })
  const apartado = apartadoTotalPendiente(whimms)
  const saldosBase = linea.saldos.map((s) => s - apartado)

  const porPrioridad = (whimms || [])
    .filter(esWhimmPendiente)
    .map((w) => ({ w, score: computeWhimmScore(w), prioridad: computeWhimmPrioridad(w, hoyISO) }))
    .sort((a, b) => b.prioridad - a.prioridad || (Number(a.w.precio) || 0) - (Number(b.w.precio) || 0))

  // Intercambio por exceso de presupuesto semanal (más abajo): los Whimms
  // "bloqueados" no se pueden comprar antes del lunes siguiente.
  const semanaInicio = startOfWeekISO(hoyISO)
  const proximoLunes = addDaysISO(semanaInicio, 7)
  const idxLunes = Math.max(linea.fechas.findIndex((f) => f >= proximoLunes), 0)
  const bloqueados = new Set()

  // Dinero libre acumulado que se puede ir comprometiendo, día por día: el saldo
  // más bajo que se proyecta de ese día en adelante (nunca baja). Cada día entra
  // al reparto lo que subió respecto al día anterior.
  const envolvente = minimosDesdeElFinal(saldosBase)
  const entradas = []
  let previo = 0
  for (const m of envolvente) {
    const positivo = Math.max(m, 0)
    entradas.push(positivo - previo)
    previo = positivo
  }
  const simultaneos = Math.max(Math.round(Number(whimmsSimultaneos)) || 1, 1)

  // FINANCIAR A LA VEZ: el dinero se reparte en partes IGUALES entre los primeros
  // `simultaneos` Whimms de la fila. Al que le falta menos que su parte se le da
  // lo que necesita (se completa ese día) y el sobrante se reparte entre los
  // demás; en cuanto uno se completa entra el siguiente de la fila. Con 1 a la
  // vez es estrictamente de arriba hacia abajo. Devuelve fecha de compra y
  // `avanceHoy` (lo que ya lleva hoy) de cada Whimm.
  const simular = (orden) => {
    const items = orden.map(({ w, score, prioridad }) => ({
      w,
      score,
      prioridad,
      faltante: Math.max((Number(w.precio) || 0) - (Number(w.montoApartado) || 0), 0),
      avance: 0,
      avanceHoy: 0,
      fechaIdx: null,
      desde: bloqueados.has(w.id) ? idxLunes : 0,
    }))
    let pool = 0
    for (let dia = 0; dia < entradas.length; dia++) {
      pool += entradas[dia]
      for (;;) {
        const activos = []
        for (const it of items) {
          if (it.fechaIdx != null || it.desde > dia) continue
          activos.push(it)
          if (activos.length >= simultaneos) break
        }
        if (!activos.length) break
        const gratis = activos.find((it) => it.faltante - it.avance <= EPS)
        if (gratis) {
          gratis.avance = gratis.faltante
          gratis.fechaIdx = dia
          continue
        }
        if (pool <= EPS) break
        const parte = pool / activos.length
        const alcanza = activos.find((it) => it.faltante - it.avance <= parte + EPS)
        if (alcanza) {
          pool -= alcanza.faltante - alcanza.avance
          alcanza.avance = alcanza.faltante
          alcanza.fechaIdx = dia
          continue
        }
        activos.forEach((it) => { it.avance += parte })
        pool = 0
        break
      }
      if (dia === 0) items.forEach((it) => { it.avanceHoy = it.avance })
      if (items.every((it) => it.fechaIdx != null)) break
    }
    return items.map((it) => {
      const { w, score, prioridad, faltante } = it
      const fechaProyectada = it.fechaIdx != null ? linea.fechas[it.fechaIdx] : null
      const diasMargen = fechaProyectada && w.fechaLimite ? diasEntreISO(fechaProyectada, w.fechaLimite) : null
      let estatus = 'sin_fecha_segura'
      if (fechaProyectada) {
        if (diasMargen != null && diasMargen < 0) estatus = 'tarde'
        else estatus = fechaProyectada === hoyISO ? 'comprable_hoy' : 'en_fecha'
      }
      return { id: w.id, score, prioridad, faltante, avanceHoy: it.avanceHoy, fechaProyectada, fechaLimite: w.fechaLimite || null, diasMargen, estatus, intercambiado: bloqueados.has(w.id) }
    })
  }

  // Rescate por fecha límite: el score manda, pero si una fecha límite se
  // incumpliría, ese Whimm sube lo MÍNIMO necesario en la fila (el menor
  // desplazamiento) siempre que eso reduzca el atraso total. Whimms sin fecha
  // no se penalizan, solo ceden el lugar si estorban a uno con fecha.
  const atraso = (res) => res.reduce((sum, r) => {
    if (!r.fechaLimite) return sum
    if (!r.fechaProyectada) return sum + 1000
    return sum + (r.diasMargen < 0 ? -r.diasMargen : 0)
  }, 0)

  const resolver = () => {
    let orden = porPrioridad
    let resultado = simular(orden)
    let atrasoActual = atraso(resultado)
    for (let pasada = 0; pasada < 20 && atrasoActual > 0; pasada++) {
      // Se atiende primero el Whimm incumplido con la fecha límite más cercana.
      let i = -1
      resultado.forEach((r, k) => {
        const incumple = r.fechaLimite && (r.estatus === 'tarde' || r.estatus === 'sin_fecha_segura')
        if (incumple && (i < 0 || r.fechaLimite < resultado[i].fechaLimite)) i = k
      })
      if (i < 0) break

      // Dos tipos de movimiento: subir al incumplido, o bajar detrás de él a un
      // Whimm anterior que no esté incumpliendo (le sobra margen o no tiene fecha).
      const candidatos = []
      for (let j = i - 1; j >= 0; j--) {
        const c = [...orden]
        c.splice(j, 0, c.splice(i, 1)[0])
        candidatos.push({ orden: c, desplazamiento: i - j })
      }
      for (let k = i - 1; k >= 0; k--) {
        if (resultado[k].estatus === 'tarde') continue
        const c = [...orden]
        c.splice(i, 0, c.splice(k, 1)[0])
        candidatos.push({ orden: c, desplazamiento: i - k })
      }
      let mejor = null
      for (const c of candidatos) {
        const res = simular(c.orden)
        const a = atraso(res)
        if (a < atrasoActual && (!mejor || a < mejor.atraso || (a === mejor.atraso && c.desplazamiento < mejor.desplazamiento))) {
          mejor = { orden: c.orden, res, atraso: a, desplazamiento: c.desplazamiento }
        }
      }
      if (!mejor) break
      orden = mejor.orden
      resultado = mejor.res
      atrasoActual = mejor.atraso
    }
    return resultado
  }

  let resultado = resolver()

  // Si esta semana te pasaste del presupuesto, el exceso se "paga" desplazando
  // primero a los Whimms SIN fecha límite, de menor score, que hoy ya se podían
  // comprar: vuelven a estar disponibles el lunes. Solo ellos; si el exceso es
  // mayor y toca a uno con fecha, `evaluarIntercambio` lo advierte.
  const exceso = Math.max(gastoSemanaReal(gastos, semanaInicio, hoyISO) - presupuestoDe(presupuestoSemanal), 0)
  if (exceso > 0) {
    const candidatos = resultado.filter((r) => r.estatus === 'comprable_hoy' && !r.fechaLimite).sort((a, b) => a.score - b.score)
    let cubierto = 0
    for (const c of candidatos) {
      if (cubierto >= exceso) break
      bloqueados.add(c.id)
      cubierto += c.faltante
    }
    if (bloqueados.size) resultado = resolver()
  }
  return resultado
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
// Ajustar saldo a mi banco: devuelve el monto (puede ser negativo) que hay que
// guardar como ajuste para que el saldo real del motor iguale al del banco.
// Pasa en `...params` los mismos datos que saldoRealEnBanco (incluidos los
// ajustes ya guardados). A futuro la conexión con Nu alimentará esto sola.
// ---------------------------------------------------------------------------
export function calcularAjusteSaldo({ saldoBancoReal, ...params }) {
  const actual = saldoRealEnBanco(params)
  return Math.round(((Number(saldoBancoReal) || 0) - actual) * 100) / 100
}

// ---------------------------------------------------------------------------
// Vitalls: próximos vencimientos (incluye MSI) en los siguientes `dias`, con
// las ocurrencias omitidas marcadas (para poder des-omitirlas desde la UI).
// ---------------------------------------------------------------------------
export function proximosVitalls({ pagosFijos, hoyISO, dias = 7 }) {
  const hasta = addDaysISO(hoyISO, dias)
  const items = []
  ;(pagosFijos || []).forEach((p) => {
    fechasVencimientoBase(p, hasta)
      .filter((f) => f >= hoyISO)
      .forEach((f) => {
        items.push({
          pagoId: p.id,
          name: p.name,
          tipo: p.tipo,
          fecha: f,
          monto: montoOcurrenciaPagoFijo(p, f),
          omitida: !!excepcionDe(p, f)?.omitida,
        })
      })
  })
  return items.sort((a, b) => compareISOAsc(a.fecha, b.fecha))
}

export function proximoIngresoISO({ sueldosFijos, sueldosRapidos, hoyISO }) {
  const horizonte = addDaysISO(hoyISO, 90)
  const fechas = []
  ;(sueldosFijos || []).forEach((s) => fechasPagoVivas(s, horizonte).filter((f) => f > hoyISO).forEach((f) => fechas.push(f)))
  ;(sueldosRapidos || []).forEach((r) => { if (r?.fecha && r.fecha > hoyISO && r.fecha <= horizonte) fechas.push(r.fecha) })
  return fechas.sort(compareISOAsc)[0] || null
}

// ---------------------------------------------------------------------------
// Widget Cajitas Nu (solo guía informativa, sin conexión bancaria).
//   - Cajita Vitalls: lo que vence (sin MSI) antes del siguiente cobro.
//   - Cajita Whimms: dinero libre para Whimms + mensualidades MSI antes del
//     siguiente cobro (el MSI sale de Whimms, nunca de Vitalls ni de Gastos).
//   - Saldo Principal: lo que queda, para gastos de la semana.
// ---------------------------------------------------------------------------
// "La quincena": el próximo cobro del sueldo fijo más grande (el principal).
export function proximoCobroPrincipalISO({ sueldosFijos, hoyISO }) {
  const horizonte = addDaysISO(hoyISO, 90)
  const candidatos = (sueldosFijos || [])
    .map((s) => ({ monto: Number(s.monto) || 0, fecha: ocurrenciasSueldo(s, horizonte, addDaysISO(hoyISO, 1)).find((o) => !o.omitida)?.fecha }))
    .filter((c) => c.fecha)
    .sort((a, b) => b.monto - a.monto)
  return candidatos[0]?.fecha || null
}

export function distribucionCajitas({ saldoReal, bolsaWhimms, pagosFijos, sueldosFijos, sueldosRapidos, hoyISO }) {
  const proximo = proximoCobroPrincipalISO({ sueldosFijos, hoyISO }) || proximoIngresoISO({ sueldosFijos, sueldosRapidos, hoyISO }) || addDaysISO(hoyISO, 30)
  const dueDeAntes = (pagosFijos || []).flatMap((p) =>
    fechasVencimientoVivas(p, addDaysISO(proximo, -1))
      .filter((f) => f > hoyISO)
      .map((f) => ({ msi: p?.tipo === 'MSI', monto: montoOcurrenciaPagoFijo(p, f) }))
  )
  const vitalls = dueDeAntes.filter((x) => !x.msi).reduce((sum, x) => sum + x.monto, 0)
  const msi = dueDeAntes.filter((x) => x.msi).reduce((sum, x) => sum + x.monto, 0)
  const whimms = Math.max(bolsaWhimms, 0) + msi
  return { cajitaVitalls: vitalls, cajitaWhimms: whimms, saldoPrincipal: saldoReal - vitalls - whimms, proximoCobro: proximo, dias: diasEntreISO(hoyISO, proximo) }
}

// ---------------------------------------------------------------------------
// Intercambio gasto semanal <-> Whimm. Gastar de más esta semana sale del
// dinero de Whimms, y lo primero que se desplaza es lo de menor prioridad.
//   - Whimm SIN fecha límite que se desplaza: está bien, no es urgente.
//   - Whimm CON fecha límite que quedaría tarde (o sin fecha segura):
//     ADVERTENCIA, no se puede intercambiar sin romper esa fecha.
//   - Whimm CON fecha límite que se retrasa pero sigue a tiempo: aviso suave.
// `gastoNuevo` = { monto, reembolso?, fecha, categoria? }; se compara la
// proyección antes y después de registrarlo.
// ---------------------------------------------------------------------------
export function evaluarIntercambio({ gastoNuevo, ...base }) {
  const antes = proyectarColaWhimms(base)
  const despues = proyectarColaWhimms({ ...base, gastos: [...(base.gastos || []), gastoNuevo] })
  const previo = new Map(antes.map((r) => [r.id, r]))
  const nombres = new Map((base.whimms || []).map((w) => [w.id, w.name || w.id]))

  const criticos = []
  const avisos = []
  const desplazados = []
  const intercambiados = []
  despues.forEach((r) => {
    const a = previo.get(r.id)
    if (!a) return
    const seRetrasa = r.fechaProyectada !== a.fechaProyectada && (!r.fechaProyectada || (a.fechaProyectada && r.fechaProyectada > a.fechaProyectada))
    if (!seRetrasa && !(r.intercambiado && !a.intercambiado)) return
    const item = {
      id: r.id,
      nombre: nombres.get(r.id),
      antes: a.fechaProyectada,
      despues: r.fechaProyectada,
      fechaLimite: r.fechaLimite,
      dejaDeSerComprableHoy: a.estatus === 'comprable_hoy',
    }
    if (r.intercambiado && !a.intercambiado) intercambiados.push(item)
    else if (!r.fechaLimite) desplazados.push(item)
    else if (r.estatus === 'tarde' || r.estatus === 'sin_fecha_segura') criticos.push(item)
    else avisos.push(item)
  })

  const presupuesto = presupuestoDe(base.presupuestoSemanal)
  const semanaInicio = startOfWeekISO(gastoNuevo?.fecha || base.hoyISO)
  const gastadoSemana = gastoSemanaReal([...(base.gastos || []), gastoNuevo], semanaInicio, addDaysISO(semanaInicio, 6))
  return {
    puedeIntercambiar: criticos.length === 0,
    criticos,
    avisos,
    desplazados,
    intercambiados,
    excedeSemana: Math.max(gastadoSemana - presupuesto, 0),
  }
}

// ---------------------------------------------------------------------------
// Impacto de agregar (o cambiar) un Whimm sobre el resto de la fila. Compara la
// proyección antes y después, igual que `evaluarIntercambio`:
//   - propio: cuándo se compraría este Whimm
//   - movidos: otros Whimms que se retrasan (sin fecha límite, o con ella pero a tiempo)
//   - criticos: Whimms con fecha límite que quedarían tarde por este
// `whimm` = el Whimm como quedaría; `whimmOriginal` = como está guardado (null si es nuevo).
// ---------------------------------------------------------------------------
export function evaluarImpactoWhimm({ whimm, whimmOriginal = null, ...base }) {
  const otros = (base.whimms || []).filter((w) => w.id !== whimm.id)
  const antes = proyectarColaWhimms({ ...base, whimms: whimmOriginal ? [...otros, whimmOriginal] : otros })
  const despues = proyectarColaWhimms({ ...base, whimms: [...otros, whimm] })
  const previo = new Map(antes.map((r) => [r.id, r]))
  const nombres = new Map(otros.map((w) => [w.id, w.name || w.id]))
  const propio = despues.find((r) => r.id === whimm.id)
  const propioAntes = whimmOriginal ? antes.find((r) => r.id === whimm.id) : null

  const movidos = []
  const criticos = []
  despues.forEach((r) => {
    const a = previo.get(r.id)
    if (!a || r.id === whimm.id) return
    const seRetrasa = r.fechaProyectada !== a.fechaProyectada && (!r.fechaProyectada || (a.fechaProyectada && r.fechaProyectada > a.fechaProyectada))
    if (!seRetrasa) return
    const item = {
      id: r.id,
      nombre: nombres.get(r.id),
      antes: a.fechaProyectada,
      despues: r.fechaProyectada,
      dias: a.fechaProyectada && r.fechaProyectada ? diasEntreISO(a.fechaProyectada, r.fechaProyectada) : null,
      fechaLimite: r.fechaLimite,
    }
    const tarde = r.estatus === 'tarde' || r.estatus === 'sin_fecha_segura'
    const yaEraTarde = a.estatus === 'tarde' || a.estatus === 'sin_fecha_segura'
    if (r.fechaLimite && tarde && !yaEraTarde) criticos.push(item)
    else movidos.push(item)
  })
  movidos.sort((x, y) => (y.dias ?? 9999) - (x.dias ?? 9999))
  return {
    propio: propio ? { fecha: propio.fechaProyectada, estatus: propio.estatus } : null,
    propioAntes: propioAntes ? { fecha: propioAntes.fechaProyectada, estatus: propioAntes.estatus } : null,
    movidos,
    criticos,
  }
}

// ---------------------------------------------------------------------------
// Ocurrencias (para Vitalls y Calendar): incluyen las omitidas, marcadas, para
// poder restaurarlas o cambiarles el monto.
// ---------------------------------------------------------------------------
export function ocurrenciasPagoFijo(pagoFijo, hastaISO, desdeISO) {
  return fechasVencimientoBase(pagoFijo, hastaISO)
    .filter((f) => !desdeISO || f >= desdeISO)
    .map((f) => ({ fecha: f, monto: montoOcurrenciaPagoFijo(pagoFijo, f), omitida: !!excepcionDe(pagoFijo, f)?.omitida }))
}

export function ocurrenciasSueldo(sueldo, hastaISO, desdeISO) {
  const fechaFin = sueldo?.fechaFin || null
  const fechas = calendarioDePagos(sueldo, hastaISO)
  return fechas
    .filter((f) => f && f <= hastaISO && (!fechaFin || f <= fechaFin) && (!desdeISO || f >= desdeISO))
    .sort(compareISOAsc)
    .map((f) => {
      const exc = excepcionDe(sueldo, f)
      // `pendiente`: marcado como "aún no llega" (no cuenta en el saldo hasta que llegue)
      return { fecha: f, monto: montoOcurrenciaSueldo(sueldo, f), omitida: !!exc?.omitida, pendiente: !!(exc?.omitida && exc?.pendiente) }
    })
}

// Cuántos pagos lleva un pago fijo/MSI y cuál es el siguiente.
export function progresoPagoFijo(pagoFijo, hoyISO) {
  const todas = fechasVencimientoBase(pagoFijo, addDaysISO(hoyISO, 3660))
  const vivas = todas.filter((f) => !excepcionDe(pagoFijo, f)?.omitida)
  return {
    total: pagoFijo?.finito ? Number(pagoFijo.numPagos) || 1 : null,
    pagados: vivas.filter((f) => f <= hoyISO).length,
    siguiente: vivas.find((f) => f > hoyISO) || null,
  }
}

// Fechas de pago de un sueldo fijo, SIEMPRE desde `fechaInicio` en adelante
// (la UI vieja generaba fechas anteriores al inicio y las contaba).
// Quincenal = días 15 y último de cada mes; Mensual = mismo día cada mes.
export function generarFechasPago({ frecuencia, fechaInicio, meses = 36 }) {
  const inicio = parseISODate(fechaInicio)
  if (!inicio) return []
  const fechas = []
  if (frecuencia === 'Semanal') {
    const fin = addMonthsISO(fechaInicio, meses)
    for (let f = fechaInicio; f <= fin; f = addDaysISO(f, 7)) fechas.push(f)
  } else if (frecuencia === 'Quincenal') {
    for (let k = 0; k <= meses; k++) {
      const y = inicio.getFullYear() + Math.floor((inicio.getMonth() + k) / 12)
      const m = (inicio.getMonth() + k) % 12
      fechas.push(toISO(new Date(y, m, 15)), toISO(new Date(y, m, daysInMonth(y, m))))
    }
  } else {
    for (let k = 0; k <= meses; k++) fechas.push(addMonthsISO(fechaInicio, k))
  }
  return [...new Set(fechas)].filter((f) => f >= fechaInicio).sort(compareISOAsc)
}
