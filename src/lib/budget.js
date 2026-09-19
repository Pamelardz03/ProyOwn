import { isThisMonth, todayISO, addDaysISO, extenderFechasPago } from './date'

// Un sueldo fijo no tiene fecha de fin — 2 años hacia adelante es más que
// suficiente para cualquier vista/paginación real de la app.
const HORIZONTE_DIAS_SUELDO = 730

// Serie de fechas de pago de un sueldo fijo, extendida hacia el futuro
// indefinidamente a partir de lo que ya se calculó/guardó (`fechasPago`, o
// `fecha` como respaldo para sueldos viejos que no tienen ese arreglo) —
// para que el sueldo siga "vivo" aunque ya pasó la ventana que se generó
// al darlo de alta o al validar sus fechas.
export function fechasPagoVivas(sueldo, hastaISO) {
  const base = Array.isArray(sueldo.fechasPago) && sueldo.fechasPago.length
    ? sueldo.fechasPago
    : sueldo.fecha ? [sueldo.fecha] : []
  if (base.length === 0) return []
  const hasta = hastaISO || addDaysISO(todayISO(), HORIZONTE_DIAS_SUELDO)
  return extenderFechasPago(sueldo.frecuencia, base, hasta)
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

const DIAS_CICLO = { Semanal: 7, Quincenal: 15, Mensual: 30 }

// Presupuesto diario neto "favorable" — ingreso mensual real ÷ 30, menos lo
// que hay que reservar cada día para servicios/pagos fijos activos. Es
// optimista: no resta gasto futuro (asume que no hay más gastos), tal como
// se pidió para proyectar la cola de Whimms.
export function estimatePresupuestoDiarioNeto({ sueldosFijos, sueldosRapidosMes, pagosFijos }) {
  const ingresoMensual = ingresosFijosDelMes(sueldosFijos) + (sueldosRapidosMes || 0)
  const presupuestoDiario = ingresoMensual / 30
  const reservaServiciosDiaria = (pagosFijos || [])
    .filter((p) => p.activo !== false)
    .reduce((sum, p) => sum + (Number(p.monto) || 0) / (DIAS_CICLO[p.frecuencia] || 30), 0)
  return Math.max(presupuestoDiario - reservaServiciosDiaria, 0)
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
