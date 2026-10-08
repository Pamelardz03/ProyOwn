import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

// Dibuja a sus hijos dentro de la pantalla activa (el contenedor con scroll), no encima de la app:
// así se quedan arriba de la página y se van con ella al hacer scroll, sin flotar sobre el contenido.
export default function EnPantalla({ children }) {
  const { key } = useLocation()
  const [pantalla, setPantalla] = useState(null)
  // La pantalla es un elemento del DOM que cambia con la ruta: se vuelve a buscar en cada navegación.
  useLayoutEffect(() => {
    const buscar = () => setPantalla(document.querySelector('.app-shell .screen'))
    buscar()
  }, [key])
  return pantalla ? createPortal(children, pantalla) : null
}
