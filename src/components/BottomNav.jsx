import { NavLink } from 'react-router-dom'
import { IconHome, IconReceipt, IconBag, IconCalendar, IconPerson } from './Icons'

const ITEMS = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/gastos', label: 'Gastos', Icon: IconReceipt },
  { to: '/compras', label: 'Compras', Icon: IconBag },
  { to: '/calendario', label: 'Calendario', Icon: IconCalendar },
  { to: '/perfil', label: 'Perfil', Icon: IconPerson },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end}>
          {({ isActive }) => (
            <>
              <Icon color={isActive ? '#3a0f1f' : '#b3ad8e'} />
              <span style={{ color: isActive ? '#3a0f1f' : '#b3ad8e' }}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
