import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../components/Icons'
import { fmt } from '../lib/format'

// Datos de ejemplo — Fase de métricas del roadmap los calcula a partir de
// los datos reales guardados en Firestore.
const STATS = [
  { label: 'Categorías', value: '3', mono: true },
  { label: 'Whimms', value: '5', hint: '1 apartando fondos', mono: true },
  { label: 'Vitall', value: '4', mono: true },
  { label: 'Gastos fijos', value: '7', mono: true },
  { label: 'Cosas compradas', value: '12', mono: true },
  { label: 'Ahorrado', value: fmt(4799), mono: true },
  { label: 'Categoría top', value: 'Skin care', hint: 'más deseada', big: true },
  { label: 'Promedio diario', value: fmt(349), hint: 'últimos 30 días', big: true, mono: true },
  { label: 'Mayor gasto — mes', value: 'Sep · ' + fmt(9500), hint: 'necesario', big: true, mono: true },
  { label: 'Mayor gasto — semana', value: '11–17 · ' + fmt(1184), hint: 'esta semana', big: true, mono: true },
]

export default function MetricasStats() {
  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/perfil" aria-label="Volver" className="back-btn">
            <IconChevronLeft />
          </Link>
          <h1>Métricas</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {STATS.map((s) => (
            <div key={s.label} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{s.label}</div>
              <div className={s.mono ? 'mono' : undefined} style={{ fontSize: s.big ? 16 : 20, fontWeight: s.big ? 600 : 500, marginTop: 4 }}>{s.value}</div>
              {s.hint && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{s.hint}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
