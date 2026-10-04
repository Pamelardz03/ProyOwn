import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { IconBars, IconCard, IconChevronRight, IconClock, IconEdit, IconPlus, IconSalary } from '../../components/Icons'
import { useAuth } from '../../lib/AuthContext'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { todayISO } from '../lib/budget'
import { calcularVistaInicio, fmt } from '../lib/vista'

// Versión publicada (commit); sirve para saber si estás viendo lo último.
const VERSION = typeof __WHITAL_VERSION__ !== 'undefined' ? __WHITAL_VERSION__ : 'local'

const PESTANAS = [
  { to: '/perfil/historial', Icon: IconClock, titulo: 'Historial completo', pista: 'Todo lo registrado, filtrable' },
  { to: '/perfil/pagos-fijos', Icon: IconCard, titulo: 'Pagos fijos', pista: 'Todos tus pagos recurrentes' },
  { to: '/perfil/sueldos', Icon: IconSalary, titulo: 'Sueldos', pista: 'Sueldos fijos e ingresos rápidos' },
  { to: '/perfil/metricas', Icon: IconBars, titulo: 'Métricas', pista: 'Promedios, cantidades y gastos' },
  { to: '/perfil/agregar', Icon: IconPlus, titulo: 'Agregar', pista: 'Gasto, Whimm, Vitall, sueldo…' },
  { to: '/perfil/configuracion', Icon: IconEdit, titulo: 'Configuración', pista: 'Saldo inicial, presupuesto y recordatorios' },
]

export default function Perfil() {
  const { user, logout } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const hoy = todayISO()
  const vista = useMemo(() => (loading ? null : calcularVistaInicio(datos, hoy)), [datos, loading, hoy])
  const nombre = user?.displayName || 'Pame'

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <h1>Perfil</h1>
        {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
        {loading && !error && <div className="empty-state">Cargando…</div>}

        {vista && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Métricas principales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Saldo real</div>
                <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{fmt(vista.saldoReal)}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Libre para Whimms</div>
                <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: 'var(--wine4)' }}>{fmt(vista.bolsas.bolsaWhimms)}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Reservado para Vitalls</div>
                <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: 'var(--wine3)' }}>{fmt(vista.cajitas.cajitaVitalls)}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{vista.bolsas.disponibleSemana < 0 ? 'Te pasaste esta semana' : 'Disponible esta semana'}</div>
                <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: vista.bolsas.disponibleSemana < 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(Math.abs(vista.bolsas.disponibleSemana))}</div>
              </div>
            </div>
          </div>
        )}

        <div className="row-list">
          {PESTANAS.map(({ to, Icon, titulo, pista }) => (
            <Link key={to} to={to} className="row-list-item">
              <div className="icon-tile" style={{ width: 36, height: 36 }}>
                <Icon size={17} color="var(--wine)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{pista}</div>
              </div>
              <IconChevronRight />
            </Link>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Cuenta</div>
          <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" style={{ width: 52, height: 52, borderRadius: 26, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, flexShrink: 0 }}>{nombre.charAt(0).toUpperCase()}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{nombre}</div>
              {user?.email && <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>}
            </div>
            <button onClick={() => logout()} style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Cerrar sesión</button>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)' }}>Whital · versión {VERSION}</div>
      </div>
    </div>
  )
}
