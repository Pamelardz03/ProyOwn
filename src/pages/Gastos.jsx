import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AddSheet from '../components/AddSheet'
import { useSwipeX } from '../hooks/useSwipe'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconReceipt, IconTrash, IconEdit, IconClose, IconChevronLeft, IconChevronRight } from '../components/Icons'
import { fmt } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, useUserDoc, deleteUserDoc, updateUserDoc, setUserDoc } from '../lib/firestoreCollections'
import { formatShortDate, isToday, isThisWeek, isThisMonth, isThisYear, compareISODesc, todayISO, addDaysISO, addMonthsISO, addYearsISO, startOfWeekISO, parseISODate } from '../lib/date'
import { gastoNeto } from '../lib/budget'
import { hayCambios } from '../lib/objectDiff'
import { deriveWhimmCats } from '../lib/categorias'

const PERIODOS = ['dia', 'semana', 'mes', 'anio']
const PERIODO_LABEL = { dia: 'Día', semana: 'Semana', mes: 'Mes', anio: 'Año' }
const MES_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Convierte el timestamp de Firestore (serverTimestamp resuelto) a
// milisegundos para poder desempatar por fecha real de creación.
function toMillis(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

const PERIODO_FILTER = { dia: isToday, semana: isThisWeek, mes: isThisMonth, anio: isThisYear }

// Texto de "Gastado en {...}" — depende de qué tan lejos se haya
// navegado con las flechas < > (trigésima séptima tanda, a pedido de
// Pame: "agregale unas < > para moverte en cada uno"). Si `fechaRef`
// sigue siendo el periodo actual real, muestra el mismo texto corto de
// siempre ("hoy", "esta semana", "septiembre"); si ya se navegó a otro
// periodo, muestra la fecha/rango exacto para que quede claro cuál se
// está viendo.
function periodoLabelTexto(periodo, fechaRef) {
  const hoy = todayISO()
  if (periodo === 'dia') {
    return isToday(fechaRef) ? 'hoy' : formatShortDate(fechaRef)
  }
  if (periodo === 'semana') {
    if (isThisWeek(hoy, fechaRef)) return 'esta semana'
    const inicio = startOfWeekISO(fechaRef)
    const fin = addDaysISO(inicio, 6)
    return `del ${formatShortDate(inicio)} al ${formatShortDate(fin)}`
  }
  const ref = parseISODate(fechaRef)
  if (periodo === 'mes') {
    const mesTexto = MES_FULL[ref.getMonth()]
    return isThisMonth(hoy, fechaRef) ? mesTexto : `${mesTexto} ${ref.getFullYear()}`
  }
  // anio
  return String(ref.getFullYear())
}

// Retrocede/avanza `fechaRef` un paso del periodo seleccionado.
function moverPeriodo(periodo, fechaRef, delta) {
  if (periodo === 'dia') return addDaysISO(fechaRef, delta)
  if (periodo === 'semana') return addDaysISO(fechaRef, delta * 7)
  if (periodo === 'mes') return addMonthsISO(fechaRef, delta)
  return addYearsISO(fechaRef, delta)
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
        className="card card-solid"
        {...handlers}
        style={{ position: 'relative', padding: 13, display: 'flex', alignItems: 'center', gap: 12, transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform .12s ease', touchAction: 'pan-y' }}
      >
        <div className="icon-tile" style={{ width: 38, height: 38 }}>
          <IconReceipt size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.cat} · {item.date}</div>
          {item.reembolso > 0 && (
            <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 1 }}>+{fmt(item.reembolso)} reembolso</div>
          )}
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

// Fila de un Whimm ya comprado, mostrado dentro de Gastos junto a los
// gastos normales (a pedido de Pame: el dinero de Whimms comprados debe
// sumarse y aparecer en la lista aquí). Es de solo lectura porque el
// registro real vive en el documento del Whimm, no en `gastos` — para
// editar el precio final, el monto apartado o la fecha de compra, o para
// deshacer la compra, se hace desde Compras.
function WhimmCompraRow({ item, onGoToCompras }) {
  return (
    <div className="card card-solid" style={{ padding: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
      {item.imagenUrl ? (
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={item.imagenUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      ) : (
        <div className="icon-tile" style={{ width: 38, height: 38 }}>
          <IconProduct size={17} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Se compró: {item.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.cat} · {item.date}</div>
      </div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>-{fmt(item.amount)}</div>
      <button aria-label="Ver en Compras" onClick={() => onGoToCompras(item.whimmId)}>
        <IconEdit />
      </button>
    </div>
  )
}

export default function Gastos() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { message, show } = useToast()
  const [periodo, setPeriodo] = useState('mes')
  // Fecha de referencia del periodo que se está viendo -- por default el
  // periodo actual real (hoy). Cambiar de pestaña (día/semana/mes/año) la
  // reinicia a "ahora" en ESE periodo; las flechas < > la mueven un paso
  // hacia atrás/adelante sin cambiar de pestaña (trigésima séptima tanda).
  const [fechaRef, setFechaRef] = useState(todayISO())
  function cambiarPeriodo(p) {
    setPeriodo(p)
    setFechaRef(todayISO())
  }
  function navegarPeriodo(delta) {
    setFechaRef((f) => moverPeriodo(periodo, f, delta))
  }
  const [swipeOpenKey, setSwipeOpenKey] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const { data: gastos, loading, error } = useUserCollection('gastos')
  const { data: whimms } = useUserCollection('whimms')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: configPresupuesto } = useUserDoc('config', 'presupuesto')

  const cats = deriveWhimmCats(whimms, gastos)
  const vitalls = pagosFijos.filter((p) => p.tipo === 'Vitall')

  // Abrir directo la edición de un gasto al llegar desde Historial (a
  // pedido de Pame, vigésima séptima tanda).
  useEffect(() => {
    if (location.state?.openGastoId) {
      openEdit(location.state.openGastoId)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, gastos])


  // Al empatar en fecha (varios gastos el mismo día), el más recién creado
  // va primero — antes desempataba con el orden natural de la colección
  // (creadoEn ascendente), así que un gasto nuevo del mismo día se veía
  // hasta abajo de su grupo en vez de arriba.
  const filterFn = (iso) => PERIODO_FILTER[periodo](iso, fechaRef)
  const items = gastos
    .filter((g) => filterFn(g.fecha))
    .sort((a, b) => compareISODesc(a.fecha, b.fecha) || toMillis(b.creadoEn) - toMillis(a.creadoEn))
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
      fecha: g.fecha,
      // Neto de cualquier reembolso (treceava tanda) — lo que de verdad
      // costó, no el monto bruto registrado.
      amount: gastoNeto(g),
      reembolso: Number(g.reembolso) || 0,
    }))

  // Whimms comprados dentro del periodo — se suman al gasto de Whimm y se
  // agregan a la lista, netos de lo que ya estaba apartado en efectivo/otra
  // cuenta (esa parte no salió de la cuenta que este total representa).
  const whimmCompras = whimms
    .filter((w) => w.estado === 'comprado' && w.compradoEn && filterFn(w.compradoEn))
    .map((w) => {
      const precioFinal = Number(w.precioComprado ?? w.precio) || 0
      const yaApartado = Number(w.montoApartado) || 0
      return {
        id: `whimmcompra-${w.id}`,
        whimmId: w.id,
        name: w.name,
        cat: `Whimm · ${w.categoria || 'sin categoría'}`,
        date: formatShortDate(w.compradoEn),
        fecha: w.compradoEn,
        amount: Math.max(precioFinal - yaApartado, 0),
        imagenUrl: w.imagenUrl || '',
      }
    })

  const vitallGastado = items.filter((it) => it.tipoRaw === 'Vitall').reduce((s, it) => s + it.amount, 0)
  // Desglose de lo gastado en Whimm dentro del periodo seleccionado (a
  // pedido de Pame, vigésima novena tanda: "la suma no da lo que se ha
  // gastado... ahí es el desglose de lo que se ha gastado en mes/semana/
  // día/año" — antes estas dos tarjetas mostraban el saldo DISPONIBLE
  // para whimms/gasto hormiga, un número que no tiene nada que ver con
  // el periodo seleccionado ni con "Gastado en {periodo}" de arriba, lo
  // que hacía parecer que no cuadraban. Ahora suman exacto: gasto Whimm
  // de impulso + compra Whimm de la wishlist, dentro de ESTE periodo).
  const gastoWhimmImpulso = items.filter((it) => it.tipoRaw === 'Whimm').reduce((s, it) => s + it.amount, 0)
  const compraWhimmWishlist = whimmCompras.reduce((s, it) => s + it.amount, 0)
  const whimmGastado = gastoWhimmImpulso + compraWhimmWishlist

  const listaCompleta = [
    ...items.map((it) => ({ ...it, _kind: 'gasto' })),
    ...whimmCompras.map((it) => ({ ...it, _kind: 'whimmCompra' })),
  ].sort((a, b) => compareISODesc(a.fecha ?? a.date, b.fecha ?? b.date))

  function openEdit(id) {
    const g = gastos.find((x) => x.id === id)
    if (!g) return
    setEditForm({
      concepto: g.concepto || '',
      monto: String(g.monto ?? ''),
      lugar: g.lugar || '',
      fecha: g.fecha || todayISO(),
      categoria: g.categoria || 'Whimm',
      categoriaWhimm: g.categoriaWhimm || (cats[0] || ''),
      vitallId: g.vitallId || '',
      reembolso: String(g.reembolso ?? ''),
    })
    setEditingId(id)
    setSwipeOpenKey(null)
  }

  async function saveEdit() {
    if (!editForm.concepto.trim() || !Number(editForm.monto)) return
    const vitallDoc = editForm.categoria === 'Vitall' ? vitalls.find((v) => v.id === editForm.vitallId) : null
    const payload = {
      concepto: editForm.concepto.trim(),
      monto: Number(editForm.monto),
      lugar: editForm.lugar.trim(),
      fecha: editForm.fecha || todayISO(),
      categoria: editForm.categoria,
      categoriaWhimm: editForm.categoria === 'Whimm' ? editForm.categoriaWhimm : '',
      vitallId: editForm.categoria === 'Vitall' ? editForm.vitallId : '',
      vitallNombre: vitallDoc ? vitallDoc.name : '',
      reembolso: Number(editForm.reembolso) || 0,
    }
    // Si no cambió nada, no escribe, no muestra toast y no deja rastro en
    // Historial — solo cierra la hoja (a pedido de Pame).
    if (!hayCambios(gastos.find((g) => g.id === editingId), payload)) {
      setEditingId(null)
      setEditForm(null)
      return
    }
    setSavingEdit(true)
    try {
      await updateUserDoc(user.uid, 'gastos', editingId, payload)
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

  // Al borrar un gasto que ya quedó "asentado" en un día pasado
  // (fecha <= ultimoProcesado, ver el comentario grande de bolsillos en
  // src/lib/budget.js), el saldo persistido de config/presupuesto NUNCA
  // se recalcula solo -- si no se regresa el dinero a mano aquí, se
  // queda restado para siempre aunque el gasto ya no exista (trigésima
  // quinta tanda, a pedido de Pame: "si se elimina, se debe agregar tal
  // dinero, por si hay error en crear gasto y se quiere volver a
  // registrar"). Un gasto de HOY (todavía no asentado) no necesita nada
  // de esto -- bolsillosDeHoy ya recalcula en vivo con el arreglo actual
  // de gastos cada vez que renderiza, así que simplemente desaparece del
  // cálculo en cuanto se borra el documento. Un gasto tipo Vitall
  // vinculado tampoco resta nada de saldoGastos (gastoHormigaEnFecha lo
  // excluye a propósito, es solo un registro informativo), así que
  // tampoco hace falta regresarle nada.
  async function deleteItem(id) {
    const g = gastos.find((x) => x.id === id)
    try {
      const yaAsentado = g && configPresupuesto?.ultimoProcesado && g.fecha <= configPresupuesto.ultimoProcesado
      const esVitallVinculado = g?.categoria === 'Vitall' && g?.vitallId
      if (g && yaAsentado && !esVitallVinculado) {
        const monto = gastoNeto(g)
        const saldoGastosActual = Number(configPresupuesto?.saldoGastos) || 0
        await setUserDoc(user.uid, 'config', 'presupuesto', { saldoGastos: saldoGastosActual + monto })
      }
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
              onClick={() => cambiarPeriodo(p)}
              style={{ background: periodo === p ? 'var(--wine)' : 'transparent', color: periodo === p ? '#fff' : 'var(--muted)' }}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="hero" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button
              aria-label="Periodo anterior"
              onClick={() => navegarPeriodo(-1)}
              style={{ width: 26, height: 26, borderRadius: 13, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <IconChevronLeft size={14} color="#fff" />
            </button>
            <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500, textAlign: 'center' }}>Gastado en {periodoLabelTexto(periodo, fechaRef)}</div>
            <button
              aria-label="Periodo siguiente"
              onClick={() => navegarPeriodo(1)}
              style={{ width: 26, height: 26, borderRadius: 13, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <IconChevronRight size={14} color="#fff" />
            </button>
          </div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, marginTop: 3, textAlign: 'center' }}>{fmt(vitallGastado + whimmGastado)}</div>
          {fechaRef !== todayISO() && (
            <button
              onClick={() => setFechaRef(todayISO())}
              style={{ display: 'block', margin: '6px auto 0', fontSize: 10, opacity: 0.8, color: '#fff', textDecoration: 'underline' }}
            >
              Volver a hoy
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div className="card" style={{ flex: 1, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Gasto Whimm (impulso)</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: 'var(--wine3)' }}>{fmt(gastoWhimmImpulso)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Compra Whimm (wishlist)</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: 'var(--wine4)' }}>{fmt(compraWhimmWishlist)}</div>
          </div>
        </div>

        {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {listaCompleta.map((it) =>
            it._kind === 'whimmCompra' ? (
              <WhimmCompraRow key={it.id} item={it} onGoToCompras={(whimmId) => navigate('/compras', { state: { openWhimmId: whimmId } })} />
            ) : (
              <ExpenseRow
                key={it.id}
                item={it}
                isOpen={swipeOpenKey === it.id}
                onSwipe={(open) => setSwipeOpenKey(open ? it.id : null)}
                onDelete={() => deleteItem(it.id)}
                onEdit={openEdit}
              />
            )
          )}
          {!loading && !error && listaCompleta.length === 0 && <div className="empty-state">Sin gastos en este periodo</div>}
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
                <input
                  className="fld"
                  placeholder="¿Te regresaron algo? (opcional)"
                  inputMode="decimal"
                  value={editForm.reembolso}
                  onChange={(e) => setEditForm((f) => ({ ...f, reembolso: e.target.value }))}
                />
                <input
                  className="fld"
                  type="date"
                  value={editForm.fecha}
                  onChange={(e) => setEditForm((f) => ({ ...f, fecha: e.target.value }))}
                />
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
