import { Link } from 'react-router-dom'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconWarning, IconClock, IconCard, IconSalary, IconBars, IconChevronRight } from '../components/Icons'
import { fmtSigned } from '../lib/format'
import { useAuth } from '../lib/AuthContext'

// Datos de ejemplo — se reemplazan por sueldos y alertas reales en fases posteriores.
const PROXIMOS_SUELDOS = [
  { id: 1, name: 'Domingo de mi papá', date: '20 sep · en 3 días', amount: 200 },
  { id: 2, name: 'Sueldo principal', date: '30 sep · en 13 días', amount: 18000 },
]

const RIESGOS = [
  '3 Vitall vencen en los próximos 8 días ($968 en total)',
  'Meta "Fondo de emergencia" va 4% atrasada respecto al plan',
]

const LINKS = [
  { to: '/perfil/historial', Icon: IconClock, title: 'Historial completo', hint: 'Todo el desglose, filtrable' },
  { to: '/perfil/precios-fijos', Icon: IconCard, title: 'Precios fijos', hint: 'Todos tus pagos recurrentes' },
  { to: '/perfil/sueldos', Icon: IconSalary, title: 'Sueldos', hint: 'Sueldos fijos y sueldos rápidos' },
  { to: '/perfil/metricas', Icon: IconBars, title: 'Métricas', hint: 'Promedios, cantidades y gastos' },
]

export default function Perfil() {
  const { message, show } = useToast()
  const { user } = useAuth()

  const displayName = user?.displayName || 'Pame'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <h1>Perfil</h1>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Próximos sueldos</div>
            <Link to="/perfil/sueldos" style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Ver todos</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PROXIMOS_SUELDOS.map((s) => (
              <div key={s.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.date}</div>
                </div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>{fmtSigned(s.amount)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600 }}>
            {initial}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{displayName}</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>@pame_rod</div>
          </div>
        </div>

        <div style={{ background: 'var(--red-bg)', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <IconWarning />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Riesgos detectados</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RIESGOS.map((r) => (
              <div key={r} style={{ fontSize: 12, color: 'var(--text)' }}>{r}</div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Más métricas</div>
          <div className="row-list">
            {LINKS.map(({ to, Icon, title, hint }) => (
              <Link key={to} to={to} className="row-list-item">
                <div className="icon-tile" style={{ width: 36, height: 36 }}>
                  <Icon size={17} color="var(--wine)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{hint}</div>
                </div>
                <IconChevronRight />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Toast message={message} />
      <AddSheet onToast={show} />
    </div>
  )
}
