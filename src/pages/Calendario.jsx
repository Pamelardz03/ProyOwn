import { useMemo, useState } from 'react'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { fmt } from '../lib/format'
import { useUserCollection } from '../lib/firestoreCollections'
import { daysInMonth, daysUntil, formatShortDate, todayISO, isThisMonth, compareISOAsc, addDaysISO } from '../lib/date'
import { computeWhimmScore } from '../lib/score'
import { estimatePresupuestoDiarioNeto, proyectarColaWhimms, fechasPagoVivas, fechasVencimientoVivas } from '../lib/budget'
import { deriveWhimmCats } from '../lib/categorias'

const TODAY_STYLE = { background: 'var(--red)', color: '#fff', fontWeight: 700 }
const CAT_COLOR = { nomina: '#3a0f1f', servicio: '#7c8c5a', compra: '#b8783f' }
const CAT_BG = { nomina: '#f3d9c8', servicio: '#dde3c8', compra: '#ecdfc7' }
// Sombreado de recordatorio (2 días antes de un vencimiento con "Recordatorio
// formal" activado) — opacidad baja del mismo tono de "servicio", para no
// confundirse con el relleno sólido de "Hoy" ni con el borde de un evento real.
const NOTI_BG = 'rgba(124,140,90,.18)'

const MES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'servicio', label: 'Pagos fijos' },
  { key: 'compra', label: 'Whimm' },
  { key: 'nomina', label: 'Sueldos' },
]

// Metadatos del mes que muestra la grilla (año, mes 0-indexado, huecos
// iniciales según el día de la semana del día 1, total de días).
function monthMeta(offset) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const year = first.getFullYear()
  const month = first.getMonth()
  return { year, month, leading: first.getDay(), total: daysInMonth(year, month), label: `${MES_FULL[month]} ${year}` }
}

function isoOf(year, month, day) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function styleForDay(cats, isToday, hasNoti) {
  if (isToday) return TODAY_STYLE
  if (cats.length === 0) return hasNoti ? { background: NOTI_BG, color: '#1a1208', fontWeight: 600 } : {}
  const main = cats[0]
  return cats.length > 1
    ? { border: `2px solid ${CAT_COLOR[main]}`, background: CAT_BG[main], color: '#1a1208', fontWeight: 600 }
    : { border: `2px solid ${CAT_COLOR[main]}`, color: CAT_COLOR[main], fontWeight: 600 }
}

