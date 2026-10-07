// Compara un desbalance (lo que difiere tu banco de la app) con el de tus ajustes anteriores.
// Función PURA. `ajuste` = banco - app: negativo = la app tiene de más; positivo = la app tiene de menos.
const UMBRAL_ALTO = 2 // más de 2 veces el promedio ya se considera muy alto

export function evaluarDesbalance(ajuste, ajustesPrevios) {
  const monto = Math.abs(ajuste)
  const previos = (ajustesPrevios || []).map((a) => Math.abs(Number(a?.monto) || 0)).filter((m) => m >= 0.005)
  const promedio = previos.length ? previos.reduce((s, m) => s + m, 0) / previos.length : null
  const causa = ajuste < 0
    ? 'La app tiene de más: probablemente falta registrar un gasto o un pago.'
    : 'La app tiene de menos: probablemente falta registrar un ingreso o sobró un gasto.'
  if (promedio == null) return { monto, promedio, nivel: 'sin-historial', causa }
  const nivel = monto <= promedio ? 'normal' : monto <= promedio * UMBRAL_ALTO ? 'arriba' : 'muy-arriba'
  return { monto, promedio, nivel, causa, ajustes: previos.length }
}
