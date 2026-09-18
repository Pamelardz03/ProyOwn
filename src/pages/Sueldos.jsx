import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft, IconPlus, IconEdit } from '../components/Icons'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { fmt, fmtSigned } from '../lib/format'

const FREQS = ['Semanal', 'Quincenal', 'Mensual']

function monthlyEq(s) {
  if (s.frecuencia === 'Semanal') return s.monto * 4.33
  if (s.frecuencia === 'Quincenal') return s.monto * 2.166
  return s.monto
}

// Datos de ejemplo — Fase 1 del roadmap (Sueldo/presupuesto) los reemplaza por
// sueldos fijos y rápidos reales guardados en Firestore.
const FIJOS_INICIALES = [
  { id: 1, name: 'Sueldo principal', frecuencia: 'Quincenal', fecha: '30 sep', dias: 13, monto: 18000 },
  { id: 2, name: 'Domingo de mi papá', frecuencia: 'Semanal', fecha: '20 sep', dias: 3, monto: 200 },
]

const RAPIDOS_INICIALES = [
  { id: 1, desc: 'Lavado de ropa', fecha: '14 sep', monto: 150 },
  { id: 2, desc: 'Uñas', fecha: '10 sep', monto: 300 },
]

export default function Sueldos() {
  const [fijos, setFijos] = useState(FIJOS_INICIALES)
  const [rapidos, setRapidos] = useState(RAPIDOS_INICIALES)
  const [addFijoOpen, setAddFijoOpen] = useState(false)
  const [addRapidoOpen, setAddRapidoOpen] = useState(false)
  const [formFreq, setFormFreq] = useState('Quincenal')
  const { message, show } = useToast()

  const fijosTotal = fijos.reduce((sum, s) => sum + monthlyEq(s), 0)
  const rapidosTotal = rapidos.reduce((sum, r) => sum + r.monto, 0)
  const total = fijosTotal + rapidosTotal
  const fijosPct = total > 0 ? Math.round((fijosTotal / total) * 100) : 0

  function saveFijo() {
    const nuevo = { id: Date.now(), name: 'Nuevo sueldo fijo', frecuencia: formFreq, fecha: 'por definir', dias: 0, monto: 1000 }
    setFijos((prev) => [...prev, nuevo])
    setAddFijoOpen(false)
    show('Sueldo fijo guardado')
  }

  function saveRapido() {
    const nuevo = { id: Date.now(), desc: 'Nuevo sueldo rápido', fecha: 'hoy', monto: 100 }
    setRapidos((prev) => [...prev, nuevo])
    setAddRapidoOpen(false)
    show('Sueldo rápido guardado')
  }

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/perfil" aria-label="Volver" className="back-btn">
            <IconChevronLeft />
          </Link>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Sueldos</div>
        </div>

        <div className="hero" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500 }}>Total mensual estimado</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>{fmt(total)}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Fijos ({fijosPct}%)</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{fmt(fijosTotal)}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Rápidos ({100 - fijosPct}%)</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{fmt(rapidosTotal)}</div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Sueldos fijos</div>
            <button onClick={() => setAddFijoOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              <IconPlus size={14} color="var(--wine)" />
              Agregar
            </button>
          </div>

          {addFijoOpen && (
            <div className="card" style={{ padding: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input className="fld" placeholder="Nombre (ej. Sueldo principal)" />
              <input className="fld" placeholder="Monto" inputMode="decimal" />
              <div style={{ display: 'flex', gap: 8 }}>
                {FREQS.map((f) => (
                  <span
                    key={f}
                    onClick={() => setFormFreq(f)}
                    style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 10, background: formFreq === f ? 'var(--wine)' : 'var(--card)', color: formFreq === f ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 600 }}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <button className="btn-primary" style={{ marginTop: 4 }} onClick={saveFijo}>Guardar sueldo fijo</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fijos.map((s) => (
              <div key={s.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round"><path d="M10 14V6M6.5 9.5 10 6l3.5 3.5" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.frecuencia} · Próximo {s.fecha} · en {s.dias} días</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 500, color: 'var(--green)' }}>{fmtSigned(s.monto)}</div>
                  <button aria-label="Editar" style={{ padding: 2 }}>
                    <IconEdit />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Sueldos rápidos</div>
            <button onClick={() => setAddRapidoOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              <IconPlus size={14} color="var(--wine)" />
              Agregar
            </button>
          </div>

          {addRapidoOpen && (
            <div className="card" style={{ padding: 14, marginTop: 10, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input className="fld" placeholder="Descripción (ej. Lavado de ropa)" />
              <input className="fld" placeholder="Monto" inputMode="decimal" />
              <button className="btn-primary" style={{ marginTop: 4 }} onClick={saveRapido}>Guardar sueldo rápido</button>
            </div>
          )}

          <div className="row-list" style={{ marginTop: 10 }}>
            {rapidos.map((r) => (
              <div key={r.id} className="row-list-item">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{r.desc}</span>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>{fmtSigned(r.monto)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{r.fecha}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toast message={message} />
    </div>
  )
}
