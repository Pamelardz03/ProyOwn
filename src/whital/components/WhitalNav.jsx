import { NavLink } from 'react-router-dom'
import { IconHome, IconReceipt, IconBag, IconVitall, IconCalendar } from '../../components/Icons'

const ITEMS = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/gastos', label: 'Gastos', Icon: IconReceipt },
  { to: '/whimms', label: 'Whimms', Icon: IconBag },
  { to: '/vitalls', label: 'Vitalls', Icon: IconVitall },
  { to: '/calendar', label: 'Calendario', Icon: IconCalendar },
]

export default function WhitalNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end}>
          {({ isActive }) => {
            const color = isActive ? '#3a0f1f' : '#b3ad8e'
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
