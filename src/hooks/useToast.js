import { useCallback, useRef, useState } from 'react'

// Muestra un mensaje corto (como los toasts del mockup) y lo oculta solo tras
// ~1.2s (23 sep: antes 2.2s, más abajo en pantalla y más rápido a pedido de
// Pame, para que estorbe menos).
export function useToast() {
  const [message, setMessage] = useState(null)
  const timer = useRef(null)

  const show = useCallback((msg) => {
    clearTimeout(timer.current)
    setMessage(msg)
    timer.current = setTimeout(() => setMessage(null), 1200)
  }, [])

  return { message, show }
}
