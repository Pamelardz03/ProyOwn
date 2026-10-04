// Recordatorio de "registra tus gastos". Lógica pura (sin React ni Firebase).
//
// Regla: toca avisar cuando pasó `cadaMin` desde lo más reciente entre el último
// gasto registrado y el último aviso. Así el aviso se repite cada `cadaMin`
// hasta que registres algo, y si abres la app tarde te avisa al entrar.

export const CADENCIA_DEFAULT_MIN = 360

export const OPCIONES_RECORDATORIO = [
  { min: 0, label: 'Nunca' },
  { min: 1, label: 'Cada minuto (exagerado)' },
  { min: 5, label: 'Cada 5 minutos' },
  { min: 15, label: 'Cada 15 minutos' },
  { min: 30, label: 'Cada 30 minutos' },
  { min: 60, label: 'Cada hora' },
  { min: 180, label: 'Cada 3 horas' },
  { min: 360, label: 'Cada 6 horas' },
  { min: 720, label: 'Cada 12 horas' },
  { min: 1440, label: 'Cada día' },
  { min: 2880, label: 'Cada 2 días' },
]

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

export function decidirRecordatorio({ ahora, cadaMin, ultimoRegistro, ultimoAviso }) {
  if (!(cadaMin > 0)) return { debe: false }
  const base = Math.max(ultimoRegistro || 0, ultimoAviso || 0)
  const vence = base + cadaMin * 60000
  if (ahora < vence) return { debe: false, faltaMs: vence - ahora }
  return { debe: true, texto: `Llevas ${textoTranscurrido(ahora - (ultimoRegistro || ahora))} sin registrar gastos. ¿Se te pasó alguno?` }
}
