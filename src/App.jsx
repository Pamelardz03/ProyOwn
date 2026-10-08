import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import DocumentoLegal from './whital/components/DocumentoLegal'
import { useTema } from './whital/hooks/useTema'
import { DOCUMENTOS } from './whital/lib/legal'
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

// Términos y política vistos desde el login (sin sesión), con el tema guardado en el dispositivo.
function LegalPublico({ id }) {
  const tema = useTema()
  return (
    <div className="app-shell whital" data-paleta={tema.paleta} data-fondo={tema.fondo}>
      <div className="screen" style={{ paddingBottom: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" aria-label="Volver" className="back-btn">‹</Link>
            <h1>{DOCUMENTOS[id].titulo}</h1>
          </div>
          <DocumentoLegal id={id} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/terminos" element={<LegalPublico id="terminos" />} />
          <Route path="/politica" element={<LegalPublico id="privacidad" />} />
          <Route path="*" element={<Gate />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
