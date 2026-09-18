import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../components/Icons'

// Datos de ejemplo — Fase 2/Fase 6 del roadmap alimentan esto con el historial real.
const ALL = [
  { day: 17, cat: 'compra', badge: 'Baja de precio', title: 'Sony WH-1000XM5 bajó de precio', amount: -300, dotColor: '#b8783f', date: '17 sep' },
  { day: 17, cat: 'servicio', badge: 'Notificación', title: 'Recordatorio enviado: Gym vence mañana', amount: null, dotColor: '#7a7156', date: '17 sep' },
  { day: 16, cat: 'servicio', badge: 'Vitall pagado', title: 'iCloud+ pagado', amount: -29, dotColor: '#7c8c5a', date: '16 sep' },
  { day: 16, cat: 'gasto', badge: 'Gasto', title: 'Ropa — shopping', amount: -899, dotColor: '#5c2536', date: '16 sep' },
  { day: 15, cat: 'nomina', badge: 'Nómina', title: 'Quincena depositada', amount: 18000, dotColor: '#3a0f1f', date: '15 sep' },
  { day: 15, cat: 'gasto', badge: 'Gasto', title: 'Gasolina — necesario', amount: -200, dotColor: '#5c2536', date: '15 sep' },
  { day: 12, cat: 'cambio', badge: 'Edición', title: 'Editaste el precio de "Suero Vitamina C"', amount: null, dotColor: '#7a7156', date: '12 sep' },
  { day: 12, cat: 'cambio', badge: 'Creación', title: 'Agregaste "Suero Vitamina C" a la lista', amount: null, dotColor: '#3f6b45', date: '12 sep' },
  { day: 10, cat: 'cambio', badge: 'Creación', title: 'Agregaste "Crema hidratante" a la lista', amount: null, dotColor: '#3f6b45', date: '10 sep' },
  { day: 8, cat: 'cambio', badge: 'Creación', title: 'Agregaste "Funda iPad" a la lista', amount: null, dotColor: '#3f6b45', date: '8 sep' },
  { day: 5, cat: 'cambio', badge: 'Creación', title: 'Agregaste "Set de brochas" a la lista', amount: null, dotColor: '#3f6b45', date: '5 sep' },
  { day: 1, cat: 'gasto', badge: 'Gasto', title: 'Renta — necesario', amount: -6500, dotColor: '#5c2536', date: '1 sep' },
  { day: 1, cat: 'gasto', badge: 'Gasto', title: 'Despensa — necesario', amount: -2800, dotColor: '#5c2536', date: '1 sep' },
]

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'gasto', label: 'Gastos' },
  { key: 'servicio', label: 'Vitall' },
  { key: 'compra', label: 'Whimm' },
  { key: 'nomina', label: 'Nómina' },
  { key: 'cambio', label: 'Cambios' },
]

export default function HistorialCompleto() {
  const [cat, setCat] = useState('todos')
  const [sort, setSort] = useState('fecha')

  let list = ALL.filter((e) => cat === 'todos' || e.cat === cat)
  list = sort === 'fecha'
    ? [...list].sort((a, b) => b.day - a.day)
    : [...list].sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))

  const items = list.map((e) => ({
    ...e,
    amountText: e.amount == null ? '—' : (e.amount > 0 ? '+$' : '-$') + Math.abs(e.amount).toLocaleString('es-MX'),
    amountColor: e.amount == null ? '#b3ad8e' : e.amount > 0 ? 'var(--green)' : 'var(--text)',
  }))

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/perfil" aria-label="Volver" className="back-btn">
            <IconChevronLeft />
          </Link>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Historial completo</div>
        </div>

        <div className="chiprow">
          {FILTERS.map((f) => (
            <span
              key={f.key}
              onClick={() => setCat(f.key)}
              className="pill"
              style={{ background: cat === f.key ? 'var(--wine)' : 'transparent', color: cat === f.key ? '#fff' : 'var(--muted)' }}
            >
              {f.label}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Ordenar por</span>
          <button
            onClick={() => setSort('fecha')}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: sort === 'fecha' ? 'var(--beige2)' : 'transparent', color: sort === 'fecha' ? 'var(--text)' : 'var(--muted)' }}
          >
            Fecha
          </button>
          <button
            onClick={() => setSort('precio')}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: sort === 'precio' ? 'var(--beige2)' : 'transparent', color: sort === 'precio' ? 'var(--text)' : 'var(--muted)' }}
          >
            Precio
          </button>
        </div>

        <div className="row-list">
          {items.map((it, i) => (
            <div key={i} className="row-list-item">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.dotColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: it.dotColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{it.badge}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{it.title}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: it.amountColor }}>{it.amountText}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{it.date}</div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="empty-state">Sin resultados para este filtro</div>}
        </div>
      </div>
    </div>
  )
}
