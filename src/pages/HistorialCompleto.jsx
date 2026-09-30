import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconEdit, IconClose } from '../components/Icons'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, useUserDoc, updateUserDoc, setUserDoc } from '../lib/firestoreCollections'
import { formatShortDate, todayISO } from '../lib/date'
import { buildHistorialEvents } from '../lib/historial'
import { objetivoPagosFijosEnFecha, repartoAjusteSueldoOcurrencia } from '../lib/budget'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'gasto', label: 'Gastos' },
  { key: 'nomina', label: 'Sueldos' },
  { key: 'cambio', label: 'Cambios' },
]

export default function HistorialCompleto() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cat, setCat] = useState('todos')
  const [subcat, setSubcat] = useState('todos')
  const [sort, setSort] = useState('fecha')
  // Edición puntual de UNA ocurrencia de pago fijo/Vitall (vigésima sexta
  // tanda, a pedido de Pame) — nunca borra ni afecta la definición
  // recurrente, solo esa fecha exacta (ver `excepciones` en budget.js).
  const [editingOcurrencia, setEditingOcurrencia] = useState(null) // { pagoFijoId, fecha, nombre, montoActual }
  const [ocurrenciaMontoValue, setOcurrenciaMontoValue] = useState('')
  const [savingOcurrencia, setSavingOcurrencia] = useState(false)
  // Edición puntual de UNA ocurrencia de sueldo FIJO (cuarentava tanda,
  // cont. cont. cont., a pedido de Pame: "a veces me descuentan cosas...
  // quiero poder editar ese sueldo") -- mismo patrón que arriba, pero si
  // esa quincena ya quedó "asentada" (fecha <= ultimoProcesado) también
  // hay que mover la diferencia en config/presupuesto (ver
  // `repartoAjusteSueldoOcurrencia` en budget.js), porque ese dinero ya
  // se había repartido entre pagos fijos/whimms/gastos ese día.
  const [editingSueldoOcurrencia, setEditingSueldoOcurrencia] = useState(null) // { sueldoFijoId, fecha, nombre, montoActual }
  const [sueldoOcurrenciaMontoValue, setSueldoOcurrenciaMontoValue] = useState('')
  const [savingSueldoOcurrencia, setSavingSueldoOcurrencia] = useState(false)

  const { data: gastos } = useUserCollection('gastos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: whimms } = useUserCollection('whimms')
  const { data: configPresupuesto } = useUserDoc('config', 'presupuesto')

  function openEditOcurrencia(it) {
    const montoActual = Math.abs(it.amount) || 0
    setOcurrenciaMontoValue(String(montoActual))
    setEditingOcurrencia({ pagoFijoId: it.pagoFijoId, fecha: it.ocurrenciaFecha, nombre: it.pagoFijoNombre, montoActual })
  }

  function openEditOcurrenciaSueldo(it) {
    const montoActual = Math.abs(it.amount) || 0
    setSueldoOcurrenciaMontoValue(String(montoActual))
    setEditingSueldoOcurrencia({ sueldoFijoId: it.sueldoFijoId, fecha: it.ocurrenciaFecha, nombre: it.sueldoFijoNombre, montoActual })
  }

  // Editar CUALQUIER registro del historial desde aquí mismo (a pedido de
  // Pame, vigésima séptima tanda: "agrega que se edite todos los
  // registros de historial") — cada tipo de evento abre la edición real
  // de su propio documento en la pantalla donde ya vive esa edición,
  // salvo la ocurrencia puntual de un pago fijo o de un sueldo fijo
  // (arriba), que se editan aquí mismo porque son una excepción por
  // fecha, no un documento propio.
  function handleEditClick(it) {
    if (it.editable === 'pagoFijoOcurrencia') { openEditOcurrencia(it); return }
    if (it.editable === 'sueldoFijoOcurrencia') { openEditOcurrenciaSueldo(it); return }
    if (it.editable === 'whimm') { navigate('/compras', { state: { openWhimmId: it.whimmId } }); return }
    if (it.editable === 'gasto') { navigate('/gastos', { state: { openGastoId: it.gastoId } }); return }
    if (it.editable === 'sueldoRapido') { navigate('/perfil/sueldos', { state: { openRapidoId: it.sueldoRapidoId } }); return }
    if (it.editable === 'pagoFijoDef') { navigate('/perfil/precios-fijos', { state: { openPagoId: it.pagoFijoId } }); return }
  }

  async function guardarExcepcion(patch) {
    if (!editingOcurrencia) return
    // Si el monto que escribió es el mismo que ya tenía, no hay nada que
    // guardar (a pedido de Pame) — "no se cobró" nunca es un no-op real,
    // porque en cuanto se omite una ocurrencia desaparece de esta lista.
    if (patch.monto != null && patch.monto === editingOcurrencia.montoActual) {
      setEditingOcurrencia(null)
      return
    }
    const p = pagosFijos.find((x) => x.id === editingOcurrencia.pagoFijoId)
    if (!p) return
    setSavingOcurrencia(true)
    try {
      const excepciones = { ...(p.excepciones || {}), [editingOcurrencia.fecha]: patch }
      await updateUserDoc(user.uid, 'pagosFijos', p.id, { excepciones })
      setEditingOcurrencia(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingOcurrencia(false)
    }
  }

  // Guarda la corrección de UNA quincena de un sueldo fijo. Si esa fecha
  // ya quedó "asentada" (ya pasó por `procesarDiasPendientes`, que solo
  // avanza hacia adelante y nunca se recalcula solo -- ver el comentario
  // grande de bolsillos en budget.js), el dinero de esa quincena ya se
  // había repartido entre pagos fijos/whimms/gastos ese día: no basta con
  // guardar la excepción en el documento del sueldo, hay que mover la
  // diferencia también en config/presupuesto, con la misma prioridad de
  // siempre (a pedido explícito de Pame) -- ver
  // `repartoAjusteSueldoOcurrencia`. Una fecha que todavía no se asienta
  // (hoy, si aún no cerró el día, o rarísimo caso de una fecha futura) no
  // necesita nada de esto: `bolsillosDeHoy`/`procesarDiasPendientes` van
  // a leer el monto corregido solos la próxima vez que la procesen.
  async function guardarExcepcionSueldo(monto) {
    if (!editingSueldoOcurrencia) return
    if (monto === editingSueldoOcurrencia.montoActual) {
      setEditingSueldoOcurrencia(null)
      return
    }
    const s = sueldosFijos.find((x) => x.id === editingSueldoOcurrencia.sueldoFijoId)
    if (!s) return
    setSavingSueldoOcurrencia(true)
    try {
      const excepciones = { ...(s.excepciones || {}), [editingSueldoOcurrencia.fecha]: { monto } }
      const writes = [updateUserDoc(user.uid, 'sueldosFijos', s.id, { excepciones })]

      const yaAsentada = configPresupuesto?.ultimoProcesado && editingSueldoOcurrencia.fecha <= configPresupuesto.ultimoProcesado
      if (yaAsentada) {
        const delta = monto - editingSueldoOcurrencia.montoActual
        const pct = configPresupuesto?.porcentajeWhimms != null ? configPresupuesto.porcentajeWhimms : 0.5
        const saldoPagosFijosActual = Number(configPresupuesto?.saldoPagosFijos) || 0
        const objetivo = objetivoPagosFijosEnFecha(pagosFijos, sueldosFijos, todayISO())
        const ajuste = repartoAjusteSueldoOcurrencia(delta, objetivo, saldoPagosFijosActual, pct)
        writes.push(setUserDoc(user.uid, 'config', 'presupuesto', {
          saldoPagosFijos: saldoPagosFijosActual + ajuste.aPagosFijos,
          saldoWhimms: (Number(configPresupuesto?.saldoWhimms) || 0) + ajuste.aWhimms,
          saldoGastos: (Number(configPresupuesto?.saldoGastos) || 0) + ajuste.aGastos,
        }))
      }

      await Promise.all(writes)
      setEditingSueldoOcurrencia(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingSueldoOcurrencia(false)
    }
  }

  const hoy = todayISO()

  const events = useMemo(
    () => buildHistorialEvents({ gastos, sueldosRapidos, sueldosFijos, pagosFijos, whimms, hoyISO: hoy }),
    [gastos, sueldosRapidos, sueldosFijos, pagosFijos, whimms, hoy]
  )

  const listByCat = events.filter((e) => cat === 'todos' || e.cat === cat)
  const availableSubcats = [...new Set(listByCat.map((e) => e.subcat).filter(Boolean))]
  let list = listByCat.filter((e) => subcat === 'todos' || e.subcat === subcat)
  list = sort === 'fecha'
    ? [...list].sort((a, b) => (b.dateISO < a.dateISO ? -1 : b.dateISO > a.dateISO ? 1 : 0))
    : [...list].sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))

  const items = list.map((e) => ({
    ...e,
    amountText: e.amount == null ? '—' : (e.amount > 0 ? '+$' : '-$') + Math.abs(e.amount).toLocaleString('es-MX'),
    amountColor: e.amount == null ? '#b3ad8e' : e.amount > 0 ? 'var(--green)' : 'var(--text)',
    dateLabel: formatShortDate(e.dateISO),
  }))

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/perfil" aria-label="Volver" className="back-btn">
            <IconChevronLeft />
          </Link>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Historial completo</div>
        </div>

        <div className="chiprow">
          {FILTERS.map((f) => (
            <span
              key={f.key}
              onClick={() => { setCat(f.key); setSubcat('todos') }}
              className="pill"
              style={{ background: cat === f.key ? 'var(--wine)' : 'transparent', color: cat === f.key ? '#fff' : 'var(--muted)' }}
            >
              {f.label}
            </span>
          ))}
        </div>

        {availableSubcats.length > 0 && (
          <div className="chiprow">
            {['todos', ...availableSubcats].map((c) => (
              <span
                key={c}
                onClick={() => setSubcat(c)}
                className="pill"
                style={{ background: subcat === c ? 'var(--wine4)' : 'transparent', color: subcat === c ? '#fff' : 'var(--muted)', border: '1px solid var(--beige3)' }}
              >
                {c === 'todos' ? 'Todas las categorías' : c}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Ordenar por</span>
          <button
            onClick={() => setSort('fecha')}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: sort === 'fecha' ? 'var(--beige2)' : 'transparent', color: sort === 'fecha' ? 'var(--text)' : 'var(--muted)' }}
          >
            Fecha
          </button>
          <button
            onClick={() => setSort('precio')}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: sort === 'precio' ? 'var(--beige2)' : 'transparent', color: sort === 'precio' ? 'var(--text)' : 'var(--muted)' }}
          >
            Precio
          </button>
        </div>

        <div className="row-list">
          {items.map((it) => (
            <div key={it.id} className="row-list-item">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.dotColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: it.dotColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{it.badge}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{it.title}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: it.amountColor }}>{it.amountText}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{it.dateLabel}</div>
              </div>
              {it.editable && (
                <button aria-label="Editar" onClick={() => handleEditClick(it)} style={{ flexShrink: 0 }}>
                  <IconEdit />
                </button>
              )}
            </div>
          ))}
          {items.length === 0 && <div className="empty-state">Sin resultados para este filtro</div>}
        </div>
      </div>

      {editingOcurrencia && (
        <>
          <div className="sheet-backdrop" onClick={() => setEditingOcurrencia(null)} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 14px' }}>
                <button aria-label="Cerrar" onClick={() => setEditingOcurrencia(null)}>
                  <IconClose />
                </button>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Editar cobro: {editingOcurrencia.nombre}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                Solo cambia esta fecha ({formatShortDate(editingOcurrencia.fecha)}) — las demás ocurrencias y la definición del pago fijo siguen igual.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="fld"
                  placeholder="Monto de este día"
                  inputMode="decimal"
                  value={ocurrenciaMontoValue}
                  onChange={(e) => setOcurrenciaMontoValue(e.target.value)}
                />
                <button
                  className="btn-primary"
                  disabled={savingOcurrencia || !Number(ocurrenciaMontoValue)}
                  style={{ opacity: savingOcurrencia ? 0.7 : 1 }}
                  onClick={() => guardarExcepcion({ monto: Number(ocurrenciaMontoValue) })}
                >
                  Guardar monto de este día
                </button>
                <button
                  className="pill"
                  style={{ textAlign: 'center' }}
                  disabled={savingOcurrencia}
                  onClick={() => guardarExcepcion({ omitida: true })}
                >
                  No se cobró este día
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {editingSueldoOcurrencia && (
        <>
          <div className="sheet-backdrop" onClick={() => setEditingSueldoOcurrencia(null)} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 14px' }}>
                <button aria-label="Cerrar" onClick={() => setEditingSueldoOcurrencia(null)}>
                  <IconClose />
                </button>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Editar depósito: {editingSueldoOcurrencia.nombre}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                Solo cambia esta quincena ({formatShortDate(editingSueldoOcurrencia.fecha)}) — el sueldo configurado y las demás fechas siguen igual. Si esta ya se reflejó en tus saldos, la diferencia se reparte ahora con tu prioridad de siempre (pagos fijos primero, el resto por tu %).
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="fld"
                  placeholder="Monto real de este depósito"
                  inputMode="decimal"
                  value={sueldoOcurrenciaMontoValue}
                  onChange={(e) => setSueldoOcurrenciaMontoValue(e.target.value)}
                />
                <button
                  className="btn-primary"
                  disabled={savingSueldoOcurrencia || !Number(sueldoOcurrenciaMontoValue)}
                  style={{ opacity: savingSueldoOcurrencia ? 0.7 : 1 }}
                  onClick={() => guardarExcepcionSueldo(Number(sueldoOcurrenciaMontoValue))}
                >
                  Guardar monto de este depósito
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
