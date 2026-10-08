import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import EnPantalla from './EnPantalla'

// Foto de la cuenta fija arriba a la izquierda en todas las pantallas: lleva a Perfil.
// Un solo tamaño y lugar (a la altura del "?"), solo en las pantallas principales: Inicio, Gastos,
// Compras y Calendario. En Perfil y sus subpantallas no se muestra.
const PRINCIPALES = ['/', '/gastos', '/whimms', '/vitalls', '/calendar']

export default function AvatarPerfil() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  if (!PRINCIPALES.includes(pathname)) return null
  const inicial = (user?.displayName || 'P').charAt(0).toUpperCase()
  return (
    <EnPantalla>
      <Link to="/perfil" aria-label="Mi perfil" className="btn-avatar" data-guia="avatar">
        {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : inicial}
      </Link>
    </EnPantalla>
  )
}
