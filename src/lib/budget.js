import { isThisMonth, todayISO, addDaysISO } from './date'

// --- Ingresos mensuales reales (no mensualizado ciego) ---
// Sueldos fijos nuevos (con fechasPago + fechaInicio) solo cuentan las
// fechas de pago que ya ocurrieron este mes desde que se registraron.
// Sueldos fijos viejos (sin fechasPago, agregados antes de este cambio)
// caen al estimado mensualizado como respaldo.
function monthlyEqSueldoLegacy(s) {
  const monto = Number(s.monto) || 0
  if (s.frecuencia === 'Semanal') return monto * 4.33
  if (s.frecuencia === 'Quincenal') return monto * 2.166
  return monto
}

export function ingresosFijosDelMes(sueldosFijos) {
  const hoy = todayISO()
  return sueldosFijos.reduce((sum, s) => {
    if (Array.isArray(s.fechasPago) && s.fechasPago.length) {
      const inicio = s.fechaInicio || s.fechasPago[0]
      const ocurridos = s.fechasPago.filter((f) => isThisMonth(f) && f <= hoy && f >= inicio)
      return sum + ocurridos.length * (Number(s.monto) || 0)
    }
    return sum + monthlyEqSueldoLegacy(s)
  }, 0)
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
