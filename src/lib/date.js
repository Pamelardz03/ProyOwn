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
