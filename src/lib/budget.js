import { isThisMonth, todayISO, addDaysISO, extenderFechasPago, compareISOAsc, daysUntil } from './date'

// Un sueldo fijo no tiene fecha de fin por default — 2 años hacia adelante
// es más que suficiente para cualquier vista/paginación real de la app.
const HORIZONTE_DIAS_SUELDO = 730

// Serie de fechas de pago de un sueldo fijo, extendida hacia el futuro
// indefinidamente a partir de lo que ya se calculó/guardó (`fechasPago`, o
// `fecha` como respaldo para sueldos viejos que no tienen ese arreglo) —
// para que el sueldo siga "vivo" aunque ya pasó la ventana que se generó
// al darlo de alta o al validar sus fechas. Si el sueldo se "detuvo" (tiene
// `fechaFin`, ver removeFijo en Sueldos.jsx), no se generan ni se muestran
// fechas después de esa fecha — pero las anteriores siguen contando para
// el historial/ingresos ya ocurridos.
export function fechasPagoVivas(sueldo, hastaISO) {
  const base = Array.isArray(sueldo.fechasPago) && sueldo.fechasPago.length
    ? sueldo.fechasPago
    : sueldo.fecha ? [sueldo.fecha] : []
  if (base.length === 0) return []
  let hasta = hastaISO || addDaysISO(todayISO(), HORIZONTE_DIAS_SUELDO)
  if (sueldo.fechaFin && sueldo.fechaFin < hasta) hasta = sueldo.fechaFin
  const fechas = extenderFechasPago(sueldo.frecuencia, base, hasta)
  return sueldo.fechaFin ? fechas.filter((f) => f <= sueldo.fechaFin) : fechas
}

// La próxima fecha de pago real (hoy o después) de un sueldo fijo —
// reemplaza leer el campo `fecha` guardado en el documento, que se calculó
// una sola vez al dar de alta el sueldo y se queda obsoleto con el tiempo.
export function proximaFechaSueldo(sueldo, hoyISO) {
  const hoy = hoyISO || todayISO()
  const fechas = fechasPagoVivas(sueldo)
  return fechas.find((f) => f >= hoy) || null
}

// --- Ingresos mensuales reales (no mensualizado ciego) ---
// Sueldos fijos sin ninguna fecha guardada (caso extremo, no debería
// pasar) caen al estimado mensualizado como respaldo.
function monthlyEqSueldoLegacy(s) {
  const monto = Number(s.monto) || 0
  if (s.frecuencia === 'Semanal') return monto * 4.33
  if (s.frecuencia === 'Quincenal') return monto * 2.166
  return monto
}

// Cuánto de un sueldo fijo ya se pagó en lo que va del mes actual — cuenta
// cualquier fecha de pago (fechasPagoVivas, incluye la fecha "anterior" que
// se haya declarado como ancla) que ya ocurrió este mes. Antes se excluían
// las fechas previas a `fechaInicio` (la fecha en que se dio de alta el
// sueldo), pero eso descartaba pagos que el usuario declaró explícitamente
// como ya ocurridos (p. ej. "el pago anterior fue el 15"), dando $0 cuando
// el sueldo se agregaba o editaba el mismo día que un pago ya vencido.
export function ingresoDelMesSueldo(s) {
  const hoy = todayISO()
  const fechas = fechasPagoVivas(s)
  if (!fechas.length) return monthlyEqSueldoLegacy(s)
  const ocurridos = fechas.filter((f) => isThisMonth(f) && f <= hoy)
  return ocurridos.length * (Number(s.monto) || 0)
}

export function ingresosFijosDelMes(sueldosFijos) {
  return sueldosFijos.reduce((sum, s) => sum + ingresoDelMesSueldo(s), 0)
}

export function monthlyEqPagoFijo(p) {
  const monto = Number(p.monto) || 0
  return p.frecuencia === 'Semanal' ? monto * 4.33 : monto
}

// --- Reserva real por vencimiento próximo (20 sep, novena tanda) ---
// Reemplaza el promedio fijo por ciclo (monto/30 días sin importar cuándo
// vence de verdad) que había antes: ahora cada pago fijo/Vitall activo
// exige juntar monto/díasRestantes cada día hasta su PRÓXIMO vencimiento
// real, en vez de una reserva constante. Así un pago grande que se acerca
// "pesa" más en el presupuesto diario mientras más cerca está — si debo
// $900 y faltan 4 días, son $225/día esos 4 días, no un promedio parejo
// todo el mes.
export function reservasDiariasPagosFijos(pagosFijos, hoyISO) {
  const hoy = hoyISO || todayISO()
  return (pagosFijos || [])
    .filter((p) => p.activo !== false)
    .map((p) => {
      const vencimiento = proximoVencimientoPagoFijo(p, hoy)
      if (!vencimiento) return null
      const dias = Math.max(daysUntil(vencimiento), 1)
      const monto = Number(p.monto) || 0
      return { pago: p, vencimiento, dias, monto, reservaDiaria: monto / dias }
    })
    .filter(Boolean)
}

