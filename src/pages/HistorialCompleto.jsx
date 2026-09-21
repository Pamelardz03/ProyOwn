import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../components/Icons'
import { useUserCollection } from '../lib/firestoreCollections'
import { formatShortDate } from '../lib/date'
import { buildHistorialEvents } from '../lib/historial'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'gasto', label: 'Gastos' },
  { key: 'nomina', label: 'Sueldos' },
  { key: 'cambio', label: 'Cambios' },
]

export default function HistorialCompleto() {
  const [cat, setCat] = useState('todos')
  const [subcat, setSubcat] = useState('todos')
  const [sort, setSort] = useState('fecha')

  const { data: gastos } = useUserCollection('gastos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: whimms } = useUserCollection('whimms')

  const hoy = new Date().toISOString().slice(0, 10)

  const events = useMemo(
    () => buildHistorialEvents({ gastos, sueldosRapidos, sueldosFijos, pagosFijos, whimms, hoyISO: hoy }),
    [gastos, sueldosRapidos, sueldosFijos, pagosFijos, whimms, hoy]
  )

  const listByCat = events.filter((e) => cat === 'todos' || e.cat === cat)
  const availableSubcats = [...new Set(listByCat.map((e) => e.subcat).filter(Boolean))]
  let list = listByCat.filter((e) => subcat === 'todos' || e.subcat === subcat)
  list = sort === 'fecha'
    ? [...list].sort((a, b) => (b.dateISO < a.dateISO ? -1 : b.dateISO > a.dateISO ? 1 : 0))
    : [...list].sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))

  const items = list.map((e) => ({
    ...e,
    amountText: e.amount == null ? '—' : (e.amount > 0 ? '+$' : '-$') + Math.abs(e.amount).toLocaleString('es-MX'),
    amountColor: e.amount == null ? '#b3ad8e' : e.amount > 0 ? 'var(--green)' : 'var(--text)',
    dateLabel: formatShortDate(e.dateISO),
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
              onClick={() => { setCat(f.key); setSubcat('todos') }}
              className="pill"
              style={{ background: cat === f.key ? 'var(--wine)' : 'transparent', color: cat === f.key ? '#fff' : 'var(--muted)' }}
            >
              {f.label}
            </span>
          ))}
        </div>

        {availableSubcats.length > 0 && (
          <div className="chiprow">
            {['todos', ...availableSubcats].map((c) => (
              <span
                key={c}
                onClick={() => setSubcat(c)}
                className="pill"
                style={{ background: subcat === c ? 'var(--wine4)' : 'transparent', color: subcat === c ? '#fff' : 'var(--muted)', border: '1px solid var(--beige3)' }}
              >
                {c === 'todos' ? 'Todas las categorías' : c}
              </span>
            ))}
          </div>
        )}

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
          {items.map((it) => (
            <div key={it.id} className="row-list-item">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.dotColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: it.dotColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{it.badge}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{it.title}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: it.amountColor }}>{it.amountText}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{it.dateLabel}</div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="empty-state">Sin resultados para este filtro</div>}
        </div>
      </div>
    </div>
  )
}
