import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import LogoWhital from '../components/LogoWhital'
import '../loginWhital.css'

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.3 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5c-2 1.5-4.6 2.5-7.6 2.5-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.9 39.7 16.4 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.5 5.5C41.5 36.1 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  )
}

// Inicio de sesión de Whital: marca animada y un solo botón (Google).
export default function LoginWhital() {
  const { loginWithGoogle } = useAuth()
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  const entrar = async () => {
    setError(null)
    setCargando(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(`No se pudo iniciar sesión${err?.code ? ` (${err.code})` : ''}. ${err?.message || ''}`)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="wl-pantalla">
      <div className="wl-blob a" />
      <div className="wl-blob b" />
      <div className="wl-blob c" />
      <div className="wl-contenido">
        <LogoWhital size={84} />
        <div className="wl-nombre" aria-label="Whital">
          {'Whital'.split('').map((l, i) => (
            <span key={i} className="wl-letra" style={{ animationDelay: `${0.5 + i * 0.07}s` }}>{l}</span>
          ))}
        </div>
        <div className="wl-frase">Tu presupuesto, tus Whimms y tus Vitalls en un solo lugar.</div>
        <button className="btn-primary wl-boton" onClick={entrar} disabled={cargando}>
          <GoogleG />
          {cargando ? 'Conectando…' : 'Continuar con Google'}
        </button>
        {error && <div className="wl-error">{error}</div>}
      </div>
    </div>
  )
}
