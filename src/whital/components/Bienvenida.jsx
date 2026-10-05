import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import '../loginWhital.css'
import LogoWhital from './LogoWhital'

// Saludo con el nombre, una vez por sesión (al abrir la app o iniciar sesión).
// Se quita solo; tocarlo lo cierra antes.
export default function Bienvenida() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(() => {
    try {
      if (sessionStorage.getItem('whital:saludo')) return false
      sessionStorage.setItem('whital:saludo', '1')
    } catch {
      /* sin almacenamiento: se saluda en cada carga */
    }
    return true
  })
  if (!visible) return null
  const nombre = (user?.displayName || '').split(' ')[0] || 'Pame'
  return (
    <div className="wl-saludo" onClick={() => setVisible(false)} onAnimationEnd={(e) => e.target === e.currentTarget && setVisible(false)}>
      <LogoWhital size={64} animado={false} />
      <div className="hola">Hola de nuevo</div>
      <div className="quien">{nombre}</div>
    </div>
  )
}
