import { useState } from 'react'
import AddSheet from '../components/AddSheet'
import { useSwipeX } from '../hooks/useSwipe'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconTrash, IconEdit, IconClose } from '../components/Icons'
import { fmt } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, deleteUserDoc, updateUserDoc } from '../lib/firestoreCollections'
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

function ExpenseRow({ item, isOpen, onSwipe, onDelete, onEdit }) {
  const { x, dragging, handlers } = useSwipeX({ isOpen, onChange: onSwipe })
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end', opacity: x < -4 ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none', transition: dragging ? 'none' : 'opacity .12s ease' }}>
        <button aria-label="Eliminar gasto" onClick={onDelete} style={{ width: 72, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconTrash />
        </button>
      </div>
      <div
        className="card"
        {...handlers}
        style={{ position: 'relative', padding: 13, display: 'flex', alignItems: 'center', gap: 12, transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform .12s ease', touchAction: 'pan-y' }}
      >
        <div className="icon-tile" style={{ width: 38, height: 38 }}>
          <IconProduct size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.cat} · {item.date}</div>
        </div>
        <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>-{fmt(item.amount)}</div>
        <button
          aria-label="Editar"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEdit(item.id) }}
        >
          <IconEdit />
        </button>
      </div>
    </div>
  )
}

export default function Gastos() {
  const { user } = useAuth()
  const { message, show } = useToast()
  const [periodo, setPeriodo] = useState('mes')
  const [swipeOpenKey, setSwipeOpenKey] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const { data: gastos, loading, error } = useUserCollection('gastos')
  const { data: whimms } = useUserCollection('whimms')
  const { data: pagosFijos } = useUserCollection('pagosFijos')

  const cats = [...new Set(whimms.map((w) => w.categoria).filter(Boolean))]
  const vitalls = pagosFijos.filter((p) => p.tipo === 'Vitall')

  const filterFn = PERIODO_FILTER[periodo]
  const items = gastos
    .filter((g) => filterFn(g.fecha))
    .sort((a, b) => compareISODesc(a.fecha, b.fecha))
    .map((g) => ({
      id: g.id,
      name: g.concepto,
      tipoRaw: g.categoria,
      cat: g.categoria === 'Whimm'
        ? `Whimm · ${g.categoriaWhimm || 'sin categoría'}`
        : g.categoria === 'Vitall'
          ? `Vitall · ${g.vitallNombre || 'sin vincular'}`
          : g.categoria,
      date: formatShortDate(g.fecha),
      amount: Number(g.monto) || 0,
    }))

  const vitallGastado = items.filter((it) => it.tipoRaw === 'Vitall').reduce((s, it) => s + it.amount, 0)
  const whimmGastado = items.filter((it) => it.tipoRaw === 'Whimm').reduce((s, it) => s + it.amount, 0)

  function openEdit(id) {
    const g = gastos.find((x) => x.id === id)
    if (!g) return
    setEditForm({
      concepto: g.concepto || '',
      monto: String(g.monto ?? ''),
      lugar: g.lugar || '',
      categoria: g.categoria || 'Whimm',
      categoriaWhimm: g.categoriaWhimm || (cats[0] || ''),
      vitallId: g.vitallId || '',
    })
    setEditingId(id)
    setSwipeOpenKey(null)
  }

  async function saveEdit() {
    if (!editForm.concepto.trim() || !Number(editForm.monto)) return
    setSavingEdit(true)
    try {
      const vitallDoc = editForm.categoria === 'Vitall' ? vitalls.find((v) => v.id === editForm.vitallId) : null
      await updateUserDoc(user.uid, 'gastos', editingId, {
        concepto: editForm.concepto.trim(),
        monto: Number(editForm.monto),
        lugar: editForm.lugar.trim(),
        categoria: editForm.categoria,
        categoriaWhimm: editForm.categoria === 'Whimm' ? editForm.categoriaWhimm : '',
        vitallId: editForm.categoria === 'Vitall' ? editForm.vitallId : '',
        vitallNombre: vitallDoc ? vitallDoc.name : '',
      })
      setEditingId(null)
      setEditForm(null)
      show('Gasto actualizado')
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    } finally {
      setSavingEdit(false)
    }
  }

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
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, marginTop: 3 }}>{fmt(vitallGastado + whimmGastado)}</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div className="card" style={{ flex: 1, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Vitall</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: 'var(--wine3)' }}>{fmt(vitallGastado)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Whimm</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: 'var(--wine4)' }}>{fmt(whimmGastado)}</div>
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
              onEdit={openEdit}
            />
          ))}
          {!loading && !error && items.length === 0 && <div className="empty-state">Sin gastos en este periodo</div>}
        </div>
      </div>

      {editingId && editForm && (
        <>
          <div className="sheet-backdrop" onClick={() => { setEditingId(null); setEditForm(null) }} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 14px' }}>
                <button aria-label="Cerrar" onClick={() => { setEditingId(null); setEditForm(null) }}>
                  <IconClose />
                </button>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Editar gasto</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="fld"
                  placeholder="Concepto"
                  value={editForm.concepto}
                  onChange={(e) => setEditForm((f) => ({ ...f, concepto: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="fld"
                    placeholder="Monto"
                    inputMode="decimal"
                    value={editForm.monto}
                    onChange={(e) => setEditForm((f) => ({ ...f, monto: e.target.value }))}
                  />
                  <input
                    className="fld"
                    placeholder="Lugar (opcional)"
                    value={editForm.lugar}
                    onChange={(e) => setEditForm((f) => ({ ...f, lugar: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Whimm', 'Vitall'].map((t) => (
                    <button
                      key={t}
                      className="pill"
                      style={{ flex: 1, background: editForm.categoria === t ? 'var(--wine)' : 'var(--card)', color: editForm.categoria === t ? '#fff' : 'var(--muted)', border: editForm.categoria === t ? 'none' : '1px solid var(--beige3)' }}
                      onClick={() => setEditForm((f) => ({ ...f, categoria: t }))}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {editForm.categoria === 'Whimm' && cats.length > 0 && (
                  <div className="chiprow">
                    {cats.map((c) => (
                      <span
                        key={c}
                        onClick={() => setEditForm((f) => ({ ...f, categoriaWhimm: c }))}
                        className="pill"
                        style={{ background: editForm.categoriaWhimm === c ? 'var(--wine)' : '#fff', color: editForm.categoriaWhimm === c ? '#fff' : 'var(--muted)', border: `1px solid ${editForm.categoriaWhimm === c ? 'var(--wine)' : 'var(--beige3)'}` }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                {editForm.categoria === 'Vitall' && (
                  vitalls.length > 0 ? (
                    <div className="chiprow">
                      {vitalls.map((v) => (
                        <span
                          key={v.id}
                          onClick={() => setEditForm((f) => ({ ...f, vitallId: v.id }))}
                          className="pill"
                          style={{ background: editForm.vitallId === v.id ? 'var(--wine)' : '#fff', color: editForm.vitallId === v.id ? '#fff' : 'var(--muted)', border: `1px solid ${editForm.vitallId === v.id ? 'var(--wine)' : 'var(--beige3)'}` }}
                        >
                          {v.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Todavía no tienes ningún Vitall — crea uno primero desde "Nuevo Vitall".</div>
                  )
                )}
              </div>
              <button className="btn-primary" style={{ marginTop: 14, opacity: savingEdit ? 0.7 : 1 }} onClick={saveEdit} disabled={savingEdit}>
                Guardar cambios
              </button>
            </div>
          </div>
        </>
      )}

      <Toast message={message} />
      <AddSheet onToast={show} cats={cats} pagosFijos={pagosFijos} />
    </div>
  )
}
