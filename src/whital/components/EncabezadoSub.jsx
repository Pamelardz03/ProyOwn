import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../../components/Icons'

// Encabezado de las pantallas que cuelgan de Perfil: flecha para volver + título.
export default function EncabezadoSub({ titulo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Link to="/perfil" aria-label="Volver" className="back-btn"><IconChevronLeft /></Link>
      <h1>{titulo}</h1>
    </div>
  )
}
