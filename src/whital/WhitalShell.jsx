import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AvisosNotificaciones from './components/AvisosNotificaciones'
import AvatarPerfil from './components/AvatarPerfil'
import AyudaPantalla from './components/AyudaPantalla'
import Bienvenida from './components/Bienvenida'
import PrimerosPasos from './components/PrimerosPasos'
import WhitalNav from './components/WhitalNav'
import { GuiaContext } from './hooks/useGuia'
import { useTema } from './hooks/useTema'
import { repintarBarra } from './lib/barra'
import { FONDOS, colorPerfil } from './lib/temas'
import './whital.css'
import Calendar from './pages/Calendar'
import Gastos from './pages/Gastos'
import Historial from './pages/Historial'
import Inicio from './pages/Inicio'
import Perfil from './pages/Perfil'
import Configuracion from './pages/perfil/Configuracion'
import Temas from './pages/perfil/Temas'
import Metricas from './pages/perfil/Metricas'
import Notificaciones from './pages/perfil/Notificaciones'
import PagosFijos from './pages/perfil/PagosFijos'
import Sueldos from './pages/perfil/Sueldos'
import Legal from './pages/perfil/Legal'
import Privacidad from './pages/perfil/Privacidad'
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
  const [guiaActiva, setGuiaActiva] = useState(false)
  // Las pantallas de Perfil llevan un fondo propio (tono claro del tema).
  const enPerfil = location.pathname.startsWith('/perfil')
  const fondoPerfil = enPerfil ? colorPerfil(tema.paleta, tema.fondo) : null
  // Chrome reinicia el color de la barra de estado al cambiar de pantalla: se vuelve a pintar.
  useEffect(() => {
    repintarBarra(fondoPerfil || FONDOS.find((f) => f.id === tema.fondo)?.barra || '#f3efe2')
  }, [location.pathname, tema.fondo, fondoPerfil])
  return (
    <GuiaContext.Provider value={{ activa: guiaActiva, setActiva: setGuiaActiva }}>
    <div className={`app-shell whital${enPerfil ? ' modo-perfil' : ''}`} data-paleta={tema.paleta} data-fondo={tema.fondo} style={fondoPerfil ? { background: fondoPerfil, '--perfil-bg': fondoPerfil } : undefined}>
      <Bienvenida />
      <PrimerosPasos />
      <AvisosNotificaciones />
      <AvatarPerfil />
      <AyudaPantalla />
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
        <Route path="/perfil/configuracion" element={<Configuracion />} />
        <Route path="/perfil/temas" element={<Temas />} />
        <Route path="/perfil/apariencia" element={<Navigate to="/perfil/temas" replace />} />
        <Route path="/perfil/widget" element={<Widget />} />
        <Route path="/perfil/privacidad" element={<Privacidad />} />
        <Route path="/perfil/terminos" element={<Legal id="terminos" />} />
        <Route path="/perfil/politica" element={<Legal id="privacidad" />} />
        <Route path="/ajustes" element={<Navigate to="/perfil" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!enPerfil && <WhitalNav />}
    </div>
    </GuiaContext.Provider>
  )
}
