import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../components/Icons'
import { useUserCollection } from '../lib/firestoreCollections'
import { formatShortDate } from '../lib/date'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'gasto', label: 'Gastos' },
  { key: 'nomina', label: 'Sueldos' },
  { key: 'cambio', label: 'Cambios' },
]

const GASTO_DOT = { Whimm: '#8c5a6e', Vitall: '#5c2536' }

// Convierte un timestamp de Firestore (serverTimestamp resuelto) a una
// fecha ISO "YYYY-MM-DD" para poder ordenarlo junto con las fechas de
// texto que ya usan gastos/sueldos/pagos.
function msFromTimestamp(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

function isoFromTimestamp(ts) {
  const ms = msFromTimestamp(ts)
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

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

  const events = useMemo(() => {
    const out = []

    gastos.forEach((g) => {
      out.push({
        id: `gasto-${g.id}`,
        cat: 'gasto',
        subcat: g.categoria === 'Whimm'
          ? (g.categoriaWhimm || '')
          : g.categoria === 'Vitall'
            ? (g.vitallNombre || '')
            : '',
        badge: g.categoria || 'Gasto',
        title: g.concepto || 'Gasto',
        amount: -(Number(g.monto) || 0),
        dotColor: GASTO_DOT[g.categoria] || GASTO_DOT.Whimm,
        dateISO: g.fecha || '',
      })
    })

    sueldosRapidos.forEach((r) => {
      out.push({
        id: `rapido-${r.id}`,
        cat: 'nomina',
        badge: 'Sueldo rápido',
        title: r.desc || 'Sueldo rápido',
        amount: Number(r.monto) || 0,
        dotColor: '#3a0f1f',
        dateISO: r.fecha || '',
      })
    })

    sueldosFijos.forEach((s) => {
      const fechas = Array.isArray(s.fechasPago) ? s.fechasPago : []
      fechas
        .filter((f) => f && f <= hoy)
        .forEach((f) => {
          out.push({
            id: `fijo-${s.id}-${f}`,
            cat: 'nomina',
            badge: 'Sueldos',
            title: `${s.name || 'Sueldo fijo'} depositado`,
            amount: Number(s.monto) || 0,
            dotColor: '#3a0f1f',
            dateISO: f,
          })
        })
    })

    pagosFijos.forEach((p) => {
      out.push({
        id: `pagofijo-${p.id}`,
        cat: 'cambio',
        subcat: p.tipo || '',
        badge: 'Registro',
        title: `Agregaste "${p.name || 'pago'}" como ${p.tipo === 'Vitall' ? 'Vitall' : 'pago fijo'}`,
        amount: null,
        dotColor: '#7a7156',
        dateISO: isoFromTimestamp(p.creadoEn),
      })
    })

    whimms.forEach((w) => {
      out.push({
        id: `whimm-${w.id}`,
        cat: 'cambio',
        subcat: w.categoria || '',
        badge: 'Creación',
        title: `Agregaste "${w.name || 'un Whimm'}" a la lista`,
        amount: null,
        dotColor: '#3f6b45',
        dateISO: isoFromTimestamp(w.creadoEn),
      })
    })

    return out.filter((e) => e.dateISO)
  }, [gastos, sueldosRapidos, sueldosFijos, pagosFijos, whimms, hoy])

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
