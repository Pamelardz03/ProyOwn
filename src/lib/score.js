// Fórmula de prioridad de Whimms — v2 (tanda 18, a pedido de Pame: con
// datos reales el precio le podía ganar a necesidad/deseo incluso en los
// extremos — un Whimm carísimo con necesidad/deseo al máximo podía perder
// contra uno baratísimo con necesidad/deseo al mínimo, solo por el precio).
// Antes se dividía por √precio; ahora por precio^0.25, un divisor mucho
// menos agresivo, para que necesidad/deseo pesen más frente al precio.
// Usa necesidad/deseo (1-5) y el precio para ordenar la cola: más
// necesidad/deseo y menor precio = score más alto.
export function computeWhimmScore({ necesidad, deseo, precio }) {
  const n = Number(necesidad) || 3
  const d = Number(deseo) || 3
  const p = Math.max(Number(precio) || 1, 1)
  return (n * 2 + d) / Math.pow(p, 0.25)
}
