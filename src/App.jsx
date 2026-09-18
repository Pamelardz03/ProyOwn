import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Gastos from './pages/Gastos'
import Compras from './pages/Compras'
import Calendario from './pages/Calendario'
import Perfil from './pages/Perfil'
import MetricasStats from './pages/MetricasStats'
import HistorialCompleto from './pages/HistorialCompleto'
import PreciosFijos from './pages/PreciosFijos'
import Sueldos from './pages/Sueldos'

// Las 5 pestañas principales muestran la barra inferior; las subpantallas de
// Perfil (que se abren con "Volver") no, igual que en el diseño original.
const MAIN_TABS = ['/', '/gastos', '/compras', '/calendario', '/perfil']

function LocalModeBanner() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, background: 'var(--amber)', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', padding: '6px 10px' }}>
      Modo local — falta configurar Firebase (.env.local) para guardar de verdad. Ver README.
    </div>
  )
}

function AppShell() {
  const location = useLocation()
  const showNav = MAIN_TABS.includes(location.pathname)
  const { firebaseReady } = useAuth()

  return (
    <div className="app-shell">
      {!firebaseReady && <LocalModeBanner />}
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/perfil/metricas" element={<MetricasStats />} />
        <Route path="/perfil/historial" element={<HistorialCompleto />} />
        <Route path="/perfil/precios-fijos" element={<PreciosFijos />} />
        <Route path="/perfil/sueldos" element={<Sueldos />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  )
}

function Gate() {
  const { user, loading, firebaseReady } = useAuth()

  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
      </div>
    )
  }

  // Sin Firebase configurado no hay con qué hacer login — se deja ver la app
  // igual (con datos de ejemplo) para poder revisar el diseño de una vez.
  if (firebaseReady && !user) {
    return (
      <div className="app-shell">
        <Login />
      </div>
    )
  }

  return <AppShell />
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
