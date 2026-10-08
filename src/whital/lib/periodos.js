// Períodos de la pantalla Gastos (Día / Semana / Mes / Año) con navegación < >.
// Lógica pura: trabaja con fechas ISO "YYYY-MM-DD".
import { addDaysISO, addMonthsISO, parseISODate, startOfWeekISO, toISO } from './budget'

export const PERIODOS = ['dia', 'semana', 'mes', 'anio']
export const PERIODO_LABEL = { dia: 'Día', semana: 'Semana', mes: 'Mes', anio: 'Año' }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function corta(iso) {
  const d = parseISODate(iso)
  return d ? `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}` : ''
}

function addYearsISO(iso, n) {
  const d = parseISODate(iso)
  if (!d) return iso
  const y = d.getFullYear() + n
  const m = d.getMonth()
  return toISO(new Date(y, m, Math.min(d.getDate(), new Date(y, m + 1, 0).getDate())))
}

// Mueve la fecha de referencia un paso del período.
export function moverPeriodo(periodo, ref, delta) {
  if (periodo === 'dia') return addDaysISO(ref, delta)
  if (periodo === 'semana') return addDaysISO(ref, delta * 7)
  if (periodo === 'mes') return addMonthsISO(ref, delta)
  return addYearsISO(ref, delta)
}

// Rango [inicio, fin] (ambos incluidos) del período que contiene `ref`.
export function rangoPeriodo(periodo, ref) {
  if (periodo === 'dia') return { inicio: ref, fin: ref }
  if (periodo === 'semana') {
    const inicio = startOfWeekISO(ref)
    return { inicio, fin: addDaysISO(inicio, 6) }
  }
  const d = parseISODate(ref)
  if (periodo === 'mes') return { inicio: toISO(new Date(d.getFullYear(), d.getMonth(), 1)), fin: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
  return { inicio: `${d.getFullYear()}-01-01`, fin: `${d.getFullYear()}-12-31` }
}

// Texto de "Gastado en …".
export function etiquetaPeriodo(periodo, ref, hoy) {
  const actual = (p) => rangoPeriodo(p, hoy).inicio === rangoPeriodo(p, ref).inicio
  if (periodo === 'dia') return ref === hoy ? 'hoy' : corta(ref)
  if (periodo === 'semana') {
    if (actual('semana')) return 'esta semana'
    const { inicio, fin } = rangoPeriodo('semana', ref)
    return `${corta(inicio)} – ${corta(fin)}`
  }
  const d = parseISODate(ref)
  if (periodo === 'mes') return actual('mes') ? MESES[d.getMonth()] : `${MESES[d.getMonth()]} ${d.getFullYear()}`
  return String(d.getFullYear())
}
