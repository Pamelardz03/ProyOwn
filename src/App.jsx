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

function AppShell() {
  const location = useLocation()
  const showNav = MAIN_TABS.includes(location.pathname)

  return (
    <div className="app-shell">
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
