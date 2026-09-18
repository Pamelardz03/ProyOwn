import { useState } from 'react'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { fmt } from '../lib/format'

const DUE_SERVICIO = { border: '2px solid #7c8c5a', color: '#7c8c5a', fontWeight: 600 }
const DUE_COMPRA = { border: '2px solid #b8783f', color: '#b8783f', fontWeight: 600 }
const DUE_NOMINA = { border: '2px solid #3a0f1f', color: '#3a0f1f', fontWeight: 600 }
const REM_SERVICIO = { background: '#dde3c8', color: '#7c8c5a', fontWeight: 600 }
const DUE_REM_SERVICIO = { border: '2px solid #7c8c5a', background: '#dde3c8', color: '#1a1208', fontWeight: 600 }
const DUE_SERVICIO_REM_COMPRA = { border: '2px solid #7c8c5a', background: '#ecdfc7', color: '#1a1208', fontWeight: 600 }
const TODAY_STYLE = { background: '#3a0f1f', color: '#fff', fontWeight: 700 }

function buildDays(leading, total, special) {
  const arr = []
  for (let i = 0; i < leading; i++) arr.push(null)
  for (let d = 1; d <= total; d++) arr.push({ day: d, style: special[d] || {} })
  while (arr.length % 7 !== 0) arr.push(null)
  return arr
}

const AUG_SPECIAL = { 31: DUE_NOMINA }
const SEP_SPECIAL = { 16: REM_SERVICIO, 17: TODAY_STYLE, 18: DUE_REM_SERVICIO, 20: DUE_SERVICIO, 23: REM_SERVICIO, 25: DUE_SERVICIO_REM_COMPRA, 27: DUE_COMPRA, 30: DUE_NOMINA }
const OCT_SPECIAL = { 15: DUE_NOMINA }

const MONTHS = [
  { name: 'Agosto 2026', days: buildDays(6, 31, AUG_SPECIAL) },
  { name: 'Septiembre 2026', days: buildDays(2, 30, SEP_SPECIAL) },
  { name: 'Octubre 2026', days: buildDays(4, 31, OCT_SPECIAL) },
]

// Datos de ejemplo — Fase 6 del roadmap calcula estos eventos a partir de
// Vitalls, Whimms y sueldos reales guardados en Firestore.
const EVENTS = [
  { id: 1, cat: 'servicio', title: 'Vencimiento — Gym', date: '18 sep', amount: '$650', amountColor: '#1a1208', dotColor: '#7c8c5a', reminder: 'Recordatorio · 16 sep', remBg: '#dde3c8' },
  { id: 2, cat: 'servicio', title: 'Vencimiento — Netflix', date: '20 sep', amount: '$219', amountColor: '#1a1208', dotColor: '#7c8c5a', reminder: 'Recordatorio · 18 sep', remBg: '#dde3c8' },
  { id: 3, cat: 'servicio', title: 'Vencimiento — Spotify', date: '25 sep', amount: '$99', amountColor: '#1a1208', dotColor: '#7c8c5a', reminder: 'Recordatorio · 23 sep', remBg: '#dde3c8' },
  { id: 4, cat: 'compra', title: 'Sony WH-1000XM5 disponible', date: '27 sep', amount: '$7,499', amountColor: '#1a1208', dotColor: '#b8783f', reminder: 'Recordatorio · 25 sep', remBg: '#ecdfc7' },
  { id: 5, cat: 'nomina', title: 'Quincena depositada', date: '30 sep', amount: '+$18,000', amountColor: '#3f6b45', dotColor: '#3a0f1f', reminder: null, remBg: '' },
]

const COLA_WHIMM = [
  { rank: 1, name: 'Sony WH-1000XM5', hint: '10 días de ahorro · desbloquea 27 sep', price: 7499 },
  { rank: 2, name: 'Suero Vitamina C', hint: '1 día de ahorro · desbloquea 28 sep', price: 450 },
]

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'servicio', label: 'Vitall' },
  { key: 'compra', label: 'Whimm' },
  { key: 'nomina', label: 'Nómina' },
]

export default function Calendario() {
  const [monthIdx, setMonthIdx] = useState(1)
  const [eventFilter, setEventFilter] = useState('todos')
  const { message, show } = useToast()

  const month = MONTHS[monthIdx]
  const events = EVENTS.filter((e) => eventFilter === 'todos' || e.cat === eventFilter)

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1>Calendario</h1>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              aria-label="Mes anterior"
              onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
              style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: monthIdx > 0 ? 1 : 0.35 }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 4.5 6 10l6.5 5.5" /></svg>
            </button>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{month.name}</div>
            <button
              aria-label="Mes siguiente"
              onClick={() => setMonthIdx((i) => Math.min(2, i + 1))}
              style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: monthIdx < 2 ? 1 : 0.35 }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5l5 5.5-5 5.5" /></svg>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, fontSize: 10, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>
            {['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {month.days.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                {d && (
                  <span className="mono" style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontSize: 12, ...d.style }}>
                    {d.day}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--beige2)' }}>
            <LegendItem color="var(--wine)" solid label="Nómina" />
            <LegendItem color="var(--wine4)" label="Vitall" />
            <LegendItem color="var(--amber)" label="Whimm" />
            <LegendItem color="#dde3c8" solid label="Recordatorio" />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Próximos eventos</div>
          <div className="chiprow" style={{ marginBottom: 12 }}>
            {FILTERS.map((f) => (
              <span
                key={f.key}
                onClick={() => setEventFilter(f.key)}
                className="pill"
                style={{ background: eventFilter === f.key ? 'var(--wine)' : 'transparent', color: eventFilter === f.key ? '#fff' : 'var(--muted)' }}
              >
                {f.label}
              </span>
            ))}
          </div>
          <div className="row-list">
            {events.map((ev) => (
              <div key={ev.id} className="row-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ev.dotColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{ev.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{ev.date}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: ev.amountColor }}>{ev.amount}</span>
                </div>
                {ev.reminder && (
                  <div style={{ marginLeft: 18 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, background: ev.remBg, color: ev.dotColor, padding: '3px 8px', borderRadius: 6 }}>{ev.reminder}</span>
                  </div>
                )}
              </div>
            ))}
            {events.length === 0 && <div className="empty-state">Sin eventos para este filtro</div>}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Cola Whimm proyectada</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COLA_WHIMM.map((it) => (
              <div key={it.rank} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--wine4)' }}>#{it.rank}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{it.hint}</div>
                </div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(it.price)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toast message={message} />
      <AddSheet onToast={show} />
    </div>
  )
}

function LegendItem({ color, solid, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, ...(solid ? { background: color } : { border: `2px solid ${color}`, boxSizing: 'border-box' }) }} />
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</span>
    </div>
  )
}
