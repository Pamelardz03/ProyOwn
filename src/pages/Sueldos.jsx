import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft, IconPlus, IconTrash } from '../components/Icons'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, addUserDoc, deleteUserDoc } from '../lib/firestoreCollections'
import { fmt, fmtSigned } from '../lib/format'
import { daysUntil, formatShortDate, todayISO, generarFechasPago, weekdayShort, isSunday, compareISOAsc } from '../lib/date'

const FREQS = ['Semanal', 'Quincenal', 'Mensual']

function monthlyEq(s) {
  const monto = Number(s.monto) || 0
  if (s.frecuencia === 'Semanal') return monto * 4.33
  if (s.frecuencia === 'Quincenal') return monto * 2.166
  return monto
}

function errMsg(err) {
  return `${err?.code ? `(${err.code}) ` : ''}${err?.message || 'Error desconocido'}`
}

function emptyFijo() {
  return { name: '', monto: '', fecha: todayISO() }
}
const emptyRapido = { desc: '', monto: '' }

export default function Sueldos() {
  const { user } = useAuth()
  const { data: fijos, loading: loadingFijos, error: errorFijos } = useUserCollection('sueldosFijos')
  const { data: rapidos, loading: loadingRapidos, error: errorRapidos } = useUserCollection('sueldosRapidos')

  const [addFijoOpen, setAddFijoOpen] = useState(false)
  const [fijoStep, setFijoStep] = useState('form') // form | validar
  const [addRapidoOpen, setAddRapidoOpen] = useState(false)
  const [formFreq, setFormFreq] = useState('Quincenal')
  const [fijoForm, setFijoForm] = useState(emptyFijo())
  const [fechasPreview, setFechasPreview] = useState([])
  const [rapidoForm, setRapidoForm] = useState(emptyRapido)
  const [saving, setSaving] = useState(false)
  const { message, show } = useToast()

  // Confirmación de borrado sin window.confirm (algunos navegadores de PWA
  // instaladas no muestran el diálogo nativo): toca el bote de basura una
  // vez para armarlo, otra vez para confirmar. Se desarma solo a los 3s.
  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'fijo' | 'rapido', id }
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

  const fijosTotal = fijos.reduce((sum, s) => sum + monthlyEq(s), 0)
  const rapidosTotal = rapidos.reduce((sum, r) => sum + (Number(r.monto) || 0), 0)
  const total = fijosTotal + rapidosTotal
  const fijosPct = total > 0 ? Math.round((fijosTotal / total) * 100) : 0

  function resetFijoFlow() {
    setFijoForm(emptyFijo())
    setFormFreq('Quincenal')
    setFechasPreview([])
    setFijoStep('form')
    setAddFijoOpen(false)
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
    setFechasPreview(generarFechasPago(formFreq, fijoForm.fecha))
    setFijoStep('validar')
  }

  function editFecha(idx, value) {
    setFechasPreview((prev) => {
      const next = [...prev]
      next[idx] = value
      return [...next].sort(compareISOAsc)
    })
  }

  async function saveFijo() {
    const monto = Number(fijoForm.monto)
    if (!fijoForm.name.trim() || !monto || fechasPreview.length === 0) return
    setSaving(true)
    try {
      const hoy = todayISO()
      const fechasOrdenadas = [...fechasPreview].sort(compareISOAsc)
      const proximaFecha = fechasOrdenadas.find((f) => f >= hoy) || fechasOrdenadas[fechasOrdenadas.length - 1]
      await addUserDoc(user.uid, 'sueldosFijos', {
        name: fijoForm.name.trim(),
        monto,
        frecuencia: formFreq,
        fecha: proximaFecha,
        fechaInicio: hoy,
        fechasPago: fechasOrdenadas,
      })
      resetFijoFlow()
      show('Sueldo fijo guardado')
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

  async function removeFijo(id) {
    try {
      await deleteUserDoc(user.uid, 'sueldosFijos', id)
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
            <button onClick={() => (addFijoOpen ? resetFijoFlow() : setAddFijoOpen(true))} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              <IconPlus size={14} color="var(--wine)" />
              Agregar
            </button>
          </div>

          {addFijoOpen && fijoStep === 'form' && (
            <div className="card" style={{ padding: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

          {addFijoOpen && fijoStep === 'validar' && (
            <div className="card" style={{ padding: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Revisa las fechas calculadas</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Corrige a mano las que caigan domingo o feriado — se marcan en rojo.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                {fechasPreview.map((f, idx) => {
                  const domingo = isSunday(f)
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', width: 20 }}>{idx + 1}</span>
                      <input
                        className="fld"
                        type="date"
                        style={{ flex: 1, borderColor: domingo ? 'var(--red)' : undefined }}
                        value={f}
                        onChange={(e) => editFecha(idx, e.target.value)}
                      />
                      <span style={{ fontSize: 10, fontWeight: 600, color: domingo ? 'var(--red)' : 'var(--muted)', width: 34 }}>
                        {weekdayShort(f)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn-primary" style={{ flex: 1, background: 'var(--beige2)', color: 'var(--text)' }} onClick={() => setFijoStep('form')}>
                  Volver
                </button>
                <button className="btn-primary" style={{ flex: 1, opacity: saving ? 0.7 : 1 }} onClick={saveFijo} disabled={saving}>
                  Confirmar y guardar
                </button>
              </div>
            </div>
          )}

          {errorFijos && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{errorFijos}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fijos.map((s) => {
              const dias = daysUntil(s.fecha)
              const armed = confirmDelete?.type === 'fijo' && confirmDelete?.id === s.id
              return (
                <div key={s.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round"><path d="M10 14V6M6.5 9.5 10 6l3.5 3.5" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {s.frecuencia} · Próximo {formatShortDate(s.fecha)}{dias != null ? ` · en ${dias} días` : ''}
                    </div>
                    {s.fechaInicio && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Desde {formatShortDate(s.fechaInicio)}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 500, color: 'var(--green)' }}>{fmtSigned(s.monto)}</div>
                    <button
                      aria-label={armed ? 'Confirmar eliminación' : 'Eliminar'}
                      style={{ padding: 2, display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => armOrDelete('fijo', s.id, () => removeFijo(s.id))}
                    >
                      {armed && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>¿Seguro?</span>}
                      <IconTrash size={14} color={armed ? 'var(--red)' : 'var(--muted)'} />
                    </button>
                  </div>
                </div>
              )
            })}
            {!loadingFijos && !errorFijos && fijos.length === 0 && <div className="empty-state">Sin sueldos fijos todavía</div>}
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

      <Toast message={message} />
    </div>
  )
}
