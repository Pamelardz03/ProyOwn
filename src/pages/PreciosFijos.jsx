import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft, IconCard } from '../components/Icons'
import Toggle from '../components/Toggle'
import { fmt } from '../lib/format'

const TIPOS = ['Vitall', 'Vivienda', 'Transporte', 'Deuda']

const TIPO_COLORS = {
  Vitall: { color: '#7c8c5a', bg: '#dde3c8' },
  Vivienda: { color: 'var(--wine)', bg: 'var(--beige2)' },
  Transporte: { color: 'var(--amber)', bg: '#ecdfc7' },
  Deuda: { color: 'var(--red)', bg: 'var(--red-bg)' },
}

// Datos de ejemplo — Fase 5 del roadmap (Servicios/Vitall) los reemplaza por
// pagos recurrentes reales guardados en Firestore.
const ITEMS = [
  { id: 1, name: 'Gym', tipo: 'Vitall', frecuencia: 'Mensual', fecha: '18 sep', monto: 650, activo: true },
  { id: 2, name: 'Netflix', tipo: 'Vitall', frecuencia: 'Mensual', fecha: '20 sep', monto: 219, activo: true },
  { id: 3, name: 'Spotify', tipo: 'Vitall', frecuencia: 'Mensual', fecha: '25 sep', monto: 99, activo: true },
  { id: 4, name: 'iCloud+', tipo: 'Vitall', frecuencia: 'Mensual', fecha: '5 oct', monto: 29, activo: true },
  { id: 5, name: 'Renta', tipo: 'Vivienda', frecuencia: 'Mensual', fecha: '1 oct', monto: 6500, activo: true },
  { id: 6, name: 'Boleto estacionamiento', tipo: 'Transporte', frecuencia: 'Semanal', fecha: '21 sep', monto: 150, activo: true },
  { id: 7, name: 'Deuda con mi papá — teléfono', tipo: 'Deuda', frecuencia: 'Mensual', fecha: '28 sep', monto: 300, activo: true },
]

function monthlyEq(p) {
  return p.frecuencia === 'Semanal' ? Math.round(p.monto * 4.33) : p.monto
}

export default function PreciosFijos() {
  const [tipo, setTipo] = useState('todos')
  const [items, setItems] = useState(ITEMS)

  const totalMonthly = items.reduce((sum, p) => sum + monthlyEq(p), 0)
  const filtered = items.filter((p) => tipo === 'todos' || p.tipo.toLowerCase() === tipo)

  function toggleActivo(id) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, activo: !p.activo } : p)))
  }

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/perfil" aria-label="Volver" className="back-btn">
            <IconChevronLeft />
          </Link>
          <div style={{ fontSize: 19, fontWeight: 600, flex: 1 }}>Precios fijos</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Total fijo mensual</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{fmt(totalMonthly)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Pagos activos</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{items.length}</div>
          </div>
        </div>

        <div className="chiprow">
          <span onClick={() => setTipo('todos')} className="pill" style={{ background: tipo === 'todos' ? 'var(--wine)' : 'transparent', color: tipo === 'todos' ? '#fff' : 'var(--muted)' }}>Todos</span>
          {TIPOS.map((t) => (
            <span
              key={t}
              onClick={() => setTipo(t.toLowerCase())}
              className="pill"
              style={{ background: tipo === t.toLowerCase() ? 'var(--wine)' : 'transparent', color: tipo === t.toLowerCase() ? '#fff' : 'var(--muted)' }}
            >
              {t}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((p) => {
            const colors = TIPO_COLORS[p.tipo]
            return (
              <div key={p.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="icon-tile" style={{ width: 38, height: 38 }}>
                  <IconCard size={17} color="var(--wine4)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <span style={{ fontSize: 9, fontWeight: 600, color: colors.color, background: colors.bg, padding: '2px 7px', borderRadius: 6 }}>{p.tipo}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{p.frecuencia} · Próximo {p.fecha}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(p.monto)}</div>
                  <Toggle on={p.activo} onClick={() => toggleActivo(p.id)} ariaLabel={`Activar ${p.name}`} />
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="empty-state">Sin pagos fijos de este tipo</div>}
        </div>
      </div>
    </div>
  )
}
