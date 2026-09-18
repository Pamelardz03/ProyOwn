import { useCallback, useRef, useState } from 'react'

// Muestra un mensaje corto (como los toasts del mockup) y lo oculta solo tras ~2.2s.
export function useToast() {
  const [message, setMessage] = useState(null)
  const timer = useRef(null)

  const show = useCallback((msg) => {
    clearTimeout(timer.current)
    setMessage(msg)
    timer.current = setTimeout(() => setMessage(null), 2200)
  }, [])

  return { message, show }
}
