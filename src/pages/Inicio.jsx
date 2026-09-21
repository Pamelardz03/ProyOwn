import { Link } from 'react-router-dom'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconProduct } from '../components/Icons'
import { fmt, fmtSigned } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection } from '../lib/firestoreCollections'
import { daysUntil, formatShortDate, isThisMonth, todayISO, weekdayShort } from '../lib/date'
import { ingresosFijosDelMes, monthlyEqPagoFijo, proximaFechaSueldo, fechasPagoVivas, fechasVencimientoVivas, proximoVencimientoPagoFijo } from '../lib/budget'
import { computeWhimmScore } from '../lib/score'
import { deriveWhimmCats } from '../lib/categorias'

const ESTADO_LABEL = { espera: 'En espera', apartando: 'Apartando fondos' }

// Convierte el timestamp de Firestore (serverTimestamp resuelto) a milisegundos
// para poder ordenar por fecha real; mientras está pendiente de confirmar con
// el servidor puede venir como null, ahí cae al final del orden.
function toMillis(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

// Días transcurridos desde un timestamp de Firestore — usado como
// aproximación de "cuánto lleva acumulando" el Whimm top (no tenemos todavía
// un campo que marque cuándo pasó a estado "apartando" específicamente).
function daysSinceMillis(ms) {
  if (!ms) return null
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000))
}

