import { useRef, useState } from 'react'

// Swipe-to-revelar (fila con botón de eliminar detrás) más ágil: sigue el
// dedo en vivo con onPointerMove en vez de solo decidir hasta el pointerUp
// — antes no había ninguna respuesta visual hasta soltar, lo que se sentía
// "tardado" aunque el swipe en sí funcionara. `width` es cuánto se revela
// (72 = ancho del botón de eliminar en el resto de la app). Un movimiento
// chico (<6px) se trata como tap y llama a `onTap` (o alterna abierto/
// cerrado si no se da `onTap`) en vez de exigir un arrastre completo.
export function useSwipeX({ isOpen, onChange, onTap, width = 72 }) {
  const startX = useRef(0)
  const dragging = useRef(false)
  const [dragX, setDragX] = useState(null)

  const baseX = isOpen ? -width : 0
  const x = dragX != null ? dragX : baseX

  function onPointerDown(e) {
    startX.current = e.clientX
    dragging.current = true
    setDragX(baseX)
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    const delta = e.clientX - startX.current
    setDragX(Math.min(0, Math.max(-width, baseX + delta)))
  }

  function onPointerUpOrCancel() {
    if (!dragging.current) return
    dragging.current = false
    const finalX = dragX != null ? dragX : baseX
    const totalDelta = finalX - baseX
    setDragX(null)
    if (Math.abs(totalDelta) < 6) {
      if (onTap) onTap()
      else onChange(!isOpen)
      return
    }
    onChange(finalX <= -width / 2)
  }

  return {
    x,
    dragging: dragX != null,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerUpOrCancel,
      onPointerCancel: onPointerUpOrCancel,
    },
  }
}
