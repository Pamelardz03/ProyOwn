import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { IconBars, IconBell, IconCard, IconChevronRight, IconClock, IconEdit, IconPlus, IconSalary } from '../../components/Icons'
import { useAuth } from '../../lib/AuthContext'
import IconPaleta from '../components/IconPaleta'
import IconWidget from '../components/IconWidget'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { todayISO } from '../lib/budget'
import { calcularVistaInicio, fechaCorta, fmt } from '../lib/vista'

// Versión publicada (commit); sirve para saber si estás viendo lo último.
const VERSION = typeof __WHITAL_VERSION__ !== 'undefined' ? __WHITAL_VERSION__ : 'local'

const PESTANAS = [
  { to: '/perfil/historial', Icon: IconClock, titulo: 'Historial completo', pista: 'Todo lo registrado, filtrable' },
  { to: '/perfil/pagos-fijos', Icon: IconCard, titulo: 'Pagos fijos', pista: 'Todos tus pagos recurrentes' },
  { to: '/perfil/sueldos', Icon: IconSalary, titulo: 'Sueldos', pista: 'Sueldos fijos e ingresos rápidos' },
  { to: '/perfil/metricas', Icon: IconBars, titulo: 'Métricas', pista: 'Promedios, cantidades y gastos' },
  { to: '/perfil/agregar', Icon: IconPlus, titulo: 'Agregar', pista: 'Gasto, Whimm, Vitall, sueldo…' },
  { to: '/perfil/notificaciones', Icon: IconBell, titulo: 'Notificaciones', pista: 'Qué avisar y cada cuánto' },
  { to: '/perfil/temas', Icon: IconPaleta, titulo: 'Temas', pista: 'Paleta de colores y fondo' },
  { to: '/perfil/widget', Icon: IconWidget, titulo: 'Widget', pista: 'Código para la app de Android' },
  { to: '/perfil/configuracion', Icon: IconEdit, titulo: 'Configuración', pista: 'Saldo inicial y presupuesto' },
]

const etiqueta = { fontSize: 10, color: 'var(--muted)', fontWeight: 500 }
const cifra = { fontSize: 17, fontWeight: 500, marginTop: 4 }

export default function Perfil() {
  const { user, logout } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const hoy = todayISO()
  const vista = useMemo(() => (loading ? null : calcularVistaInicio(datos, hoy)), [datos, loading, hoy])
  const nombre = user?.displayName || 'Pame'

  // El saldo real se reparte en tres: lo libre para Whimms, lo reservado para Vitalls
  // y lo que queda para gastos hasta la quincena (el próximo cobro del sueldo principal).
  const c = vista?.cajitas
  const porDia = c ? c.saldoPrincipal / Math.max(c.dias, 1) : 0
  const metaDia = vista ? vista.presupuestoSemanal / 7 : 0
  // Lo que toca por día frente a tu presupuesto diario: Bajo (rojo), Medio o Alto.
  const nivel = porDia >= metaDia ? { texto: 'Alto', color: 'var(--green)' } : porDia >= metaDia * 0.7 ? { texto: 'Medio', color: 'var(--amber)' } : { texto: 'Bajo', color: 'var(--red)' }

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
                <div style={etiqueta}>Saldo real</div>
                <div className="mono" style={cifra}>{fmt(vista.saldoReal)}</div>
                <Link to="/perfil/configuracion" style={{ fontSize: 10, color: 'var(--acento)', fontWeight: 600, textDecoration: 'underline', marginTop: 2, display: 'inline-block' }}>Ajustar a mi banco</Link>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={etiqueta}>Para Whimms</div>
                <div className="mono" style={{ ...cifra, color: 'var(--wine4)' }}>{fmt(c.cajitaWhimms)}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={etiqueta}>Para Vitalls</div>
                <div className="mono" style={{ ...cifra, color: 'var(--wine3)' }}>{fmt(c.cajitaVitalls)}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={etiqueta}>Para gastos · hasta el {fechaCorta(c.proximoCobro)}</div>
                <div className="mono" style={{ ...cifra, color: nivel.color }}>{fmt(c.saldoPrincipal)}</div>
                <div style={{ fontSize: 10, color: nivel.color, marginTop: 2 }}>{fmt(Math.round(porDia))}/día · {nivel.texto}</div>
              </div>
            </div>
          </div>
        )}

        <div className="row-list">
          {PESTANAS.map(({ to, Icon, titulo, pista }) => (
            <Link key={to} to={to} className="row-list-item">
              <div className="icon-tile" style={{ width: 36, height: 36 }}>
                <Icon size={17} color="var(--acento)" />
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
