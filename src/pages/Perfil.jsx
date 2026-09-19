import { Link } from 'react-router-dom'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconWarning, IconClock, IconCard, IconSalary, IconBars, IconChevronRight } from '../components/Icons'
import { fmt, fmtSigned } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection } from '../lib/firestoreCollections'
import { daysUntil, formatShortDate, isThisMonth } from '../lib/date'
import { estimatePresupuestoDiarioNeto, proximaFechaSueldo } from '../lib/budget'

const LINKS = [
  { to: '/perfil/historial', Icon: IconClock, title: 'Historial completo', hint: 'Todo el desglose, filtrable' },
  { to: '/perfil/precios-fijos', Icon: IconCard, title: 'Precios fijos', hint: 'Todos tus pagos recurrentes' },
  { to: '/perfil/sueldos', Icon: IconSalary, title: 'Sueldos', hint: 'Sueldos fijos y sueldos rápidos' },
  { to: '/perfil/metricas', Icon: IconBars, title: 'Métricas', hint: 'Promedios, cantidades y gastos' },
]

export default function Perfil() {
  const { message, show } = useToast()
  const { user } = useAuth()

  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: pagosFijos } = useUserCollection('pagosFijos')

  const displayName = user?.displayName || 'Pame'
  const initial = displayName.charAt(0).toUpperCase()

  // Próximo pago real de cada sueldo fijo, calculado en vivo — los
  // sueldos fijos no tienen fecha de fin, así que se extiende la serie
  // hacia adelante en vez de depender solo de lo que ya se generó.
  const proximosSueldos = sueldosFijos
    .map((s) => {
      const proxima = proximaFechaSueldo(s)
      return proxima ? { id: s.id, name: s.name, fecha: proxima, monto: s.monto } : null
    })
    .filter(Boolean)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .slice(0, 4)

  // Riesgos reales: Vitall/pagos fijos que vencen pronto, y si lo que hay
  // que reservar cada día para pagos fijos ya supera el presupuesto diario
  // bruto (una versión simple de la futura alertaDeficit).
  const pagosActivos = pagosFijos.filter((p) => p.activo !== false)
  const proximosAVencer = pagosActivos.filter((p) => {
    const d = daysUntil(p.fecha)
    return d != null && d >= 0 && d <= 8
  })
  const sueldosRapidosMes = sueldosRapidos.filter((r) => isThisMonth(r.fecha)).reduce((s, r) => s + (Number(r.monto) || 0), 0)
  const presupuestoDiarioNeto = estimatePresupuestoDiarioNeto({ sueldosFijos, sueldosRapidosMes, pagosFijos })

  const riesgos = []
  if (proximosAVencer.length > 0) {
    const total = proximosAVencer.reduce((s, p) => s + (Number(p.monto) || 0), 0)
    riesgos.push(`${proximosAVencer.length} pago${proximosAVencer.length === 1 ? '' : 's'} fijo${proximosAVencer.length === 1 ? '' : 's'} vence${proximosAVencer.length === 1 ? '' : 'n'} en los próximos 8 días (${fmt(total)} en total)`)
  }
  if (presupuestoDiarioNeto <= 0 && pagosActivos.length > 0) {
    riesgos.push('Tus pagos fijos activos ya no dejan presupuesto diario libre este mes — revisa Precios fijos')
  }

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
            {proximosSueldos.map((s) => {
              const dias = daysUntil(s.fecha)
              return (
                <div key={s.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {formatShortDate(s.fecha)}{dias != null ? ` · en ${dias} día${dias === 1 ? '' : 's'}` : ''}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>{fmtSigned(s.monto)}</div>
                </div>
              )
            })}
            {proximosSueldos.length === 0 && <div className="empty-state">Sin sueldos fijos todavía</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600 }}>
            {initial}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{displayName}</div>
            {user?.email && <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{user.email}</div>}
          </div>
        </div>

        {riesgos.length > 0 && (
          <div style={{ background: 'var(--red-bg)', borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <IconWarning />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Riesgos detectados</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {riesgos.map((r) => (
                <div key={r} style={{ fontSize: 12, color: 'var(--text)' }}>{r}</div>
              ))}
            </div>
          </div>
        )}

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
