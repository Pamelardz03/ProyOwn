import { Link } from 'react-router-dom'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconProduct } from '../components/Icons'
import { fmt, fmtSigned } from '../lib/format'

// Datos de ejemplo — se reemplazan por datos reales de Firestore en una fase posterior.
const SALDO_GENERAL = 24633
const ACUMULADO = 1715
const PROXIMO_PAGO_DIAS = 13

const DISTRIBUCION = [
  { label: 'Gastos fijos', color: 'var(--wine)', monto: 9300 },
  { label: 'Vitall', color: 'var(--wine4)', monto: 968 },
  { label: 'Whimms', color: 'var(--amber)', monto: 1099 },
]

const WHIMMS_TOP = [
  { rank: 1, name: 'Sony WH-1000XM5', estado: 'Apartando fondos · 27 sep', precio: 7499 },
  { rank: 2, name: 'Suero Vitamina C', estado: 'En espera', precio: 450 },
  { rank: 3, name: 'Crema hidratante', estado: 'En espera', precio: 320 },
  { rank: 4, name: 'Funda iPad', estado: 'En espera', precio: 550 },
  { rank: 5, name: 'Set de brochas', estado: 'En espera', precio: 680 },
]

const HISTORIAL = [
  { color: 'var(--wine)', label: 'Quincena depositada', monto: 18000, color2: 'var(--green)' },
  { color: 'var(--wine4)', label: 'iCloud+ pagado', monto: -29, color2: 'var(--text)' },
  { color: 'var(--amber)', label: 'Sony WH-1000XM5 bajó de precio', monto: -300, color2: 'var(--amber)' },
]

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
  const { message, show } = useToast()
  const totalDistribucion = DISTRIBUCION.reduce((s, d) => s + d.monto, 0)

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Hola, Pame</div>

        <div className="hero">
          <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.75 }}>Saldo general</div>
          <div className="mono" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1.1, marginTop: 5 }}>
            {fmt(SALDO_GENERAL)}
            <span style={{ fontSize: 16, opacity: 0.7 }}> MXN</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
              <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Acumulado</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>{fmt(ACUMULADO)}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
              <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Próximo pago</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>{PROXIMO_PAGO_DIAS} días</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Distribución del mes</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <DonutChart items={DISTRIBUCION} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
              {DISTRIBUCION.map((d) => (
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
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Whimms</div>
            <Link to="/compras" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              Ver todos ›
            </Link>
          </div>
          <div className="row-list">
            {WHIMMS_TOP.map((w) => (
              <Link key={w.rank} to="/compras" className="row-list-item">
                <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--wine4)', width: 16 }}>{w.rank}</div>
                <div className="icon-tile" style={{ width: 36, height: 36 }}>
                  <IconProduct size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{w.estado}</div>
                </div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(w.precio)}</div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Historial reciente</div>
          <div className="row-list">
            {HISTORIAL.map((h, i) => (
              <div key={i} className="row-list-item">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{h.label}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: h.color2 }}>{fmtSigned(h.monto)}</span>
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
