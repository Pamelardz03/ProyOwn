import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { IconInfo } from '../components/Icons'

export default function Login() {
  const { loginWithGoogle } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  async function handleLogin() {
    setError(null)
    setLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      // Se muestra el código real del error (ej. auth/unauthorized-domain)
      // para poder diagnosticar sin tener que abrir la consola del navegador.
      setError(`No se pudo iniciar sesión${err?.code ? ` (${err.code})` : ''}. ${err?.message || ''}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center', textAlign: 'center' }}>
        {/* Espacio reservado para el nombre de la persona (a pedido de
            Pame, vigésima sexta tanda: "Deja arriba espacio para el
            nombre, aún no tiene") — todavía no se captura ni se muestra
            nada real aquí, es solo el lugar donde va a vivir cuando se
            implemente (probablemente tomado del perfil de Google al
            iniciar sesión por primera vez). */}
        <div style={{ width: '100%', minHeight: 34 }} />

        <div className="hero" style={{ width: '100%', padding: '32px 22px' }}>
          <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 500 }}>Organizador de</div>
          <div style={{ fontSize: 28, fontWeight: 600, marginTop: 2 }}>Gastos</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10, lineHeight: 1.5 }}>
            Tu presupuesto diario, tus Whimms y tus Vitall en un solo lugar.
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: loading ? 0.7 : 1 }}
        >
          <GoogleG />
          {loading ? 'Conectando…' : 'Continuar con Google'}
        </button>

        <button
          aria-label="Por qué solo Google"
          onClick={() => setShowInfo((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0 }}
        >
          <IconInfo size={13} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>¿Por qué solo con Google?</span>
        </button>
        {showInfo && (
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginTop: -10 }}>
            Solo se puede entrar con una cuenta de Google: así no se guarda ninguna
            contraseña propia de la app (más seguro) y tu información financiera
            queda ligada únicamente a tu cuenta de Google, no a un usuario/contraseña
            que alguien más podría adivinar o reutilizar.
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
      </div>
    </div>
  )
}

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
