import { useRef, useState } from 'react'
import { useSwipeX } from '../hooks/useSwipe'
import { Link } from 'react-router-dom'
import { IconChevronLeft, IconPlus, IconTrash, IconEdit } from '../components/Icons'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, addUserDoc, updateUserDoc, deleteUserDoc } from '../lib/firestoreCollections'
import { fmt, fmtSigned } from '../lib/format'
import { daysUntil, formatShortDate, todayISO, generarFechasPago, weekdayShort, isSunday, isFeriadoMX, compareISOAsc, parseISODate, daysInMonth } from '../lib/date'
import { proximaFechaSueldo, fechasPagoVivas, ingresoDelMesSueldo } from '../lib/budget'

const FREQS = ['Semanal', 'Quincenal', 'Mensual']
const MES_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Metadatos del mes de un mini-calendario (igual patrón que Calendario.jsx:
// huecos iniciales + total de días del mes). Se reusa tanto para "Validar
// fechas" (paso 2 de agregar) como para el detalle de un sueldo existente.
function monthMeta(offset) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const year = first.getFullYear()
  const month = first.getMonth()
  return { year, month, leading: first.getDay(), total: daysInMonth(year, month), label: `${MES_FULL[month]} ${year}` }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function isoOfDay(year, month, day) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

// A qué mes (offset relativo a hoy) navegar al abrir un calendario, para
// que abra directo en el mes de la fecha dada.
function monthOffsetFromISO(iso) {
  const d = parseISODate(iso)
  if (!d) return 0
  const now = new Date()
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
}

// Construye los días marcados de un mes dado un set de fechas ISO — usado
// por el calendario de "Validar fechas" y por el detalle de un sueldo ya
// guardado, para no duplicar la lógica de armado del grid.
function buildCalDays(offset, fechaSet) {
  const meta = monthMeta(offset)
  const days = []
  for (let i = 0; i < meta.leading; i++) days.push(null)
  for (let d = 1; d <= meta.total; d++) {
    const iso = isoOfDay(meta.year, meta.month, d)
    days.push({ day: d, iso, marcado: fechaSet.has(iso), alerta: isSunday(iso) || isFeriadoMX(iso) })
  }
  while (days.length % 7 !== 0) days.push(null)
  return { meta, days }
}

function errMsg(err) {
  return `${err?.code ? `(${err.code}) ` : ''}${err?.message || 'Error desconocido'}`
}

function emptyFijo() {
  return { name: '', monto: '', fecha: todayISO() }
}
const emptyRapido = { desc: '', monto: '' }

// Fila de un sueldo fijo: tocar el cuerpo abre el detalle-calendario,
// el lápiz abre el formulario de edición, y la única forma de eliminar
// es swipe a la izquierda (revela el bote de basura), igual patrón que
// ExpenseRow en Gastos.jsx.
function FijoRow({ s, isSwipeOpen, onSwipeChange, onOpenDetail, onEdit, onDelete }) {
  const { x, dragging, handlers } = useSwipeX({
    isOpen: isSwipeOpen,
    onChange: onSwipeChange,
    onTap: () => { if (isSwipeOpen) onSwipeChange(false); else onOpenDetail() },
  })
  const proxima = proximaFechaSueldo(s)
  const dias = daysUntil(proxima)
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          opacity: x < -4 ? 1 : 0,
          pointerEvents: isSwipeOpen ? 'auto' : 'none',
          transition: dragging ? 'none' : 'opacity .12s ease',
        }}
      >
        <button
          aria-label="Eliminar sueldo fijo"
          onClick={onDelete}
          style={{ width: 72, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconTrash color="#fff" />
        </button>
      </div>
      <div
        className="card"
        onPointerDown={(e) => { if (!e.target.closest('button')) handlers.onPointerDown(e) }}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={(e) => { if (!e.target.closest('button')) handlers.onPointerUp(e) }}
        onPointerCancel={handlers.onPointerCancel}
        style={{
          position: 'relative',
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform .12s ease',
          touchAction: 'pan-y',
          cursor: 'pointer',
        }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round"><path d="M10 14V6M6.5 9.5 10 6l3.5 3.5" /></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {s.frecuencia}{proxima ? ` · Próximo ${formatShortDate(proxima)}${dias != null ? ` · en ${dias} días` : ''}` : ' · sin próxima fecha'}
          </div>
          {s.fechaInicio && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Desde {formatShortDate(s.fechaInicio)}</div>
          )}
          {s.fechaFin && (
            <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 1 }}>Detenido desde {formatShortDate(s.fechaFin)}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div className="mono" style={{ fontSize: 14, fontWeight: 500, color: 'var(--green)' }}>{fmtSigned(s.monto)}</div>
          <button aria-label="Editar sueldo fijo" onClick={onEdit} style={{ padding: 2 }}>
            <IconEdit size={14} color="var(--muted)" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sueldos() {
  const { user } = useAuth()
  const { data: fijos, loading: loadingFijos, error: errorFijos } = useUserCollection('sueldosFijos')
  const { data: rapidos, loading: loadingRapidos, error: errorRapidos } = useUserCollection('sueldosRapidos')

  const [addFijoOpen, setAddFijoOpen] = useState(false)
  const [fijoStep, setFijoStep] = useState('form') // form | validar
  const [editingFijoId, setEditingFijoId] = useState(null)
  const [addRapidoOpen, setAddRapidoOpen] = useState(false)
  const [formFreq, setFormFreq] = useState('Quincenal')
  const [fijoForm, setFijoForm] = useState(emptyFijo())
  const [fechasPreview, setFechasPreview] = useState([])
  const [validarMonthOffset, setValidarMonthOffset] = useState(0)
  const [selectedFecha, setSelectedFecha] = useState(null)
  const [swipeOpen, setSwipeOpen] = useState(false)
  const [confirmDeleteFechaOpen, setConfirmDeleteFechaOpen] = useState(false)
  const detailSwipe = useSwipeX({ isOpen: swipeOpen, onChange: setSwipeOpen, onTap: () => {} })
  const [rapidoForm, setRapidoForm] = useState(emptyRapido)
  const [saving, setSaving] = useState(false)
  const { message, show } = useToast()

  // Fila de sueldo fijo con swipe abierto (revela el bote de basura) —
  // solo una a la vez, igual que swipeOpenKey en Gastos.jsx.
  const [swipeOpenFijoId, setSwipeOpenFijoId] = useState(null)
  const [deleteScopeFor, setDeleteScopeFor] = useState(null) // sueldo fijo pendiente de elegir alcance de borrado

  // Detalle de calendario (solo lectura) de un sueldo fijo ya guardado,
  // abierto al tocar su fila.
  const [detailFijo, setDetailFijo] = useState(null)
  const [detailMonthOffset, setDetailMonthOffset] = useState(0)

  // Confirmación de borrado sin window.confirm (algunos navegadores de PWA
  // instaladas no muestran el diálogo nativo): toca el bote de basura una
  // vez para armarlo, otra vez para confirmar. Se desarma solo a los 3s.
  // (Ya solo se usa para "Sueldos rápidos" — los fijos se eliminan con
  // swipe a la izquierda.)
  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'rapido', id }
  const confirmTimeout = useRef(null)

  function armOrDelete(type, id, doDelete) {
    if (confirmDelete && confirmDelete.type === type && confirmDelete.id === id) {
      clearTimeout(confirmTimeout.current)
      setConfirmDelete(null)
      doDelete()
      return
    }
    clearTimeout(confirmTimeout.current)
    setConfirmDelete({ type, id })
    confirmTimeout.current = setTimeout(() => setConfirmDelete(null), 3000)
  }

  const fijosTotal = fijos.reduce((sum, s) => sum + ingresoDelMesSueldo(s), 0)
  const rapidosTotal = rapidos.reduce((sum, r) => sum + (Number(r.monto) || 0), 0)
  const total = fijosTotal + rapidosTotal
  const fijosPct = total > 0 ? Math.round((fijosTotal / total) * 100) : 0

  function resetFijoFlow() {
    setFijoForm(emptyFijo())
    setFormFreq('Quincenal')
    setFechasPreview([])
    setSelectedFecha(null)
    setSwipeOpen(false)
    setConfirmDeleteFechaOpen(false)
    setEditingFijoId(null)
    setFijoStep('form')
    setAddFijoOpen(false)
  }

  // Vuelve al paso 1 sin cerrar todo el flujo (botón "Volver" y tocar fuera
  // del calendario) — a diferencia de resetFijoFlow, conserva lo escrito
  // en el formulario (nombre/monto/fecha ancla/frecuencia) y si se está
  // editando un sueldo existente.
  function backToForm() {
    setSelectedFecha(null)
    setSwipeOpen(false)
    setConfirmDeleteFechaOpen(false)
    setFijoStep('form')
  }

  // Paso 1 → 2: calcula las fechas de pago a partir de la fecha ancla para
  // que Pame las revise (y corrija domingos/feriados) antes de guardar.
  // Antes fallaba en silencio si faltaba un campo (parecía que el botón no
  // hacía nada) — ahora avisa con un toast cuál es el que falta.
  function goValidarFechas() {
    const monto = Number(fijoForm.monto)
    if (!fijoForm.name.trim()) { show('Falta el nombre del sueldo'); return }
    if (!monto) { show('Falta el monto'); return }
    if (!fijoForm.fecha) { show('Falta la fecha del último pago'); return }
    const fechas = generarFechasPago(formFreq, fijoForm.fecha)
    setFechasPreview(fechas)
    setValidarMonthOffset(monthOffsetFromISO(fechas[0]))
    setSelectedFecha(null)
    setSwipeOpen(false)
    setConfirmDeleteFechaOpen(false)
    setFijoStep('validar')
  }

  function editFecha(idx, value) {
    setFechasPreview((prev) => {
      const next = [...prev]
      next[idx] = value
      return [...next].sort(compareISOAsc)
    })
  }

  // Edita la fecha que está abierta en el detalle del calendario (paso
  // "Validar fechas") — reemplaza la lista de inputs de antes.
  function editSelectedFecha(value) {
    if (!selectedFecha) return
    const idx = fechasPreview.indexOf(selectedFecha)
    if (idx === -1) return
    editFecha(idx, value)
    setSelectedFecha(value)
  }

  // Única forma de quitar una fecha calculada: swipe a la izquierda sobre
  // su detalle (revela el bote de basura) + confirmar en el mensaje.
  function confirmRemoveSelectedFecha() {
    setFechasPreview((prev) => prev.filter((f) => f !== selectedFecha))
    setSelectedFecha(null)
    setSwipeOpen(false)
    setConfirmDeleteFechaOpen(false)
  }

  // Abre el formulario de edición de un sueldo fijo ya guardado (lápiz):
  // reusa el mismo flujo de 2 pasos que "Agregar", precargado con sus
  // datos y sus fechas ya calculadas (en vez de regenerarlas desde cero).
  function openFijoEdit(s) {
    setFijoForm({ name: s.name, monto: String(s.monto), fecha: s.fecha || todayISO() })
    setFormFreq(s.frecuencia)
    setEditingFijoId(s.id)
    setFechasPreview(Array.isArray(s.fechasPago) && s.fechasPago.length ? [...s.fechasPago] : s.fecha ? [s.fecha] : [])
    setValidarMonthOffset(monthOffsetFromISO(proximaFechaSueldo(s) || s.fecha))
    setSelectedFecha(null)
    setSwipeOpen(false)
    setConfirmDeleteFechaOpen(false)
    setSwipeOpenFijoId(null)
    setAddFijoOpen(true)
    setFijoStep('form')
  }

  // Abre el detalle-calendario (solo lectura) de un sueldo fijo ya
  // guardado, marcando sus fechas de pago vigentes (indefinidas — se
  // extienden solas hacia el futuro, ver lib/budget.js).
  function openFijoDetail(s) {
    setDetailFijo(s)
    setDetailMonthOffset(monthOffsetFromISO(proximaFechaSueldo(s) || s.fecha))
  }

  async function saveFijo() {
    const monto = Number(fijoForm.monto)
    if (!fijoForm.name.trim() || !monto || fechasPreview.length === 0) return
    setSaving(true)
    try {
      const hoy = todayISO()
      const fechasOrdenadas = [...fechasPreview].sort(compareISOAsc)
      const proximaFecha = fechasOrdenadas.find((f) => f >= hoy) || fechasOrdenadas[fechasOrdenadas.length - 1]
      const payload = {
        name: fijoForm.name.trim(),
        monto,
        frecuencia: formFreq,
        fecha: proximaFecha,
        fechasPago: fechasOrdenadas,
      }
      if (editingFijoId) {
        await updateUserDoc(user.uid, 'sueldosFijos', editingFijoId, payload)
        show('Sueldo fijo actualizado')
      } else {
        await addUserDoc(user.uid, 'sueldosFijos', { ...payload, fechaInicio: hoy })
        show('Sueldo fijo guardado')
      }
      resetFijoFlow()
    } catch (err) {
      console.error(err)
      show(`No se pudo guardar: ${errMsg(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function saveRapido() {
    const monto = Number(rapidoForm.monto)
    if (!rapidoForm.desc.trim() || !monto) return
    setSaving(true)
    try {
      await addUserDoc(user.uid, 'sueldosRapidos', {
        desc: rapidoForm.desc.trim(),
        monto,
        fecha: todayISO(),
      })
      setRapidoForm(emptyRapido)
      setAddRapidoOpen(false)
      show('Sueldo rápido guardado')
    } catch (err) {
      console.error(err)
      show(`No se pudo guardar: ${errMsg(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function stopFijoFromToday(id) {
    try {
      await updateUserDoc(user.uid, 'sueldosFijos', id, { fechaFin: todayISO() })
      setDeleteScopeFor(null)
      setSwipeOpenFijoId(null)
      show('Sueldo detenido — su historial se conserva')
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${errMsg(err)}`)
    }
  }

  async function removeFijo(id) {
    try {
      await deleteUserDoc(user.uid, 'sueldosFijos', id)
      setSwipeOpenFijoId(null)
      show('Sueldo fijo eliminado')
    } catch (err) {
      console.error(err)
      show(`No se pudo eliminar: ${errMsg(err)}`)
    }
  }

  async function removeRapido(id) {
    try {
      await deleteUserDoc(user.uid, 'sueldosRapidos', id)
      show('Sueldo rápido eliminado')
    } catch (err) {
      console.error(err)
      show(`No se pudo eliminar: ${errMsg(err)}`)
    }
  }

  const fechaSet = new Set(fechasPreview)
  const { meta: validarMeta, days: calDays } = buildCalDays(validarMonthOffset, fechaSet)

  const detailFechaSet = detailFijo ? new Set(fechasPagoVivas(detailFijo)) : new Set()
  const { meta: detailMeta, days: detailCalDays } = detailFijo
    ? buildCalDays(detailMonthOffset, detailFechaSet)
    : { meta: null, days: [] }

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
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>Ingresos de este mes</div>
          <div className="mono stat-display" style={{ fontSize: 28, marginTop: 6 }}>{fmt(total)}</div>
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
          <div className="eyebrow" style={{ marginBottom: 2 }}>Ingresos recurrentes</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Sueldos fijos</div>
            <button onClick={() => (addFijoOpen ? resetFijoFlow() : setAddFijoOpen(true))} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              <IconPlus size={14} color="var(--wine)" />
              Agregar
            </button>
          </div>

          {addFijoOpen && fijoStep === 'form' && (
            <div className="card" style={{ padding: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {editingFijoId && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--wine)' }}>Editando sueldo fijo</div>}
              <input
                className="fld"
                placeholder="Nombre (ej. Sueldo principal)"
                value={fijoForm.name}
                onChange={(e) => setFijoForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="fld"
                placeholder="Monto"
                inputMode="decimal"
                value={fijoForm.monto}
                onChange={(e) => setFijoForm((f) => ({ ...f, monto: e.target.value }))}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Último día de pago (o el próximo que esperas)</div>
              <input
                className="fld"
                type="date"
                value={fijoForm.fecha}
                onChange={(e) => setFijoForm((f) => ({ ...f, fecha: e.target.value }))}
              />
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
              <button className="btn-primary" style={{ marginTop: 4 }} onClick={goValidarFechas}>
                Validar fechas
              </button>
            </div>
          )}

          {errorFijos && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{errorFijos}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fijos.map((s) => (
              <FijoRow
                key={s.id}
                s={s}
                isSwipeOpen={swipeOpenFijoId === s.id}
                onSwipeChange={(open) => setSwipeOpenFijoId(open ? s.id : null)}
                onOpenDetail={() => openFijoDetail(s)}
                onEdit={() => openFijoEdit(s)}
                onDelete={() => setDeleteScopeFor(s)}
              />
            ))}
            {!loadingFijos && !errorFijos && fijos.length === 0 && <div className="empty-state">Sin sueldos fijos todavía</div>}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Ingresos únicos</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Sueldos rápidos</div>
            <button onClick={() => setAddRapidoOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              <IconPlus size={14} color="var(--wine)" />
              Agregar
            </button>
          </div>

          {addRapidoOpen && (
            <div className="card" style={{ padding: 14, marginTop: 10, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="fld"
                placeholder="Descripción (ej. Lavado de ropa)"
                value={rapidoForm.desc}
                onChange={(e) => setRapidoForm((f) => ({ ...f, desc: e.target.value }))}
              />
              <input
                className="fld"
                placeholder="Monto"
                inputMode="decimal"
                value={rapidoForm.monto}
                onChange={(e) => setRapidoForm((f) => ({ ...f, monto: e.target.value }))}
              />
              <button className="btn-primary" style={{ marginTop: 4, opacity: saving ? 0.7 : 1 }} onClick={saveRapido} disabled={saving}>
                Guardar sueldo rápido
              </button>
            </div>
          )}

          {errorRapidos && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 10 }}>{errorRapidos}</div>}

          <div className="row-list" style={{ marginTop: 10 }}>
            {rapidos.map((r) => {
              const armed = confirmDelete?.type === 'rapido' && confirmDelete?.id === r.id
              return (
                <div key={r.id} className="row-list-item">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{r.desc}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>{fmtSigned(r.monto)}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{formatShortDate(r.fecha)}</div>
                  </div>
                  <button
                    aria-label={armed ? 'Confirmar eliminación' : 'Eliminar'}
                    style={{ padding: 2, marginLeft: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => armOrDelete('rapido', r.id, () => removeRapido(r.id))}
                  >
                    {armed && <span style={{ fontSize: 9, color: 'var(--red)', fontWeight: 600 }}>¿Seguro?</span>}
                    <IconTrash size={13} color={armed ? 'var(--red)' : 'var(--muted)'} />
                  </button>
                </div>
              )
            })}
            {!loadingRapidos && !errorRapidos && rapidos.length === 0 && <div className="empty-state">Sin sueldos rápidos todavía</div>}
          </div>
        </div>
      </div>

      {addFijoOpen && fijoStep === 'validar' && (
        <>
          <div className="sheet-backdrop" onClick={backToForm} />
          <div className="sheet" style={{ maxHeight: '90%' }}>
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Revisa las fechas calculadas</div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button
                    aria-label="Mes anterior"
                    onClick={() => setValidarMonthOffset((i) => i - 1)}
                    style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 4.5 6 10l6.5 5.5" /></svg>
                  </button>
                  <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{validarMeta.label}</div>
                  <button
                    aria-label="Mes siguiente"
                    onClick={() => setValidarMonthOffset((i) => i + 1)}
                    style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5l5 5.5-5 5.5" /></svg>
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, fontSize: 10, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>
                  {['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'].map((d) => <div key={d}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                  {calDays.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                      {d && (
                        <span
                          className="mono"
                          onClick={() => {
                            if (!d.marcado) return
                            setSelectedFecha((cur) => (cur === d.iso ? null : d.iso))
                            setSwipeOpen(false)
                            setConfirmDeleteFechaOpen(false)
                          }}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 9,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            fontSize: 12,
                            cursor: d.marcado ? 'pointer' : 'default',
                            ...(d.marcado
                              ? d.alerta
                                ? { background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700, border: '2px solid var(--red)' }
                                : { background: 'var(--green)', color: '#fff', fontWeight: 700 }
                              : {}),
                            ...(selectedFecha === d.iso ? { boxShadow: '0 0 0 2px var(--text)' } : {}),
                          }}
                        >
                          {d.day}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--beige2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--green)' }} />
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Día de pago</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--red)' }} />
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Domingo o feriado</span>
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
                Esta vista solo muestra los primeros meses para que revises los días — al guardar, el sueldo sigue pagándose solo, sin fecha de fin, hasta que lo detengas o elimines.
              </div>

              {selectedFecha && (
                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      opacity: detailSwipe.x < -4 ? 1 : 0,
                      pointerEvents: swipeOpen ? 'auto' : 'none',
                      transition: detailSwipe.dragging ? 'none' : 'opacity .12s ease',
                    }}
                  >
                    <button
                      aria-label="Eliminar esta fecha"
                      onClick={() => setConfirmDeleteFechaOpen(true)}
                      style={{ width: 72, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconTrash color="#fff" />
                    </button>
                  </div>
                  <div
                    className="card"
                    style={{
                      position: 'relative',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      transform: `translateX(${detailSwipe.x}px)`,
                      transition: detailSwipe.dragging ? 'none' : 'transform .12s ease',
                    }}
                  >
                    <div
                      {...detailSwipe.handlers}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', touchAction: 'pan-y' }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {capitalize(weekdayShort(selectedFecha))} · {formatShortDate(selectedFecha)}
                      </div>
                      {isSunday(selectedFecha) && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)' }}>Cae domingo</span>}
                      {!isSunday(selectedFecha) && isFeriadoMX(selectedFecha) && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)' }}>Es día feriado</span>
                      )}
                    </div>
                    <input
                      className="fld"
                      type="date"
                      value={selectedFecha}
                      onChange={(e) => editSelectedFecha(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {confirmDeleteFechaOpen && selectedFecha && (
                <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>¿Eliminar esta fecha de pago ({formatShortDate(selectedFecha)})?</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, background: 'var(--beige2)', color: 'var(--text)' }}
                      onClick={() => { setConfirmDeleteFechaOpen(false); setSwipeOpen(false) }}
                    >
                      Cancelar
                    </button>
                    <button className="btn-primary" style={{ flex: 1, background: 'var(--red)' }} onClick={confirmRemoveSelectedFecha}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn-primary" style={{ flex: 1, background: 'var(--beige2)', color: 'var(--text)' }} onClick={backToForm}>
                  Volver
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 1, opacity: saving || fechasPreview.length === 0 ? 0.7 : 1 }}
                  onClick={saveFijo}
                  disabled={saving || fechasPreview.length === 0}
                >
                  {editingFijoId ? 'Guardar cambios' : 'Confirmar y guardar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {detailFijo && (
        <>
          <div className="sheet-backdrop" onClick={() => setDetailFijo(null)} />
          <div className="sheet" style={{ maxHeight: '90%' }}>
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{detailFijo.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {detailFijo.frecuencia} · {fmtSigned(detailFijo.monto)}{detailFijo.fechaInicio ? ` · Desde ${formatShortDate(detailFijo.fechaInicio)}` : ''}
                </div>
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button
                    aria-label="Mes anterior"
                    onClick={() => setDetailMonthOffset((i) => i - 1)}
                    style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 4.5 6 10l6.5 5.5" /></svg>
                  </button>
                  <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{detailMeta.label}</div>
                  <button
                    aria-label="Mes siguiente"
                    onClick={() => setDetailMonthOffset((i) => i + 1)}
                    style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5l5 5.5-5 5.5" /></svg>
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, fontSize: 10, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>
                  {['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'].map((d) => <div key={d}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                  {detailCalDays.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                      {d && (
                        <span
                          className="mono"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 9,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            fontSize: 12,
                            ...(d.marcado
                              ? d.alerta
                                ? { background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700, border: '2px solid var(--red)' }
                                : { background: 'var(--green)', color: '#fff', fontWeight: 700 }
                              : {}),
                          }}
                        >
                          {d.day}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--beige2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--green)' }} />
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Día de pago</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--red)' }} />
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Domingo o feriado</span>
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
                {detailFijo.fechaFin
                  ? `Detenido desde ${formatShortDate(detailFijo.fechaFin)} — su historial pasado sigue disponible`
                  : 'Sueldo fijo indefinido — sigue pagándose hasta que lo detengas o elimines'}
              </div>

              <button className="btn-primary" style={{ background: 'var(--beige2)', color: 'var(--text)' }} onClick={() => setDetailFijo(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </>
      )}

      {deleteScopeFor && (
        <>
          <div className="sheet-backdrop" onClick={() => setDeleteScopeFor(null)} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Eliminar &quot;{deleteScopeFor.name}&quot;</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Como no se guarda un registro diario de tus ingresos, elige uno de estos dos alcances:
              </div>
              <button
                className="btn-primary"
                style={{ background: 'var(--beige2)', color: 'var(--text)', textAlign: 'left', padding: 12 }}
                onClick={() => stopFijoFromToday(deleteScopeFor.id)}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>Detener a partir de hoy</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Deja de generar pagos futuros, pero conserva su nombre e historial pasado en Historial completo.
                </div>
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--red)', textAlign: 'left', padding: 12 }}
                onClick={() => { const id = deleteScopeFor.id; setDeleteScopeFor(null); removeFijo(id) }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>Eliminar todo</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>
                  Borra el sueldo, su nombre, monto e historial por completo. No se puede deshacer.
                </div>
              </button>
              <button style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }} onClick={() => setDeleteScopeFor(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      <Toast message={message} />
    </div>
  )
}
