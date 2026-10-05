import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AvisosNotificaciones from './components/AvisosNotificaciones'
import Bienvenida from './components/Bienvenida'
import WhitalNav from './components/WhitalNav'
import { useTema } from './hooks/useTema'
import './whital.css'
import Calendar from './pages/Calendar'
import Gastos from './pages/Gastos'
import Historial from './pages/Historial'
import Inicio from './pages/Inicio'
import Perfil from './pages/Perfil'
import Agregar from './pages/perfil/Agregar'
import Configuracion from './pages/perfil/Configuracion'
import Apariencia from './pages/perfil/Apariencia'
import Metricas from './pages/perfil/Metricas'
import Notificaciones from './pages/perfil/Notificaciones'
import PagosFijos from './pages/perfil/PagosFijos'
import Sueldos from './pages/perfil/Sueldos'
import Widget from './pages/perfil/Widget'
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
  const tema = useTema()
  useEffect(() => {
    try {
      localStorage.setItem('whital:login', '1') // la próxima vez, el inicio de sesión ya es el de Whital
    } catch {
      /* sin almacenamiento */
    }
  }, [])
  return (
    <div className="app-shell whital" data-paleta={tema.paleta} data-fondo={tema.fondo}>
      <Bienvenida />
      <AvisosNotificaciones />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/gastos" element={<Gastos key={location.key} />} />
        <Route path="/whimms" element={<Whimms key={location.key} />} />
        <Route path="/vitalls" element={<Vitalls key={location.key} />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/perfil" element={<Perfil key={location.key} />} />
        <Route path="/perfil/historial" element={<Historial />} />
        <Route path="/perfil/pagos-fijos" element={<PagosFijos />} />
        <Route path="/perfil/sueldos" element={<Sueldos key={location.key} />} />
        <Route path="/perfil/metricas" element={<Metricas />} />
        <Route path="/perfil/notificaciones" element={<Notificaciones />} />
        <Route path="/perfil/agregar" element={<Agregar />} />
        <Route path="/perfil/configuracion" element={<Configuracion />} />
        <Route path="/perfil/apariencia" element={<Apariencia />} />
        <Route path="/perfil/widget" element={<Widget />} />
        <Route path="/ajustes" element={<Navigate to="/perfil" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <WhitalNav />
    </div>
  )
}
