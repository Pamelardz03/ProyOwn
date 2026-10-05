import { NavLink, useLocation } from 'react-router-dom'
import { IconHome, IconReceipt, IconCalendar, IconPerson } from '../../components/Icons'
import IconCompras from './IconCompras'
import { ultimaCompras } from '../lib/ultimaCompras'

const ITEMS = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/gastos', label: 'Gastos', Icon: IconReceipt },
  { to: '/whimms', label: 'Compras', Icon: IconCompras, compras: true },
  { to: '/calendar', label: 'Calendario', Icon: IconCalendar },
  { to: '/perfil', label: 'Perfil', Icon: IconPerson },
]

export default function WhitalNav() {
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ to, label, Icon, end, compras }) => (
        <NavLink key={to} to={compras ? ultimaCompras() : to} end={end}>
          {({ isActive }) => {
            const activo = compras ? pathname === '/whimms' || pathname === '/vitalls' : isActive
            const color = activo ? 'var(--acento)' : 'var(--beige4)'
            return (
              <>
                <Icon color={color} />
                <span style={{ color }}>{label}</span>
              </>
            )
          }}
        </NavLink>
      ))}
    </nav>
  )
}
