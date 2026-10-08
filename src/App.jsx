import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginWhital from './whital/pages/LoginWhital'
import WhitalShell from './whital/WhitalShell'

// Puerta de entrada: cargando -> login (Google) -> app. Sin Firebase configurado
// (falta .env.local, ver README) el login avisa al intentar entrar.
function Gate() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-shell">
        <LoginWhital />
      </div>
    )
  }

  return <WhitalShell />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  )
}