function DonutChart({ items }) {
  const total = items.reduce((s, it) => s + it.monto, 0)
  const circumference = 2 * Math.PI * 15.5
  let offset = 0
  return (
    <svg width="104" height="104" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--beige2)" strokeWidth="5" />
      {items.map((it, i) => {
        const frac = total > 0 ? it.monto / total : 0
        const dash = frac * circumference
        const el = (
          <circle
            key={i}
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={it.color}
            strokeWidth="5"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

export default function Inicio() {
  const { user } = useAuth()
  const { message, show } = useToast()

  const { data: gastos } = useUserCollection('gastos')
  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: whimms } = useUserCollection('whimms')

  const cats = deriveWhimmCats(whimms, gastos)

  const primerNombre = user?.displayName?.split(' ')[0] || 'Pame'

  const gastosMes = gastos.filter((g) => isThisMonth(g.fecha))
  const gastoMensual = gastosMes.reduce((s, g) => s + (Number(g.monto) || 0), 0)

  // Ingresos reales del mes: solo cuenta pagos de sueldos fijos que ya
  // ocurrieron desde que cada uno se registró (fechaInicio) — antes se
  // mensualizaba a ciegas y sobrestimaba el saldo apenas se agregaba un
  // sueldo nuevo a mitad de mes.
  const sueldosFijosMensual = ingresosFijosDelMes(sueldosFijos)
  const sueldosRapidosMes = sueldosRapidos.filter((r) => isThisMonth(r.fecha)).reduce((s, r) => s + (Number(r.monto) || 0), 0)
  const ingresoMensual = sueldosFijosMensual + sueldosRapidosMes

  const pagosActivos = pagosFijos.filter((p) => p.activo !== false)
  const vitallMensual = pagosActivos.filter((p) => p.tipo === 'Vitall').reduce((s, p) => s + monthlyEqPagoFijo(p), 0)
  const otrosFijosMensual = pagosActivos.filter((p) => p.tipo !== 'Vitall').reduce((s, p) => s + monthlyEqPagoFijo(p), 0)

  const saldoMes = ingresoMensual - gastoMensual - vitallMensual - otrosFijosMensual

  // El próximo pago de un sueldo fijo/pago fijo se calcula en vivo (no lee
  // el campo `fecha` guardado, que se fija una sola vez al darlo de alta y
  // se queda obsoleto). Nunca debe mostrar "0 días": si la fecha más
  // próxima es justo hoy (ya es el día de pago), se muestra la siguiente
  // ocurrencia en su lugar en vez de "0".
  const hoy = todayISO()
  const proximaFechaSueldoNoHoy = (s) => {
    const fecha = proximaFechaSueldo(s, hoy)
    return fecha === hoy ? (fechasPagoVivas(s).find((f) => f > hoy) || null) : fecha
  }
  const proximoVencimientoPagoFijoNoHoy = (p) => {
    const fecha = proximoVencimientoPagoFijo(p, hoy)
    return fecha === hoy ? (fechasVencimientoVivas(p).find((f) => f > hoy) || null) : fecha
  }
  const proximosDias = [
    ...sueldosFijos.map((s) => daysUntil(proximaFechaSueldoNoHoy(s))),
    ...pagosActivos.map((p) => daysUntil(proximoVencimientoPagoFijoNoHoy(p))),
  ].filter((d) => d != null && d > 0)
  const proximoPagoDias = proximosDias.length ? Math.min(...proximosDias) : null

  // Whimms comprados este mes — lo que realmente salió del banco (se resta
  // lo que ya estaba apartado en efectivo/otra cuenta, igual que en
  // totalWhimmsCompradosHasta). Van separados de "Gastos": esos son gasto
  // hormiga espontáneo, esto es wishlist planeada.
  const whimmsCompradosMes = whimms.filter((w) => w.estado === 'comprado' && isThisMonth(w.compradoEn))
  const whimmMensual = whimmsCompradosMes.reduce((s, w) => {
    const precioFinal = Number(w.precioComprado ?? w.precio) || 0
    const yaApartado = Number(w.montoApartado) || 0
    return s + Math.max(precioFinal - yaApartado, 0)
  }, 0)

  const distribucion = [
    { label: 'Gastos', color: 'var(--wine)', monto: gastoMensual },
    { label: 'Whimms', color: 'var(--green)', monto: whimmMensual },
    { label: 'Pagos fijos', color: 'var(--wine4)', monto: otrosFijosMensual },
    { label: 'Vitall', color: 'var(--amber)', monto: vitallMensual },
  ].filter((d) => d.monto > 0)
  const totalDistribucion = distribucion.reduce((s, d) => s + d.monto, 0)

  // Cola de Whimms ordenada por score (necesidad/deseo/precio) — el #1 es
  // el que está acumulando fondos activamente.
  const whimmsTop = whimms
    .filter((w) => w.estado !== 'comprado')
    .map((w) => ({ ...w, _score: w.score ?? computeWhimmScore(w) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)

  const whimmsCompradosConFecha = whimms.filter((w) => w.estado === 'comprado' && w.compradoEn)

  const historial = [
    ...gastosMes.map((g) => ({ id: `g-${g.id}`, label: g.concepto, monto: -(Number(g.monto) || 0), color: 'var(--wine)', color2: 'var(--text)', ts: toMillis(g.creadoEn) })),
    ...sueldosRapidos.map((r) => ({ id: `r-${r.id}`, label: r.desc, monto: Number(r.monto) || 0, color: 'var(--green)', color2: 'var(--green)', ts: toMillis(r.creadoEn) })),
    ...whimmsCompradosConFecha.map((w) => {
      const precioFinal = Number(w.precioComprado ?? w.precio) || 0
      const yaApartado = Number(w.montoApartado) || 0
      return {
        id: `w-${w.id}`,
        label: `Se compró: ${w.name}`,
        monto: -Math.max(precioFinal - yaApartado, 0),
        color: 'var(--wine)',
        color2: 'var(--text)',
        ts: new Date(w.compradoEn).getTime(),
      }
    }),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5)

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div className="eyebrow">{weekdayShort(todayISO())} · {formatShortDate(todayISO())}</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>Hola, {primerNombre}</div>
        </div>

        <div className="hero">
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>Saldo del mes</div>
          <div className="mono stat-display" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 6 }}>
            {fmt(saldoMes)}
            <span style={{ fontSize: 16, opacity: 0.7 }}> MXN</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
              <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Gastado este mes</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>{fmt(gastoMensual)}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
              <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Próximo pago</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>{proximoPagoDias != null ? `${proximoPagoDias} días` : '—'}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Presupuesto</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Distribución del mes</div>
          {totalDistribucion > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <DonutChart items={distribucion} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  {distribucion.map((d) => (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1 }}>{d.label}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{fmt(d.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--beige2)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Total</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(totalDistribucion)}</span>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '8px 0' }}>Sin movimientos este mes todavía</div>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Lista de espera</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Whimms</div>
            <Link to="/compras" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              Ver todos ›
            </Link>
          </div>
          {whimmsTop.length > 0 ? (
            <div className="row-list">
              {whimmsTop.map((w, i) => {
                const diasAcumulando = i === 0 && w.estado === 'apartando' ? daysSinceMillis(toMillis(w.creadoEn)) : null
                return (
                  <Link key={w.id} to="/compras" className="row-list-item">
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--wine4)', width: 16 }}>{i + 1}</div>
                    <div className="icon-tile" style={{ width: 36, height: 36 }}>
                      <IconProduct size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                        {ESTADO_LABEL[w.estado] || 'En espera'}
                        {diasAcumulando != null ? ` · ${diasAcumulando} día${diasAcumulando === 1 ? '' : 's'} acumulando` : ''}
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(w.precio)}</div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">Sin Whimms todavía</div>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Actividad</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Historial reciente</div>
          {historial.length > 0 ? (
            <div className="row-list">
              {historial.map((h) => (
                <div key={h.id} className="row-list-item">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{h.label}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: h.color2 }}>{fmtSigned(h.monto)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Sin movimientos recientes</div>
          )}
        </div>
      </div>

      <Toast message={message} />
      <AddSheet onToast={show} cats={cats} pagosFijos={pagosFijos} />
    </div>
  )
}
