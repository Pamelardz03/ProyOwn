// Utilidades de tiempo para los avisos.

// Timestamp de Firestore, { seconds } o número -> milisegundos (0 si no hay).
export function aMillis(ts) {
  if (!ts) return 0
  if (typeof ts === 'number') return ts
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

export function textoTranscurrido(ms) {
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'menos de un minuto'
  if (min < 60) return `${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `${horas} h`
  const dias = Math.floor(horas / 24)
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}
