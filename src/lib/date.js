// Helpers de fecha para datos reales (Firestore guarda fechas como texto
// ISO "YYYY-MM-DD" en un <input type="date">).

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function parseISODate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function formatShortDate(iso) {
  const date = parseISODate(iso)
  if (!date) return 'por definir'
  return `${date.getDate()} ${MESES[date.getMonth()]}`
}

// Días entre hoy y la fecha (redondeado, puede ser negativo si ya pasó).
export function daysUntil(iso) {
  const date = parseISODate(iso)
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.round((date - today) / 86400000)
}

export function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// --- Rangos de periodo (para agrupar Gastos por día/semana/mes/año) ---

function startOfDay(d) {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

// Semana de lunes a domingo.
function startOfWeek(d) {
  const c = startOfDay(d)
  const dow = c.getDay() // 0=domingo
  const diff = dow === 0 ? -6 : 1 - dow
  c.setDate(c.getDate() + diff)
  return c
}

export function isToday(iso) {
  const date = parseISODate(iso)
  if (!date) return false
  return startOfDay(date).getTime() === startOfDay(new Date()).getTime()
}

export function isThisWeek(iso) {
  const date = parseISODate(iso)
  if (!date) return false
  const start = startOfWeek(new Date())
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const d = startOfDay(date)
  return d >= start && d < end
}

export function isThisMonth(iso) {
  const date = parseISODate(iso)
  if (!date) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export function isThisYear(iso) {
  const date = parseISODate(iso)
  if (!date) return false
  return date.getFullYear() === new Date().getFullYear()
}

// Ordena fechas ISO de más reciente a más antigua (para listas de historial).
export function compareISODesc(a, b) {
  return (b || '').localeCompare(a || '')
}
