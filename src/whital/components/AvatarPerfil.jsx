import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

// Foto de la cuenta fija arriba a la izquierda en todas las pantallas: lleva a Perfil.
// Solo en las pantallas principales (Gastos, Compras, Calendario); en Inicio ya va junto al saludo
// y en Perfil y sus subpantallas no se muestra.
const PRINCIPALES = ['/gastos', '/whimms', '/vitalls', '/calendar']

export default function AvatarPerfil() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  if (!PRINCIPALES.includes(pathname)) return null
  const inicial = (user?.displayName || 'P').charAt(0).toUpperCase()
  return (
    <Link to="/perfil" aria-label="Mi perfil" className="btn-avatar">
      {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : inicial}
    </Link>
  )
}
