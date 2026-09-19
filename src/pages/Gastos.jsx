import { useRef, useState } from 'react'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconTrash, IconEdit } from '../components/Icons'
import { fmt } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, deleteUserDoc } from '../lib/firestoreCollections'
import { formatShortDate, isToday, isThisWeek, isThisMonth, isThisYear, compareISODesc } from '../lib/date'

const PERIODOS = ['dia', 'semana', 'mes', 'anio']
const PERIODO_LABEL = { dia: 'Día', semana: 'Semana', mes: 'Mes', anio: 'Año' }
const MES_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const PERIODO_FILTER = { dia: isToday, semana: isThisWeek, mes: isThisMonth, anio: isThisYear }
const PERIODO_LABEL_TEXT = {
  dia: 'hoy',
  semana: 'esta semana',
  mes: MES_FULL[new Date().getMonth()],
  anio: String(new Date().getFullYear()),
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
  const { user } = useAuth()
  const { message, show } = useToast()
  const [periodo, setPeriodo] = useState('mes')
  const [swipeOpenKey, setSwipeOpenKey] = useState(null)
  const { data: gastos, loading, error } = useUserCollection('gastos')

  const filterFn = PERIODO_FILTER[periodo]
  const items = gastos
    .filter((g) => filterFn(g.fecha))
    .sort((a, b) => compareISODesc(a.fecha, b.fecha))
    .map((g) => ({
      id: g.id,
      name: g.concepto,
      cat: g.categoria,
      date: formatShortDate(g.fecha),
      amount: Number(g.monto) || 0,
      shopping: g.categoria === 'Shopping',
    }))

  const necesario = items.filter((it) => !it.shopping).reduce((s, it) => s + it.amount, 0)
  const shopping = items.filter((it) => it.shopping).reduce((s, it) => s + it.amount, 0)

  async function deleteItem(id) {
    try {
      await deleteUserDoc(user.uid, 'gastos', id)
      setSwipeOpenKey(null)
      show('Gasto eliminado')
    } catch (err) {
      console.error(err)
      show(`No se pudo eliminar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
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
          <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500 }}>Gastado en {PERIODO_LABEL_TEXT[periodo]}</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, marginTop: 3 }}>{fmt(necesario + shopping)}</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Necesario</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{fmt(necesario)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Shopping</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: 'var(--wine3)' }}>{fmt(shopping)}</div>
          </div>
        </div>

        {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it) => (
            <ExpenseRow
              key={it.id}
              item={it}
              isOpen={swipeOpenKey === it.id}
              onSwipe={(open) => setSwipeOpenKey(open ? it.id : null)}
              onDelete={() => deleteItem(it.id)}
            />
          ))}
          {!loading && !error && items.length === 0 && <div className="empty-state">Sin gastos en este periodo</div>}
        </div>
      </div>

      <Toast message={message} />
      <AddSheet onToast={show} />
    </div>
  )
}
