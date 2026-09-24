import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSwipeX } from '../hooks/useSwipe'
import { IconChevronLeft, IconCard, IconTrash, IconEdit } from '../components/Icons'
import Toggle from '../components/Toggle'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { fmt } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, updateUserDoc, deleteUserDoc } from '../lib/firestoreCollections'
import { formatShortDate, daysUntil, todayISO } from '../lib/date'
import { proximoVencimientoPagoFijo } from '../lib/budget'

const TIPOS = ['Vitall', 'Vivienda', 'Transporte', 'Deuda']
const FREQS = ['Semanal', 'Quincenal', 'Mensual']

const TIPO_COLORS = {
  Vitall: { color: '#7c8c5a', bg: '#dde3c8' },
  Vivienda: { color: 'var(--wine)', bg: 'var(--beige2)' },
  Transporte: { color: 'var(--amber)', bg: '#ecdfc7' },
  Deuda: { color: 'var(--red)', bg: 'var(--red-bg)' },
}

function monthlyEq(p) {
  const monto = Number(p.monto) || 0
  return p.frecuencia === 'Semanal' ? Math.round(monto * 4.33) : monto
}

function errMsg(err) {
  return `${err?.code ? `(${err.code}) ` : ''}${err?.message || 'Error desconocido'}`
}

function ToggleRow({ label, hint, on, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>
      </div>
      <Toggle on={on} onClick={onClick} ariaLabel={label} />
    </div>
  )
}