export default function Calendario() {
  const [monthOffset, setMonthOffset] = useState(0)
  const [eventFilter, setEventFilter] = useState('todos')
  const [proximosVisible, setProximosVisible] = useState(10)
  const [servicioTipoFiltro, setServicioTipoFiltro] = useState('todos')
  const { message, show } = useToast()

  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: whimms } = useUserCollection('whimms')
  const { data: gastos } = useUserCollection('gastos')

  const cats = deriveWhimmCats(whimms, gastos)

  // Categorías de pago fijo en uso (ya no es una lista fija de 4 — "Pago
  // fijo" ahora deja elegir cualquier categoría abierta, ver AddSheet.jsx).
  const tiposPagoFiltro = [...new Set(pagosFijos.map((p) => p.tipo).filter(Boolean))].sort()

  const sueldosRapidosMes = sueldosRapidos.filter((r) => isThisMonth(r.fecha)).reduce((s, r) => s + (Number(r.monto) || 0), 0)
  const presupuestoDiarioNeto = estimatePresupuestoDiarioNeto({ sueldosFijos, sueldosRapidosMes, pagosFijos })
  const colaWhimm = proyectarColaWhimms(
    whimms
      .filter((w) => w.estado !== 'comprado')
      .map((w) => ({ ...w, _score: w.score ?? computeWhimmScore(w) }))
      .sort((a, b) => b._score - a._score),
    presupuestoDiarioNeto
  )

  // Eventos reales: pagos de sueldos fijos (nómina), vencimientos de pagos
  // fijos/Vitall activos (servicio), y la fecha estimada de compra del
  // Whimm top de la cola (compra) — reemplaza los datos de ejemplo.
  const allEvents = useMemo(() => {
    const out = []
    const horizonte = addDaysISO(todayISO(), 365)
    sueldosFijos.forEach((s) => {
      const fechas = fechasPagoVivas(s, horizonte)
      fechas.forEach((f) => out.push({ id: `sf-${s.id}-${f}`, cat: 'nomina', title: `${s.name} depositado`, dateISO: f, amount: `+${fmt(s.monto)}`, amountColor: '#3f6b45', dotColor: '#3a0f1f', notifFormal: !!s.notifFormal }))
    })
    pagosFijos.filter((p) => p.activo !== false && p.fecha).forEach((p) => {
      const fechas = fechasVencimientoVivas(p, horizonte)
      fechas.forEach((f) => {
        out.push({ id: `pf-${p.id}-${f}`, cat: 'servicio', tipo: p.tipo, title: `Vencimiento — ${p.name}`, dateISO: f, amount: fmt(p.monto), amountColor: '#1a1208', dotColor: '#7c8c5a', notifFormal: !!p.notifFormal })
      })
    })
    colaWhimm.filter((w) => w.fechaProyectada).forEach((w) => {
      out.push({ id: `w-${w.id}`, cat: 'compra', title: `${w.name} — estimado disponible`, dateISO: w.fechaProyectada, amount: fmt(w.precio), amountColor: '#1a1208', dotColor: '#b8783f', notifFormal: !!w.notifFormal })
    })
    return out.sort((a, b) => compareISOAsc(a.dateISO, b.dateISO))
  }, [sueldosFijos, pagosFijos, colaWhimm])

  const hoy = todayISO()
  const proximosFiltrados = allEvents.filter((e) =>
    e.dateISO > hoy &&
    (eventFilter === 'todos' || e.cat === eventFilter) &&
    (eventFilter !== 'servicio' || servicioTipoFiltro === 'todos' || e.tipo === servicioTipoFiltro)
  )
  const proximos = proximosFiltrados.slice(0, proximosVisible)

  const meta = monthMeta(monthOffset)
  const specialByDay = {}
  const notisByDay = {}
  allEvents.forEach((e) => {
    const [y, m, d] = e.dateISO.split('-').map(Number)
    if (y === meta.year && m - 1 === meta.month) {
      specialByDay[d] = specialByDay[d] || []
      specialByDay[d].push(e.cat)
    }
    if (e.notifFormal) {
      const noti = addDaysISO(e.dateISO, -2)
      const [ny, nm, nd] = noti.split('-').map(Number)
      if (ny === meta.year && nm - 1 === meta.month) notisByDay[nd] = true
    }
  })
  const days = []
  for (let i = 0; i < meta.leading; i++) days.push(null)
  for (let d = 1; d <= meta.total; d++) {
    const iso = isoOf(meta.year, meta.month, d)
    days.push({ day: d, style: styleForDay(specialByDay[d] || [], iso === hoy, notisByDay[d]) })
  }
  while (days.length % 7 !== 0) days.push(null)

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1>Calendario</h1>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              aria-label="Mes anterior"
              onClick={() => setMonthOffset((i) => i - 1)}
              style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 4.5 6 10l6.5 5.5" /></svg>
            </button>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
            <button
              aria-label="Mes siguiente"
              onClick={() => setMonthOffset((i) => i + 1)}
              style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5l5 5.5-5 5.5" /></svg>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, fontSize: 10, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>
            {['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {days.map((d, i) => (
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
            <LegendItem color="var(--red)" solid label="Hoy" />
            <LegendItem color="var(--wine)" label="Sueldos" />
            <LegendItem color="var(--wine4)" label="Pagos fijos" />
            <LegendItem color="var(--amber)" label="Whimm" />
            <LegendItem color={NOTI_BG} solid label="Recordatorio" />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Próximos eventos</div>
          <div className="chiprow" style={{ marginBottom: 12 }}>
            {FILTERS.map((f) => (
              <span
                key={f.key}
                onClick={() => { setEventFilter(f.key); setProximosVisible(10); setServicioTipoFiltro('todos') }}
                className="pill"
                style={{ background: eventFilter === f.key ? 'var(--wine)' : 'transparent', color: eventFilter === f.key ? '#fff' : 'var(--muted)' }}
              >
                {f.label}
              </span>
            ))}
          </div>
          {eventFilter === 'servicio' && (
            <div className="chiprow" style={{ marginBottom: 12 }}>
              {['todos', ...tiposPagoFiltro].map((t) => (
                <span
                  key={t}
                  onClick={() => setServicioTipoFiltro(t)}
                  className="pill"
                  style={{ background: servicioTipoFiltro === t ? 'var(--wine4)' : 'transparent', color: servicioTipoFiltro === t ? '#fff' : 'var(--muted)', border: '1px solid var(--beige3)' }}
                >
                  {t === 'todos' ? 'Todos' : t}
                </span>
              ))}
            </div>
          )}
          <div className="row-list">
            {proximos.map((ev) => (
              <div key={ev.id} className="row-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ev.dotColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{ev.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{formatShortDate(ev.dateISO)}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: ev.amountColor }}>{ev.amount}</span>
                </div>
              </div>
            ))}
            {proximos.length === 0 && <div className="empty-state">Sin eventos próximos para este filtro</div>}
          </div>
          {proximosFiltrados.length > proximos.length && (
            <button
              onClick={() => setProximosVisible((n) => n + 10)}
              style={{ display: 'block', margin: '10px auto 0', fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}
            >
              Ver más
            </button>
          )}
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Cola Whimm proyectada</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {colaWhimm.slice(0, 5).map((it, idx) => {
              const dias = it.fechaProyectada ? daysUntil(it.fechaProyectada) : null
              return (
                <div key={it.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--wine4)' }}>#{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {dias != null ? `${dias} día${dias === 1 ? '' : 's'} · estimado ${formatShortDate(it.fechaProyectada)}` : 'Sin estimado todavía'}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(it.precio)}</div>
                </div>
              )
            })}
            {colaWhimm.length === 0 && <div className="empty-state">Sin Whimms en espera</div>}
          </div>
        </div>
      </div>

      <Toast message={message} />
      <AddSheet onToast={show} cats={cats} pagosFijos={pagosFijos} />
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
