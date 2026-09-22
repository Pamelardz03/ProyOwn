import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../components/Icons'
import { fmt } from '../lib/format'
import { useUserCollection } from '../lib/firestoreCollections'
import { formatShortDate, isThisMonth, isThisWeek, addDaysISO, todayISO } from '../lib/date'
import { computeWhimmScore } from '../lib/score'

export default function MetricasStats() {
  const { data: whimms } = useUserCollection('whimms')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: gastos } = useUserCollection('gastos')

  const categorias = new Set(whimms.map((w) => w.categoria).filter(Boolean)).size
  const apartando = whimms.filter((w) => w.estado === 'apartando').length
  const vitalls = pagosFijos.filter((p) => p.tipo === 'Vitall').length
  const comprados = whimms.filter((w) => w.estado === 'comprado')
  const ahorrado = comprados.reduce((s, w) => s + (Number(w.precio) || 0), 0)

  // Categoría con mayor score promedio (necesidad/deseo/precio) — la más
  // "deseada" entre las que sí tienen datos reales, no solo la más frecuente.
  const catScores = {}
  whimms.forEach((w) => {
    if (!w.categoria) return
    const s = computeWhimmScore(w)
    const bucket = catScores[w.categoria] || { sum: 0, count: 0 }
    bucket.sum += s
    bucket.count += 1
    catScores[w.categoria] = bucket
  })
  let categoriaTop = null
  let topAvg = -Infinity
  Object.entries(catScores).forEach(([cat, { sum, count }]) => {
    const avg = sum / count
    if (avg > topAvg) {
      topAvg = avg
      categoriaTop = cat
    }
  })

  const hace30 = addDaysISO(todayISO(), -30)
  const gastos30 = gastos.filter((g) => g.fecha >= hace30)
  const total30 = gastos30.reduce((s, g) => s + (Number(g.monto) || 0), 0)
  const promedioDiario = total30 / 30

  const gastosMes = gastos.filter((g) => isThisMonth(g.fecha))
  const mayorGastoMes = gastosMes.reduce((max, g) => (!max || Number(g.monto) > Number(max.monto) ? g : max), null)
  const gastosSemana = gastos.filter((g) => isThisWeek(g.fecha))
  const mayorGastoSemana = gastosSemana.reduce((max, g) => (!max || Number(g.monto) > Number(max.monto) ? g : max), null)

  const STATS = [
    { label: 'Categorías', value: String(categorias), mono: true },
    { label: 'Whimms', value: String(whimms.length), hint: `${apartando} apartando fondos`, mono: true },
    { label: 'Vitall', value: String(vitalls), mono: true },
    { label: 'Gastos fijos', value: String(pagosFijos.length), mono: true },
    { label: 'Cosas compradas', value: String(comprados.length), mono: true },
    { label: 'Ahorrado', value: fmt(ahorrado), hint: 'en compras hechas', mono: true },
    { label: 'Categoría top', value: categoriaTop || 'Sin datos', hint: 'más deseada', big: true },
    { label: 'Promedio diario', value: fmt(promedioDiario), hint: 'últimos 30 días', big: true, mono: true },
    {
      label: 'Mayor gasto — mes',
      value: mayorGastoMes ? `${formatShortDate(mayorGastoMes.fecha)} · ${fmt(mayorGastoMes.monto)}` : 'Sin datos',
      hint: mayorGastoMes?.categoria || 'este mes',
      big: true,
      mono: true,
    },
    {
      label: 'Mayor gasto — semana',
      value: mayorGastoSemana ? `${formatShortDate(mayorGastoSemana.fecha)} · ${fmt(mayorGastoSemana.monto)}` : 'Sin datos',
      hint: mayorGastoSemana?.categoria || 'esta semana',
      big: true,
      mono: true,
    },
  ]

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