// Fila de un pago fijo: tocar el lápiz abre la hoja de edición completa
// (nombre, monto, categoría, frecuencia, fin, notificaciones), el
// vencimiento sigue editable inline para cambios rápidos, y la única
// forma de eliminar es swipe a la izquierda — igual patrón que
// FijoRow/ExpenseRow en el resto de la app (antes usaba un tap-armar +
// "¿Seguro?" aparte, inconsistente con el resto).
function PagoFijoRow({ p, isSwipeOpen, onSwipeChange, onEdit, onDelete, onToggleActivo, onSetFecha }) {
  const { x, dragging, handlers } = useSwipeX({
    isOpen: isSwipeOpen,
    onChange: onSwipeChange,
  })
  const colors = TIPO_COLORS[p.tipo] || TIPO_COLORS.Vitall
  const proximo = proximoVencimientoPagoFijo(p)
  const dias = daysUntil(proximo)
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
          aria-label="Eliminar pago fijo"
          onClick={onDelete}
          style={{ width: 72, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconTrash color="#fff" />
        </button>
      </div>
      <div
        className="card card-solid"
        onPointerDown={(e) => { if (!e.target.closest('button') && !e.target.closest('input')) handlers.onPointerDown(e) }}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={(e) => { if (!e.target.closest('button') && !e.target.closest('input')) handlers.onPointerUp(e) }}
        onPointerCancel={handlers.onPointerCancel}
        style={{
          position: 'relative',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform .12s ease',
          touchAction: 'pan-y',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="icon-tile" style={{ width: 38, height: 38 }}>
            <IconCard size={17} color="var(--wine4)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
              <span style={{ fontSize: 9, fontWeight: 600, color: colors.color, background: colors.bg, padding: '2px 7px', borderRadius: 6 }}>{p.tipo}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
              {p.frecuencia} · Próximo {proximo ? formatShortDate(proximo) : 'sin fecha'}{dias != null ? ` · en ${dias} día${dias === 1 ? '' : 's'}` : ''}
              {p.finito && p.numPagos ? ` · ${p.numPagos} pagos` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(p.monto)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button aria-label="Editar pago fijo" onClick={onEdit} style={{ padding: 2 }}>
                <IconEdit size={14} color="var(--muted)" />
              </button>
              <Toggle on={p.activo} onClick={onToggleActivo} ariaLabel={`Activar ${p.name}`} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>Vencimiento:</span>
          <input className="fld" style={{ flex: 1, padding: '7px 10px' }} type="date" value={p.fecha || todayISO()} onChange={(e) => onSetFecha(e.target.value)} />
        </div>
      </div>
    </div>
  )
}

export default function PreciosFijos() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: items, loading, error } = useUserCollection('pagosFijos')
  const [tipo, setTipo] = useState('todos')
  const { message, show } = useToast()

  // Abrir directo la edición de un pago fijo/Vitall al llegar desde
  // Historial (a pedido de Pame, vigésima séptima tanda).
  useEffect(() => {
    if (location.state?.openPagoId) {
      const p = items.find((x) => x.id === location.state.openPagoId)
      if (p) openEdit(p)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, items])

  const [swipeOpenId, setSwipeOpenId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  // Diálogo al pausar un pago fijo/Vitall desde el switch (vigésima
  // séptima tanda, a pedido de Pame: "si se desactiva debe de decir si
  // solo uno o indefinido el desactivado") — pausar SIEMPRE pregunta si
  // es solo la próxima ocurrencia (usa `excepciones`, igual que editar
  // un día desde Historial) o indefinido (`activo: false`, como ya
  // existía); reactivar (cuando ya estaba desactivado) no pregunta nada,
  // solo tiene un sentido posible.
  const [pauseDialogFor, setPauseDialogFor] = useState(null) // pago fijo pendiente de elegir alcance de pausa
  // Confirmación al eliminar el pago fijo COMPLETO (vigésima sexta tanda,
  // a pedido de Pame: "si elimina el pago en pagos fijos ahí ya es cuando
  // pregunta") — a diferencia de editar/omitir una sola ocurrencia desde
  // el Historial, esto borra la definición recurrente entera y todas sus
  // fechas futuras, así que sí necesita confirmarse.
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name }

  const totalMonthly = items.reduce((sum, p) => sum + monthlyEq(p), 0)
  // Categorías reales que existen en los pagos fijos de Pame (no solo las
  // 4 clásicas) — así el filtro siempre puede mostrar cualquier categoría
  // que ella haya creado desde "Pago fijo" (categoría abierta, quinta tanda).
  const tiposReales = [...new Set(items.map((p) => p.tipo).filter(Boolean))].sort()
  const filtered = items.filter((p) => tipo === 'todos' || p.tipo === tipo)

  async function setFecha(id, fecha) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', id, { fecha })
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${errMsg(err)}`)
    }
  }

  async function reactivarPago(p) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', p.id, { activo: true })
      show('Pago fijo reactivado')
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${errMsg(err)}`)
    }
  }

  async function pausarSoloProximaVez(p) {
    try {
      const hoy = todayISO()
      const proxima = proximoVencimientoPagoFijo(p, hoy)
      if (!proxima) { setPauseDialogFor(null); return }
      const excepciones = { ...(p.excepciones || {}), [proxima]: { omitida: true } }
      await updateUserDoc(user.uid, 'pagosFijos', p.id, { excepciones })
      setPauseDialogFor(null)
      show(`Se salta el cobro del ${formatShortDate(proxima)} — vuelve normal en el siguiente`)
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${errMsg(err)}`)
    }
  }

  async function pausarIndefinido(p) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', p.id, { activo: false })
      setPauseDialogFor(null)
      show('Pago fijo desactivado')
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${errMsg(err)}`)
    }
  }

  function handleToggleActivo(p) {
    if (p.activo === false) {
      reactivarPago(p)
    } else {
      setPauseDialogFor(p)
    }
  }

  async function removePago(id) {
    try {
      await deleteUserDoc(user.uid, 'pagosFijos', id)
      setSwipeOpenId(null)
      show('Pago fijo eliminado')
    } catch (err) {
      console.error(err)
      show(`No se pudo eliminar: ${errMsg(err)}`)
    }
  }

  function openEdit(p) {
    setEditing(p)
    setEditForm({
      name: p.name,
      monto: String(p.monto),
      tipo: p.tipo || '',
      frecuencia: p.frecuencia || 'Mensual',
      fecha: p.fecha || todayISO(),
      finito: !!p.finito,
      numPagos: p.numPagos ? String(p.numPagos) : '',
      notifFormal: p.notifFormal !== false,
      notifMini: p.notifMini !== false,
    })
    setSwipeOpenId(null)
  }

  function closeEdit() {
    setEditing(null)
    setEditForm(null)
  }

  async function saveEdit() {
    if (!editing || !editForm) return
    const monto = Number(editForm.monto)
    if (!editForm.name.trim()) { show('Falta el nombre'); return }
    if (!monto) { show('Falta el monto'); return }
    if (!editForm.tipo.trim()) { show('Falta la categoría'); return }
    setSaving(true)
    try {
      await updateUserDoc(user.uid, 'pagosFijos', editing.id, {
        name: editForm.name.trim(),
        monto,
        tipo: editForm.tipo.trim(),
        frecuencia: editForm.frecuencia,
        fecha: editForm.fecha,
        finito: editForm.finito,
        numPagos: editForm.finito ? (Number(editForm.numPagos) || null) : null,
        notifFormal: editForm.notifFormal,
        notifMini: editForm.notifMini,
      })
      show('Pago fijo actualizado')
      closeEdit()
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${errMsg(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/perfil" aria-label="Volver" className="back-btn"><IconChevronLeft /></Link>
          <div style={{ fontSize: 19, fontWeight: 600, flex: 1 }}>Precios fijos</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Total fijo mensual</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{fmt(totalMonthly)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Pagos activos</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{items.filter((p) => p.activo).length}</div>
          </div>
        </div>
        <div className="chiprow">
          <span onClick={() => setTipo('todos')} className="pill" style={{ background: tipo === 'todos' ? 'var(--wine)' : 'transparent', color: tipo === 'todos' ? '#fff' : 'var(--muted)' }}>Todos</span>
          {tiposReales.map((t) => (
            <span key={t} onClick={() => setTipo(t)} className="pill" style={{ background: tipo === t ? 'var(--wine)' : 'transparent', color: tipo === t ? '#fff' : 'var(--muted)' }}>{t}</span>
          ))}
        </div>
        {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((p) => (
            <PagoFijoRow
              key={p.id}
              p={p}
              isSwipeOpen={swipeOpenId === p.id}
              onSwipeChange={(open) => setSwipeOpenId(open ? p.id : null)}
              onEdit={() => openEdit(p)}
              onDelete={() => setConfirmDelete({ id: p.id, name: p.name })}
              onToggleActivo={() => handleToggleActivo(p)}
              onSetFecha={(fecha) => setFecha(p.id, fecha)}
            />
          ))}
          {!loading && !error && filtered.length === 0 && <div className="empty-state">Sin pagos fijos de este tipo</div>}
        </div>
      </div>

      {editing && editForm && (
        <>
          <div className="sheet-backdrop" onClick={closeEdit} />
          <div className="sheet" style={{ maxHeight: '90%' }}>
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Editar &quot;{editing.name}&quot;</div>
              <input
                className="fld"
                placeholder="Nombre"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="fld"
                placeholder="Monto"
                inputMode="decimal"
                value={editForm.monto}
                onChange={(e) => setEditForm((f) => ({ ...f, monto: e.target.value }))}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Categoría</div>
              <div className="chiprow">
                {[...new Set([...TIPOS, editForm.tipo].filter(Boolean))].map((t) => (
                  <span
                    key={t}
                    onClick={() => setEditForm((f) => ({ ...f, tipo: t }))}
                    className="pill"
                    style={{ background: editForm.tipo === t ? 'var(--wine)' : 'var(--beige2)', color: editForm.tipo === t ? '#fff' : 'var(--muted)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <input
                className="fld"
                placeholder="O escribe una categoría nueva"
                value={editForm.tipo}
                onChange={(e) => setEditForm((f) => ({ ...f, tipo: e.target.value }))}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Frecuencia</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {FREQS.map((f) => (
                  <span
                    key={f}
                    onClick={() => setEditForm((form) => ({ ...form, frecuencia: f }))}
                    style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 10, background: editForm.frecuencia === f ? 'var(--wine)' : 'var(--card)', color: editForm.frecuencia === f ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 600 }}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Próximo vencimiento</div>
              <input
                className="fld"
                type="date"
                value={editForm.fecha}
                onChange={(e) => setEditForm((f) => ({ ...f, fecha: e.target.value }))}
              />
              <ToggleRow label="¿Tiene fin?" hint="ej. compra a meses sin intereses" on={editForm.finito} onClick={() => setEditForm((f) => ({ ...f, finito: !f.finito }))} />
              {editForm.finito && (
                <input
                  className="fld"
                  placeholder="Número de pagos (ej. 12)"
                  inputMode="numeric"
                  value={editForm.numPagos}
                  onChange={(e) => setEditForm((f) => ({ ...f, numPagos: e.target.value }))}
                />
              )}
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>NOTIFICACIONES</div>
              <ToggleRow label="Recordatorio formal" hint="2 días antes" on={editForm.notifFormal} onClick={() => setEditForm((f) => ({ ...f, notifFormal: !f.notifFormal }))} />
              <ToggleRow label="Recordatorio mini" hint="Diario, desde que se activa hasta el día de pago" on={editForm.notifMini} onClick={() => setEditForm((f) => ({ ...f, notifMini: !f.notifMini }))} />
              <button className="btn-primary" style={{ marginTop: 4, opacity: saving ? 0.7 : 1 }} onClick={saveEdit} disabled={saving}>
                Guardar cambios
              </button>
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <>
          <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>¿Eliminar &quot;{confirmDelete.name}&quot;?</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                Esto borra el pago fijo por completo, incluyendo todas sus fechas futuras. Si solo un día no se cobró como siempre, es mejor editarlo desde el Historial en vez de borrar esto.
              </div>
              <button
                className="btn-primary"
                style={{ background: 'var(--red)', marginTop: 4 }}
                onClick={() => { removePago(confirmDelete.id); setConfirmDelete(null) }}
              >
                Eliminar de todos modos
              </button>
              <button className="pill" style={{ textAlign: 'center' }} onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {pauseDialogFor && (
        <>
          <div className="sheet-backdrop" onClick={() => setPauseDialogFor(null)} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Pausar &quot;{pauseDialogFor.name}&quot;</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                No es lo mismo que eliminarlo — elige qué tan larga es la pausa:
              </div>
              <button
                className="btn-primary"
                style={{ background: 'var(--beige2)', color: 'var(--text)', textAlign: 'left', padding: 12 }}
                onClick={() => pausarSoloProximaVez(pauseDialogFor)}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>Solo la próxima vez</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Se salta únicamente el próximo cobro y vuelve a activarse solo en el que sigue.
                </div>
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--red)', textAlign: 'left', padding: 12 }}
                onClick={() => pausarIndefinido(pauseDialogFor)}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>Desactivar indefinido</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>
                  Deja de cobrarse/reservarse hasta que tú lo reactives con el mismo switch. Su historial se conserva.
                </div>
              </button>
              <button style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }} onClick={() => setPauseDialogFor(null)}>
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
