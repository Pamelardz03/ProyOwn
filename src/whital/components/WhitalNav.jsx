import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { IconHome, IconReceipt, IconCalendar } from '../../components/Icons'
import IconCompras from './IconCompras'
import MenuAgregar from './MenuAgregar'
import { ultimaCompras } from '../lib/ultimaCompras'

const TAMANO_ICONO = 27
const INACTIVO = 'var(--muted)'
// --wine4 es el tono vivo de cada paleta (el acento es casi negro en los temas claros y se confundía con el inactivo).
const ACTIVO = 'var(--wine4)'

// Perfil ya no es una pestaña: se entra con la foto de la cuenta en Inicio.
const IZQUIERDA = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/gastos', label: 'Gastos', Icon: IconReceipt },
]
const DERECHA = [
  { to: '/whimms', label: 'Compras', Icon: IconCompras, compras: true },
  { to: '/calendar', label: 'Calendario', Icon: IconCalendar },
]

function IconMas() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
      <path d="M12 4.5v15M4.5 12h15" />
    </svg>
  )
}

export default function WhitalNav() {
  const { pathname } = useLocation()
  const [agregando, setAgregando] = useState(false)

  const pestana = ({ to, label, Icon, end, compras }) => (
    <NavLink key={to} to={compras ? ultimaCompras() : to} end={end}>
      {({ isActive }) => {
        const activo = compras ? pathname === '/whimms' || pathname === '/vitalls' : isActive
        const color = activo ? ACTIVO : INACTIVO
        return (
          <>
            <Icon size={TAMANO_ICONO} color={color} />
            <span style={{ color, fontWeight: activo ? 700 : 600 }}>{label}</span>
          </>
        )
      }}
    </NavLink>
  )

  return (
    <>
      <nav className="bottom-nav">
        {IZQUIERDA.map(pestana)}
        <span aria-hidden="true" />
        <button data-guia="mas" aria-label="Agregar" className="btn-mas" onClick={() => setAgregando(true)}>
          <IconMas />
        </button>
        {DERECHA.map(pestana)}
      </nav>
      <MenuAgregar abierto={agregando} onClose={() => setAgregando(false)} />
    </>
  )
}
