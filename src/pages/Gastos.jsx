import { useRef, useState } from 'react'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconTrash, IconEdit } from '../components/Icons'
import { fmt } from '../lib/format'

const PERIODOS = ['dia', 'semana', 'mes', 'anio']
const PERIODO_LABEL = { dia: 'Día', semana: 'Semana', mes: 'Mes', anio: 'Año' }

// Datos de ejemplo — Fase 2 del roadmap los reemplaza por gastos reales en Firestore.
const DATA = {
  dia: { label: 'hoy', necesario: 0, shopping: 85, items: [{ id: 0, name: 'Café / antojo', cat: 'Shopping', date: 'Hoy', amount: 85, shopping: true }] },
  semana: {
    label: 'esta semana', necesario: 200, shopping: 984,
    items: [
      { id: 0, name: 'Gasolina', cat: 'Necesario', date: '15 sep', amount: 200, shopping: false },
      { id: 1, name: 'Ropa', cat: 'Shopping', date: '16 sep', amount: 899, shopping: true },
      { id: 2, name: 'Café / antojo', cat: 'Shopping', date: '17 sep', amount: 85, shopping: true },
    ],
  },
  mes: {
    label: 'septiembre', necesario: 10468, shopping: 984,
    items: [
      { id: 0, name: 'Renta', cat: 'Necesario', date: '1 sep', amount: 6500, shopping: false },
      { id: 1, name: 'Despensa', cat: 'Necesario', date: '3 sep', amount: 2800, shopping: false },
      { id: 2, name: 'Gasolina', cat: 'Necesario', date: '15 sep', amount: 200, shopping: false },
      { id: 3, name: 'Ropa', cat: 'Shopping', date: '16 sep', amount: 899, shopping: true },
      { id: 4, name: 'Café / antojo', cat: 'Shopping', date: '17 sep', amount: 85, shopping: true },
      { id: 5, name: 'Gym', cat: 'Servicios y suscripciones', date: '18 sep', amount: 650, shopping: false },
      { id: 6, name: 'Netflix', cat: 'Servicios y suscripciones', date: '20 sep', amount: 219, shopping: false },
      { id: 7, name: 'Spotify', cat: 'Servicios y suscripciones', date: '25 sep', amount: 99, shopping: false },
    ],
  },
  anio: {
    label: '2026', necesario: 10700, shopping: 1634,
    items: [
      { id: 0, name: 'Renta', cat: 'Necesario', date: '1 sep', amount: 6500, shopping: false },
      { id: 1, name: 'Despensa', cat: 'Necesario', date: '3 sep', amount: 2800, shopping: false },
      { id: 2, name: 'Servicio dental', cat: 'Necesario', date: '12 jun', amount: 1200, shopping: false },
      { id: 3, name: 'Gasolina', cat: 'Necesario', date: '15 sep', amount: 200, shopping: false },
      { id: 4, name: 'Regalo cumpleaños', cat: 'Shopping', date: '8 mar', amount: 650, shopping: true },
      { id: 5, name: 'Ropa', cat: 'Shopping', date: '16 sep', amount: 899, shopping: true },
      { id: 6, name: 'Café / antojo', cat: 'Shopping', date: '17 sep', amount: 85, shopping: true },
    ],
  },
}

function ExpenseRow({ item, isOpen, onSwipe, onDelete }) {
  const startX = useRef(0)
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none', transition: 'opacity .18s ease' }}>
        <button aria-label="Eliminar gasto" onClick={onDelete} style={{ width: 72, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconTrash />
        </button>
      </div>
      <div
        className="card"
        onPointerDown={(e) => { startX.current = e.clientX }}
        onPointerUp={(e) => {
          const delta = e.clientX - startX.current
          if (delta < -40) onSwipe(true)
          else if (delta > 40) onSwipe(false)
          else onSwipe(!isOpen)
        }}
        style={{ position: 'relative', padding: 13, display: 'flex', alignItems: 'center', gap: 12, transform: `translateX(${isOpen ? -72 : 0}px)`, transition: 'transform .18s ease', touchAction: 'pan-y' }}
      >
        <div className="icon-tile" style={{ width: 38, height: 38 }}>
          <IconProduct size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.cat} · {item.date}</div>
        </div>
        <div className="mono" style={{ fontSize: 14, fontWeight: 500, color: item.shopping ? 'var(--wine3)' : 'var(--text)' }}>-{fmt(item.amount)}</div>
        <button aria-label="Editar"><IconEdit /></button>
      </div>
    </div>
  )
}

export default function Gastos() {
  const { message, show } = useToast()
  const [periodo, setPeriodo] = useState('mes')
  const [data, setData] = useState(DATA)
  const [swipeOpenKey, setSwipeOpenKey] = useState(null)

  const cur = data[periodo]

  function deleteItem(id) {
    setData((prev) => ({
      ...prev,
      [periodo]: { ...prev[periodo], items: prev[periodo].items.filter((it) => it.id !== id) },
    }))
    setSwipeOpenKey(null)
    show('Gasto eliminado')
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h1>Gastos</h1>

        <div style={{ display: 'flex', gap: 6, background: 'var(--beige2)', padding: 4, borderRadius: 12 }}>
          {PERIODOS.map((p) => (
            <button
              key={p}
              className="segbtn"
              onClick={() => setPeriodo(p)}
              style={{ background: periodo === p ? 'var(--wine)' : 'transparent', color: periodo === p ? '#fff' : 'var(--muted)' }}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="hero" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500 }}>Gastado en {cur.label}</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, marginTop: 3 }}>{fmt(cur.necesario + cur.shopping)}</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Necesario</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{fmt(cur.necesario)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Shopping</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: 'var(--wine3)' }}>{fmt(cur.shopping)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cur.items.map((it) => {
            const key = periodo + '-' + it.id
            return (
              <ExpenseRow
                key={key}
                item={it}
                isOpen={swipeOpenKey === key}
                onSwipe={(open) => setSwipeOpenKey(open ? key : null)}
                onDelete={() => deleteItem(it.id)}
              />
            )
          })}
          {cur.items.length === 0 && <div className="empty-state">Sin gastos en este periodo</div>}
        </div>
      </div>

      <Toast message={message} />
      <AddSheet onToast={show} />
    </div>
  )
}
