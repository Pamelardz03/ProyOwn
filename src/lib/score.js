// Fórmula de prioridad de Whimms — v1 simplificada (interina, sin calibrar
// con datos reales todavía; ver "Fórmula de prioridad" en el plan del
// proyecto). Usa necesidad/deseo (1-5) y el precio para ordenar la cola:
// más necesidad/deseo y menor precio = score más alto.
export function computeWhimmScore({ necesidad, deseo, precio }) {
  const n = Number(necesidad) || 3
  const d = Number(deseo) || 3
  const p = Math.max(Number(precio) || 1, 1)
  return (n * 2 + d) / Math.sqrt(p)
}
