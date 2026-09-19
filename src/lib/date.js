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

// --- Generación de fechas de pago (sueldos fijos) ---
// Dado un frecuencia y una fecha "ancla" (el último día de pago que ya
// recibió o el próximo que espera), genera la serie de fechas de pago
// para poder validarlas/editarlas antes de guardar (feriados, domingos, etc.)

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function toISO(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDaysISO(iso, days) {
  const date = parseISODate(iso)
  if (!date) return iso
  date.setDate(date.getDate() + days)
  return toISO(date)
}

// Nombre corto del día de la semana, para marcar en la UI si una fecha
// calculada cae domingo (o cualquier día) y así facilitar corregirla a mano.
export function weekdayShort(iso) {
  const date = parseISODate(iso)
  if (!date) return ''
  return ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][date.getDay()]
}

export function isSunday(iso) {
  const date = parseISODate(iso)
  return !!date && date.getDay() === 0
}

// Quincenal real (México): día 15 y último día de cada mes — no cada 15 días
// exactos, porque los meses no tienen 30 días parejos.
function fechasQuincenal(anclaDate, meses) {
  const out = []
  let y = anclaDate.getFullYear()
  let m = anclaDate.getMonth()
  for (let i = 0; i < meses; i++) {
    const dia15 = new Date(y, m, 15)
    const diaUltimo = new Date(y, m, daysInMonth(y, m))
    out.push(toISO(dia15), toISO(diaUltimo))
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return out
}

function fechasSemanal(anclaDate, ocurrencias) {
  const out = []
  const d = new Date(anclaDate)
  for (let i = 0; i < ocurrencias; i++) {
    out.push(toISO(d))
    d.setDate(d.getDate() + 7)
  }
  return out
}

function fechasMensual(anclaDate, ocurrencias) {
  const out = []
  const diaObjetivo = anclaDate.getDate()
  let y = anclaDate.getFullYear()
  let m = anclaDate.getMonth()
  for (let i = 0; i < ocurrencias; i++) {
    const dia = Math.min(diaObjetivo, daysInMonth(y, m))
    out.push(toISO(new Date(y, m, dia)))
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return out
}

// Genera (y ordena) las fechas de pago a partir de una fecha ancla, para
// mostrarlas en el paso "Validar fechas" antes de guardar el sueldo fijo.
export function generarFechasPago(frecuencia, anclaISO) {
  const ancla = parseISODate(anclaISO) || new Date()
  let fechas
  if (frecuencia === 'Semanal') fechas = fechasSemanal(ancla, 10)
  else if (frecuencia === 'Mensual') fechas = fechasMensual(ancla, 4)
  else fechas = fechasQuincenal(ancla, 4) // Quincenal (default)
  return [...new Set(fechas)].sort(compareISOAsc)
}

export function compareISOAsc(a, b) {
  return (a || '').localeCompare(b || '')
}

// --- Días feriados oficiales (México, Art. 74 LFT) ---
// Solo los de descanso obligatorio con fecha fija o "enésimo lunes del
// mes" — no incluye el traspaso de poder ejecutivo (1 vez cada 6 años).
function nthWeekdayOfMonth(year, monthIndex, weekday, n) {
  const first = new Date(year, monthIndex, 1)
  const firstWeekday = first.getDay()
  return 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7
}

function feriadosMX(year) {
  const pad = (n) => String(n).padStart(2, '0')
  const iso = (monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`
  return new Set([
    iso(0, 1), // Año Nuevo
    iso(1, nthWeekdayOfMonth(year, 1, 1, 1)), // 1er lunes de feb — Constitución
    iso(2, nthWeekdayOfMonth(year, 2, 1, 3)), // 3er lunes de mar — natalicio Juárez
    iso(4, 1), // Día del Trabajo
    iso(8, 16), // Independencia
    iso(10, nthWeekdayOfMonth(year, 10, 1, 3)), // 3er lunes de nov — Revolución
    iso(11, 25), // Navidad
  ])
}

export function isFeriadoMX(iso) {
  const date = parseISODate(iso)
  if (!date) return false
  return feriadosMX(date.getFullYear()).has(iso)
}