export function presupuestoDiarioBruto({ sueldosFijos, sueldosRapidosMes }) {
  const ingresoMensual = ingresosFijosDelMes(sueldosFijos) + (sueldosRapidosMes || 0)
  return ingresoMensual / 30
}

// Presupuesto diario neto "favorable" — bruto menos la reserva diaria REAL
// de cada pago fijo activo (ver reservasDiariasPagosFijos arriba, novena
// tanda) en vez del promedio por ciclo que usaba antes esta misma función.
// Es optimista: no resta gasto futuro (asume que no hay más gastos), tal
// como se pidió para proyectar la cola de Whimms.
export function estimatePresupuestoDiarioNeto({ sueldosFijos, sueldosRapidosMes, pagosFijos }) {
  const bruto = presupuestoDiarioBruto({ sueldosFijos, sueldosRapidosMes })
  const reservaTotal = reservasDiariasPagosFijos(pagosFijos).reduce((s, r) => s + r.reservaDiaria, 0)
  return Math.max(bruto - reservaTotal, 0)
}

// Riesgos reales de flujo (novena tanda): ¿el presupuesto diario bruto
// alcanza para juntar a tiempo TODAS las reservas diarias activas? Se
// ordenan por fecha más próxima primero (el más urgente reserva primero
// del presupuesto disponible); si en algún punto la reserva acumulada ya
// supera el bruto, ese pago (y los que sigan en la fila) quedan en riesgo
// real de no juntarse a tiempo al ritmo actual — no un aviso genérico de
// "hay pagos pronto", sino cuánto exactamente falta por día.
export function detectarRiesgosPagosFijos({ sueldosFijos, sueldosRapidosMes, pagosFijos }) {
  const bruto = presupuestoDiarioBruto({ sueldosFijos, sueldosRapidosMes })
  const ordenados = [...reservasDiariasPagosFijos(pagosFijos)].sort((a, b) => a.dias - b.dias)
  let acumReserva = 0
  const riesgos = []
  ordenados.forEach((r) => {
    acumReserva += r.reservaDiaria
    if (acumReserva > bruto) {
      riesgos.push({
        nombre: r.pago.name,
        monto: r.monto,
        vencimiento: r.vencimiento,
        dias: r.dias,
        reservaDiaria: r.reservaDiaria,
        faltante: Math.round((acumReserva - bruto) * r.dias),
      })
    }
  })
  return riesgos
}

// --- Saldo libre acumulado real (novena tanda) ---
// A diferencia de "Saldo del mes" (que se reinicia cada mes), este es
// histórico: todo lo que se ha recibido (sueldos fijos + rápidos) menos
// todo lo que se ha gastado (Gastos), pagado (vencimientos de pagos
// fijos/Vitall ya ocurridos) y comprado (Whimms marcados "comprado") desde
// que hay datos en la cuenta. Sube los días que no se gasta todo el
// presupuesto, baja los que sí — es la fuente real detrás de las barras de
// progreso de los Whimms.
export function totalIngresosHasta(sueldosFijos, sueldosRapidos, hoyISO) {
  const hoy = hoyISO || todayISO()
  const fijos = (sueldosFijos || []).reduce((sum, s) => sum + fechasPagoVivas(s).filter((f) => f <= hoy).length * (Number(s.monto) || 0), 0)
  const rapidos = (sueldosRapidos || []).reduce((sum, r) => (r.fecha && r.fecha <= hoy ? sum + (Number(r.monto) || 0) : sum), 0)
  return fijos + rapidos
}

export function totalGastosHasta(gastos, hoyISO) {
  const hoy = hoyISO || todayISO()
  return (gastos || []).reduce((sum, g) => (g.fecha && g.fecha <= hoy ? sum + (Number(g.monto) || 0) : sum), 0)
}

export function totalVencimientosHasta(pagosFijos, hoyISO) {
  const hoy = hoyISO || todayISO()
  return (pagosFijos || [])
    .filter((p) => p.activo !== false)
    .reduce((sum, p) => sum + fechasVencimientoVivas(p).filter((f) => f <= hoy).length * (Number(p.monto) || 0), 0)
}

export function totalWhimmsCompradosHasta(whimms) {
  return (whimms || []).filter((w) => w.estado === 'comprado').reduce((sum, w) => sum + (Number(w.precio) || 0), 0)
}

