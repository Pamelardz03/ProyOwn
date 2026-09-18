export function fmt(n) {
  const num = Number(n) || 0
  return '$' + Math.round(num).toLocaleString('es-MX')
}

export function fmtSigned(n) {
  const num = Number(n) || 0
  return (num >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(num)).toLocaleString('es-MX')
}
