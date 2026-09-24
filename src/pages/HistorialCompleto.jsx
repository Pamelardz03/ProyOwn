import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconEdit, IconClose } from '../components/Icons'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, updateUserDoc } from '../lib/firestoreCollections'
import { formatShortDate, todayISO } from '../lib/date'
import { buildHistorialEvents } from '../lib/historial'

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

  const { data: gastos } = useUserCollection('gastos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: whimms } = useUserCollection('whimms')

  function openEditOcurrencia(it) {
    const montoActual = Math.abs(it.amount) || 0
    setOcurrenciaMontoValue(String(montoActual))
    setEditingOcurrencia({ pagoFijoId: it.pagoFijoId, fecha: it.ocurrenciaFecha, nombre: it.pagoFijoNombre, montoActual })
  }

  // Editar CUALQUIER registro del historial desde aquí mismo (a pedido de
  // Pame, vigésima séptima tanda: "agrega que se edite todos los
  // registros de historial") — cada tipo de evento abre la edición real
  // de su propio documento en la pantalla donde ya vive esa edición,
  // salvo la ocurrencia puntual de un pago fijo (arriba), que se edita
  // aquí mismo porque es una excepción por fecha, no un documento propio.
  function handleEditClick(it) {
    if (it.editable === 'pagoFijoOcurrencia') { openEditOcurrencia(it); return }
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
    </div>
  )
}
