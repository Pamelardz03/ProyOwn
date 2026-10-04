import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AvisoRecordatorio from './components/AvisoRecordatorio'
import WhitalNav from './components/WhitalNav'
import Calendar from './pages/Calendar'
import Gastos from './pages/Gastos'
import Historial from './pages/Historial'
import Inicio from './pages/Inicio'
import Perfil from './pages/Perfil'
import Vitalls from './pages/Vitalls'
import Whimms from './pages/Whimms'

// App Shell de Whital: navegación propia (Inicio | Gastos | Whimms | Vitalls |
// Calendar). Vive dentro del BrowserRouter de App.jsx; solo se renderiza para
// las cuentas del gate (src/whital/config.js).
// Atajos del launcher (manifest.webmanifest > shortcuts): abren la raíz con
// ?ir=gastos&nuevo=1. Se resuelven aquí, navegando por dentro de la app, porque
// un enlace directo a /gastos da 404 en GitHub Pages.
const DESTINOS_ATAJO = ['gastos', 'whimms', 'vitalls', 'calendar', 'perfil']

function useAtajoDelLauncher() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const destino = params.get('ir')
    if (!destino) return
    navigate(DESTINOS_ATAJO.includes(destino) ? `/${destino}` : '/', { replace: true, state: { nuevo: params.get('nuevo') === '1' } })
  }, [location.search, navigate])
}

export default function WhitalShell() {
  useAtajoDelLauncher()
  const location = useLocation()
  return (
    <div className="app-shell">
      <AvisoRecordatorio />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/gastos" element={<Gastos key={location.key} />} />
        <Route path="/whimms" element={<Whimms key={location.key} />} />
        <Route path="/vitalls" element={<Vitalls key={location.key} />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/perfil/historial" element={<Historial />} />
        <Route path="/ajustes" element={<Navigate to="/perfil" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <WhitalNav />
    </div>
  )
}
