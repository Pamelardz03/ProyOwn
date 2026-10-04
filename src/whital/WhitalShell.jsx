import { Routes, Route, Navigate } from 'react-router-dom'
import WhitalNav from './components/WhitalNav'
import Gastos from './pages/Gastos'
import Inicio from './pages/Inicio'
import Pendiente from './pages/Pendiente'

// App Shell de Whital: navegación propia (Inicio | Gastos | Whimms | Vitalls |
// Calendar). Vive dentro del BrowserRouter de App.jsx; solo se renderiza para
// las cuentas del gate (src/whital/config.js). Las pantallas que faltan son
// placeholders hasta que se construyan una por una.
export default function WhitalShell() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/whimms" element={<Pendiente titulo="Whimms" texto="Aquí irán la fila por prioridad, Pagando (MSI), Comprados y las fechas proyectadas." />} />
        <Route path="/vitalls" element={<Pendiente titulo="Vitalls" texto="Aquí irán las suscripciones y los pagos a plazos, con omitir o cambiar el monto de una fecha." />} />
        <Route path="/calendar" element={<Pendiente titulo="Calendar" texto="Aquí irá el calendario de ingresos, compromisos y compras proyectadas." />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <WhitalNav />
    </div>
  )
}
