import { useEffect, useRef } from 'react'

// Hace que el botón/gesto de "atrás" del teléfono cierre un sheet/modal
// en vez de saltarse toda la página hasta la ruta real anterior
// (trigésima quinta tanda, a pedido de Pame: "cuando le doy back en mi
// telefono en el detalle de producto whimm de whishlist me manda a
// gastos" -- el sheet nunca empujaba una entrada al historial del
// navegador, así que "atrás" hacía lo que siempre hace un navegador sin
// esto: ignorar por completo que había un sheet abierto).
//
// Uso: en el componente que ya tiene su propio estado abierto/cerrado
// (ej. `const [detailId, setDetailId] = useState(null)`), agregar una
// sola línea:
//   useBackableSheet(!!detailId, () => setDetailId(null))
// No hace falta cambiar ningún otro lugar donde ya se abre/cierra el
// sheet (botón "X", click en el fondo, guardar, eliminar, etc.) -- el
// hook solo observa cuándo `isOpen` cambia y reacciona.
export function useBackableSheet(isOpen, close) {
  const pushedRef = useRef(false)

  // Cuando el sheet se abre, empuja una entrada nueva al historial (sin
  // cambiar la URL visible). Cuando se cierra desde la UI (no por el
  // botón de atrás), "gasta" esa entrada con history.back() -- si no, la
  // próxima vez que el usuario presione atrás de verdad no haría nada
  // visible, y se necesitaría una segunda pulsación para salir de la
  // página real.
  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      window.history.pushState({ sheetAbierto: true }, '')
      pushedRef.current = true
    } else if (!isOpen && pushedRef.current) {
      pushedRef.current = false
      window.history.back()
    }
  }, [isOpen])

  // Cuando el botón/gesto de atrás real dispara un popstate mientras el
  // sheet está abierto, se cierra el sheet en vez de dejar que el
  // navegador siga su comportamiento normal de cambiar de página.
  useEffect(() => {
    const onPopState = () => {
      if (pushedRef.current) {
        pushedRef.current = false
        close()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
