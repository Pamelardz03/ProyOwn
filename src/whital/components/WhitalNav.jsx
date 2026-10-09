import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { IconHome, IconReceipt, IconCalendar } from '../../components/Icons'
import IconCompras from './IconCompras'
import MenuAgregar from './MenuAgregar'
import { ultimaCompras } from '../lib/ultimaCompras'

const TAMANO_ICONO = 27
const INACTIVO = 'var(--muted)'
// La pestaña activa lleva una píldora del color de la paleta (--wine) con el ícono en blanco: el cambio de color solo
// no bastaba, el tono vivo de algunas paletas oscuras casi no se distingue del gris inactivo.
const ICONO_ACTIVO = '#fff'

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
        const color = activo ? ICONO_ACTIVO : INACTIVO
        return (
          <>
            <div style={{ padding: '4px 16px', borderRadius: 16, background: activo ? 'var(--wine)' : 'transparent', display: 'flex' }}>
              <Icon size={TAMANO_ICONO} color={color} />
            </div>
            <span style={{ color: activo ? 'var(--text)' : INACTIVO, fontWeight: activo ? 700 : 600 }}>{label}</span>
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
