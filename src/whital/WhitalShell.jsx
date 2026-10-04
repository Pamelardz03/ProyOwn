import { Routes, Route, Navigate } from 'react-router-dom'
import WhitalNav from './components/WhitalNav'
import Ajustes from './pages/Ajustes'
import Calendar from './pages/Calendar'
import Gastos from './pages/Gastos'
import Inicio from './pages/Inicio'
import Vitalls from './pages/Vitalls'
import Whimms from './pages/Whimms'

// App Shell de Whital: navegación propia (Inicio | Gastos | Whimms | Vitalls |
// Calendar). Vive dentro del BrowserRouter de App.jsx; solo se renderiza para
// las cuentas del gate (src/whital/config.js).
export default function WhitalShell() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/whimms" element={<Whimms />} />
        <Route path="/vitalls" element={<Vitalls />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <WhitalNav />
    </div>
  )
}