export function saldoLibreAcumuladoReal({ sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, hoyISO }) {
  const hoy = hoyISO || todayISO()
  return (
    totalIngresosHasta(sueldosFijos, sueldosRapidos, hoy) -
    totalGastosHasta(gastos, hoy) -
    totalVencimientosHasta(pagosFijos, hoy) -
    totalWhimmsCompradosHasta(whimms)
  )
}

// Del saldo acumulado real, cuánto NO se le puede prestar a los Whimms
// porque ya está comprometido con el próximo vencimiento de cada pago fijo
// activo (se reserva el monto COMPLETO del siguiente ciclo de cada uno,
// no solo la fracción diaria) — así un pago grande que ya está "cerca" no
// se lo come la wishlist antes de que llegue su fecha.
export function reservaInmediataPagosFijos(pagosFijos, hoyISO) {
  return reservasDiariasPagosFijos(pagosFijos, hoyISO).reduce((sum, r) => sum + r.monto, 0)
}

export function disponibleParaWhimms(params) {
  const saldo = saldoLibreAcumuladoReal(params)
  const reserva = reservaInmediataPagosFijos(params.pagosFijos, params.hoyISO)
  return Math.max(saldo - reserva, 0)
}

// Reparte el saldo disponible entre los primeros `n` Whimms activos (ya
// ordenados por prioridad/score), proporcional al score de cada uno — a
// pedido de Pame, para que varios avancen a la vez en vez de que todo el
// excedente vaya solo al #1 hasta completarlo. Cuando el #1 se completa (o
// se marca comprado), su lugar lo toma el siguiente de la fila la próxima
// vez que se calcule esto — no hace falta ningún ajuste manual.
export function asignarSaldoWhimms(whimmsActivosOrdenados, saldoDisponible, n) {
  const top = (whimmsActivosOrdenados || []).slice(0, Math.max(Number(n) || 1, 1))
  const disponible = Math.max(Number(saldoDisponible) || 0, 0)
  const scoreTotal = top.reduce((s, w) => s + Math.max(w.score ?? w._score ?? 0, 0.01), 0)
  return top.map((w) => {
    const score = Math.max(w.score ?? w._score ?? 0, 0.01)
    const acumuladoAutomatico = scoreTotal > 0 ? (disponible * score) / scoreTotal : 0
    return { ...w, acumuladoAutomatico }
  })
}

// Cascada de fechas proyectadas: el Whimm top de la cola acumula el
// presupuestoDiarioNeto hasta poder comprarse; el excedente sigue
// acumulando para el siguiente, y así con el resto de la fila.
export function proyectarColaWhimms(whimmsOrdenados, presupuestoDiarioNeto) {
  let diasAcum = 0
  return whimmsOrdenados.map((w) => {
    const precio = Number(w.precio) || 0
    const dias = presupuestoDiarioNeto > 0 ? Math.ceil(precio / presupuestoDiarioNeto) : null
    diasAcum += dias || 0
    return { ...w, fechaProyectada: dias != null ? addDaysISO(todayISO(), diasAcum) : null }
  })
}


// --- Vencimientos de pagos fijos (Vitall/Vivienda/Transporte/Deuda) ---
// Igual idea que fechasPagoVivas para sueldos: a partir de una fecha ancla
// guardada (`fecha`) y la frecuencia, se extiende hacia el futuro de forma
// indefinida (o hasta `numPagos` si el pago fijo es finito), en vez de
// depender de un campo `fecha` estático que se queda obsoleto en cuanto
// pasa esa fecha.
const HORIZONTE_DIAS_PAGOFIJO = 365

export function fechasVencimientoVivas(pagoFijo, hastaISO) {
  if (!pagoFijo.fecha) return []
  const hasta = hastaISO || addDaysISO(todayISO(), HORIZONTE_DIAS_PAGOFIJO)
  let fechas = extenderFechasPago(pagoFijo.frecuencia, [pagoFijo.fecha], hasta)
  if (pagoFijo.finito && pagoFijo.numPagos) {
    fechas = [...fechas].sort(compareISOAsc).slice(0, Number(pagoFijo.numPagos) || fechas.length)
  }
  return fechas
}

// El próximo vencimiento (hoy o después) de un pago fijo — reemplaza leer
// el campo `fecha` estático, que nunca avanzaba de un ciclo al siguiente.
export function proximoVencimientoPagoFijo(pagoFijo, hoyISO) {
  const hoy = hoyISO || todayISO()
  const fechas = fechasVencimientoVivas(pagoFijo)
  return fechas.find((f) => f >= hoy) || null
}
