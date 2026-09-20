import { useRef, useState } from 'react'

// Umbral de movimiento (px) antes de decidir si el gesto es un swipe
// horizontal o un scroll vertical de la lista. Mientras no se supere en
// ningún eje, no se decide nada todavía (podría ser un tap).
const LOCK_THRESHOLD = 8

// Swipe-to-revelar (fila con botón de eliminar detrás) más ágil: sigue el
// dedo en vivo con onPointerMove en vez de solo decidir hasta el pointerUp.
// Distingue swipe horizontal de scroll vertical comparando cuánto se movió
// en X vs en Y apenas se supera `LOCK_THRESHOLD` — una vez que el gesto se
// "traba" como scroll, se deja de mover la fila por el resto del gesto (el
// scroll nativo de la lista sigue funcionando normal, no se le hace nada).
// Antes solo se miraba el delta en X sin importar cuánto se movió en Y, así
// que un scroll vertical con el mínimo movimiento lateral abría el botón de
// eliminar — de ahí que se sintiera "muy sensible".
// `width` es cuánto se revela (72 = ancho del botón de eliminar en el resto
// de la app). Un movimiento que nunca superó el umbral se trata como tap y
// llama a `onTap` (o alterna abierto/cerrado si no se da `onTap`).
export function useSwipeX({ isOpen, onChange, onTap, width = 72 }) {
  const startX = useRef(0)
  const startY = useRef(0)
  const dragging = useRef(false)
  const lock = useRef('none') // 'none' | 'swipe' | 'scroll'
  const [dragX, setDragX] = useState(null)

  const baseX = isOpen ? -width : 0
  const x = dragX != null ? dragX : baseX

  function onPointerDown(e) {
    startX.current = e.clientX
    startY.current = e.clientY
    dragging.current = true
    lock.current = 'none'
    setDragX(baseX)
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (lock.current === 'none') {
      if (Math.abs(dx) > LOCK_THRESHOLD || Math.abs(dy) > LOCK_THRESHOLD) {
        lock.current = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll'
      } else {
        return
      }
    }

    if (lock.current !== 'swipe') return // es scroll vertical: se deja pasar, no se arrastra la fila

    setDragX(Math.min(0, Math.max(-width, baseX + dx)))
  }

  function onPointerUpOrCancel() {
    if (!dragging.current) return
    dragging.current = false
    const wasSwipe = lock.current === 'swipe'
    const wasScroll = lock.current === 'scroll'
    lock.current = 'none'

    if (wasScroll) {
      setDragX(null)
      return // fue un scroll vertical: no abre ni cierra nada
    }

    const finalX = dragX != null ? dragX : baseX
    const totalDelta = finalX - baseX
    setDragX(null)

    if (!wasSwipe || Math.abs(totalDelta) < 6) {
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
