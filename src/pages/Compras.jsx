import { useState } from 'react'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import Toggle from '../components/Toggle'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconBell, IconClose, IconEdit, IconTrash, IconPlus, IconChevronLeft } from '../components/Icons'
import { fmt } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, useUserDoc, setUserDoc, deleteUserDoc, updateUserDoc } from '../lib/firestoreCollections'
import { formatShortDate, daysUntil, isThisMonth } from '../lib/date'
import { computeWhimmScore } from '../lib/score'
import { estimatePresupuestoDiarioNeto, proyectarColaWhimms, proximoVencimientoPagoFijo, disponibleParaWhimms, asignarSaldoWhimms } from '../lib/budget'
import { deriveWhimmCats } from '../lib/categorias'

const ESTADO_LABEL = {
  espera: 'En espera',
  espera_sin_fondos: 'En espera · sin fondos asignados',
  apartando: 'Apartando fondos',
}

// Nombre del sitio real al que apunta un link (Amazon, Mercado Libre, ...),
// derivado de su dominio — antes todos los links de un Whimm mostraban el
// mismo texto (el campo "lugar", que es uno solo por Whimm, no por link).
const SITE_LABELS = [
  [/amazon/, 'Amazon'],
  [/mercadolibre|mercadolivre/, 'Mercado Libre'],
  [/liverpool/, 'Liverpool'],
  [/coppel/, 'Coppel'],
  [/sephora/, 'Sephora'],
  [/shein/, 'Shein'],
  [/walmart/, 'Walmart'],
  [/sears/, 'Sears'],
]
function siteLabelFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const match = SITE_LABELS.find(([re]) => re.test(host))
    return match ? match[1] : host
  } catch {
    return null
  }
}

export default function Compras() {
  const { user } = useAuth()
  const { message, show } = useToast()
  const [tab, setTab] = useState('deseos')
  const [detailId, setDetailId] = useState(null)
  const [notifFor, setNotifFor] = useState(null) // { id, collection, name, notifFormal, notifMini }
  const [dismissed, setDismissed] = useState({})
  const [apartarFor, setApartarFor] = useState(null) // { id, name }
  const [apartarValue, setApartarValue] = useState('')

  const [editingWhimm, setEditingWhimm] = useState(null) // whimm object siendo editado, o null
  const [editForm, setEditForm] = useState({ nombre: '', categoria: '', lugar: '', precio: '', imagenUrl: '' })
  const [editNecesidad, setEditNecesidad] = useState(3)
  const [editDeseo, setEditDeseo] = useState(3)
  const [editEstado, setEditEstado] = useState('espera')
  const [editMontoApartado, setEditMontoApartado] = useState('')
  const [editPrecioComprado, setEditPrecioComprado] = useState('')
  const [editLinks, setEditLinks] = useState([''])
  const [editNotifFormal, setEditNotifFormal] = useState(true)
  const [editNotifMini, setEditNotifMini] = useState(true)
  const [editNewCatOpen, setEditNewCatOpen] = useState(false)
  const [editNewCatValue, setEditNewCatValue] = useState('')
  const [editExtraCats, setEditExtraCats] = useState([])
  const [editSaving, setEditSaving] = useState(false)

  const { data: whimms, loading: loadingWhimms, error: errorWhimms } = useUserCollection('whimms')
  const { data: pagosFijos, loading: loadingPagos, error: errorPagos } = useUserCollection('pagosFijos')
  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: gastos } = useUserCollection('gastos')
  const { data: configPresupuesto } = useUserDoc('config', 'presupuesto')
  const servicios = pagosFijos.filter((p) => p.tipo === 'Vitall')

  const cats = deriveWhimmCats(whimms, gastos)

  // Cuántos Whimms se financian a la vez con el saldo libre acumulado real
  // (novena tanda, a pedido de Pame) — configurable, default 3. Antes todo
  // el excedente iba solo al #1 hasta completarlo.
  const whimmsSimultaneos = configPresupuesto?.whimmsSimultaneos || 3

  // La cola: Whimms activos ordenados por score (necesidad/deseo/precio,
  // ver src/lib/score.js), con una fecha estimada de compra en cascada —
  // el #1 acumula el presupuesto diario neto, y el resto sigue detrás de
  // él, asumiendo que no hay más gastos (predicción "favorable").
  const sueldosRapidosMes = sueldosRapidos.filter((r) => isThisMonth(r.fecha)).reduce((s, r) => s + (Number(r.monto) || 0), 0)
  const presupuestoDiarioNeto = estimatePresupuestoDiarioNeto({ sueldosFijos, sueldosRapidosMes, pagosFijos })

  // Saldo libre acumulado real (histórico, no se reinicia cada mes — ver
  // src/lib/budget.js) y cuánto de eso puede financiar Whimms sin tocar lo
  // reservado para el próximo vencimiento de cada pago fijo/Vitall activo.
  // Se reparte entre los primeros `whimmsSimultaneos` Whimms de la fila,
  // proporcional a su score — así varios avanzan a la vez.
  const budgetParams = { sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms }
  const disponibleWhimms = disponibleParaWhimms(budgetParams)
  const activos = whimms
    .filter((w) => w.estado !== 'comprado')
    .map((w) => ({ ...w, _score: w.score ?? computeWhimmScore(w) }))
    .sort((a, b) => b._score - a._score)
  const asignados = asignarSaldoWhimms(activos, disponibleWhimms, whimmsSimultaneos)
  const acumuladoAutomaticoById = Object.fromEntries(asignados.map((w) => [w.id, w.acumuladoAutomatico]))
  const activosConFecha = proyectarColaWhimms(activos, presupuestoDiarioNeto).map((w) => ({
    ...w,
    acumuladoAutomatico: acumuladoAutomaticoById[w.id] || 0,
  }))
  const comprados = whimms.filter((w) => w.estado === 'comprado')
  const whimmsOrdenados = [...activosConFecha, ...comprados]

  const detail = whimmsOrdenados.find((w) => w.id === detailId)
  const detailLinks = detail ? (detail.links && detail.links.length ? detail.links : detail.link ? [detail.link] : []) : []

  async function toggleServicio(id, activo) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', id, { activo: !activo })
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  // Abre la hoja de notificaciones para un Whimm o un Vitall — antes solo
  // existía para Vitall; ahora ambos tienen sus propios recordatorios.
  function openNotif(item, collection) {
    setNotifFor({
      id: item.id,
      collection,
      name: item.name,
      notifFormal: item.notifFormal !== false,
      notifMini: item.notifMini !== false,
    })
  }

  async function saveNotif() {
    if (!notifFor) return
    try {
      await updateUserDoc(user.uid, notifFor.collection, notifFor.id, {
        notifFormal: notifFor.notifFormal,
        notifMini: notifFor.notifMini,
      })
      setNotifFor(null)
      show('Notificaciones guardadas')
    } catch (err) {
      console.error(err)
      show(`No se pudo guardar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  function openApartar(w) {
    setApartarFor({ id: w.id, name: w.name })
    setApartarValue(String(w.montoApartado ?? ''))
  }

  async function saveApartar() {
    if (!apartarFor) return
    try {
      await updateUserDoc(user.uid, 'whimms', apartarFor.id, {
        estado: 'apartando',
        montoApartado: Number(apartarValue) || 0,
      })
      setApartarFor(null)
      setApartarValue('')
      show('Fondos actualizados')
    } catch (err) {
      console.error(err)
      show(`No se pudo guardar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  async function deleteDetail() {
    try {
      await deleteUserDoc(user.uid, 'whimms', detailId)
      setDetailId(null)
      show('Whimm eliminado')
    } catch (err) {
      console.error(err)
      show(`No se pudo eliminar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  // Cuántos Whimms activos se financian a la vez con el saldo libre
  // acumulado real (stepper en la pestaña Whimm) — persistido en
  // /users/{uid}/config/presupuesto.
  async function setWhimmsSimultaneos(n) {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { whimmsSimultaneos: Math.max(1, Math.min(10, n)) })
    } catch (err) {
      console.error(err)
      show(`No se pudo guardar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  function openEditWhimm(w) {
    setEditingWhimm(w)
    setEditForm({
      nombre: w.name || '',
      categoria: w.categoria || '',
      lugar: w.lugar || '',
      precio: String(w.precio ?? ''),
      imagenUrl: w.imagenUrl || '',
    })
    setEditNecesidad(w.necesidad ?? 3)
    setEditDeseo(w.deseo ?? 3)
    setEditEstado(w.estado || 'espera')
    setEditMontoApartado(String(w.montoApartado ?? ''))
    setEditPrecioComprado(String(w.precioComprado ?? w.precio ?? ''))
    setEditLinks(w.links && w.links.length ? w.links : w.link ? [w.link] : [''])
    setEditNotifFormal(w.notifFormal !== false)
    setEditNotifMini(w.notifMini !== false)
    setEditNewCatOpen(false)
    setEditNewCatValue('')
  }

  function closeEditWhimm() {
    setEditingWhimm(null)
  }

  function updateEditLink(idx, value) {
    setEditLinks((prev) => prev.map((l, i) => (i === idx ? value : l)))
  }
  function addEditLinkRow() {
    setEditLinks((prev) => [...prev, ''])
  }
  function removeEditLinkRow(idx) {
    setEditLinks((prev) => prev.filter((_, i) => i !== idx))
  }

  async function saveEditWhimm() {
    if (!editingWhimm) return
    const precio = Number(editForm.precio)
    if (!editForm.nombre.trim() || !precio) return
    setEditSaving(true)
    try {
      const links = editLinks.map((l) => l.trim()).filter(Boolean)
      const score = computeWhimmScore({ necesidad: editNecesidad, deseo: editDeseo, precio })
      await updateUserDoc(user.uid, 'whimms', editingWhimm.id, {
        name: editForm.nombre.trim(),
        categoria: editForm.categoria,
        precio,
        lugar: editForm.lugar.trim(),
        imagenUrl: editForm.imagenUrl.trim(),
        links,
        link: links[0] || '',
        necesidad: editNecesidad,
        deseo: editDeseo,
        score,
        estado: editEstado,
        montoApartado: editEstado === 'apartando' ? Number(editMontoApartado) || 0 : 0,
        precioComprado: editEstado === 'comprado' ? (Number(editPrecioComprado) || precio) : null,
        notifFormal: editNotifFormal,
        notifMini: editNotifMini,
      })
      setEditingWhimm(null)
      if (detailId === editingWhimm.id) setDetailId(null)
      show('Whimm actualizado')
    } catch (err) {
      console.error(err)
      show(`No se pudo guardar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1>Compras</h1>

        <div style={{ display: 'flex', gap: 6, background: 'var(--beige2)', padding: 4, borderRadius: 12 }}>
          <button className="segbtn" onClick={() => setTab('deseos')} style={{ background: tab === 'deseos' ? 'var(--wine)' : 'transparent', color: tab === 'deseos' ? '#fff' : 'var(--muted)' }}>Whimm</button>
          <button className="segbtn" onClick={() => setTab('servicios')} style={{ background: tab === 'servicios' ? 'var(--wine)' : 'transparent', color: tab === 'servicios' ? '#fff' : 'var(--muted)' }}>Vitall</button>
        </div>

        {tab === 'deseos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {errorWhimms && <div style={{ fontSize: 11, color: 'var(--red)' }}>{errorWhimms}</div>}

            <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Financiar a la vez</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  {fmt(disponibleWhimms)} libres se reparten entre los primeros {whimmsSimultaneos}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <button
                  aria-label="Menos Whimms a la vez"
                  onClick={() => setWhimmsSimultaneos(whimmsSimultaneos - 1)}
                  style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--wine)' }}
                >
                  −
                </button>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, width: 18, textAlign: 'center' }}>{whimmsSimultaneos}</span>
                <button
                  aria-label="Más Whimms a la vez"
                  onClick={() => setWhimmsSimultaneos(whimmsSimultaneos + 1)}
                  style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--wine)' }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {whimmsOrdenados.map((w, i) => (
                <div key={w.id} onClick={() => setDetailId(w.id)} className="card" style={{ padding: 16, cursor: 'pointer' }}>
                  {w.imagenUrl && (
                    <img
                      src={w.imagenUrl}
                      alt={w.name}
                      style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 14, marginBottom: 12, display: 'block' }}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {!w.imagenUrl && (
                        <div className="icon-tile" style={{ width: 76, height: 76, borderRadius: 16 }}>
                          <IconProduct size={30} />
                        </div>
                      )}
                      <div>
                        <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--wine4)' }}>#{i + 1}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{w.categoria}{w.lugar ? ` · ${w.lugar}` : ''}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 500 }}>
                      {fmt(w.estado === 'comprado' ? (w.precioComprado ?? w.precio) : w.precio)}
                    </div>
                    <button
                      aria-label="Notificaciones"
                      onClick={(e) => { e.stopPropagation(); openNotif(w, 'whimms') }}
                      style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <IconBell />
                    </button>
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--beige2)', padding: '5px 10px', borderRadius: 8 }}>
                      {ESTADO_LABEL[w.estado] || 'En espera'}
                    </span>
                    {w.fechaProyectada && w.estado !== 'comprado' && (
                      <span style={{ fontSize: 11, color: 'var(--wine4)', fontWeight: 600 }}>
                        Estimado {formatShortDate(w.fechaProyectada)}
                      </span>
                    )}
                  </div>

                  {w.estado !== 'comprado' && <WhimmProgressBar whimm={w} style={{ marginTop: 10 }} />}
                </div>
              ))}
              {!loadingWhimms && !errorWhimms && whimms.length === 0 && <div className="empty-state">Sin Whimms todavía</div>}
            </div>
          </div>
        )}

        {tab === 'servicios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {errorPagos && <div style={{ fontSize: 11, color: 'var(--red)' }}>{errorPagos}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="card" style={{ flex: 1, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Total mensual pendiente</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{fmt(servicios.reduce((s, x) => s + (Number(x.monto) || 0), 0))}</div>
              </div>
              <div className="card" style={{ flex: 1, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Vitall activos</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{servicios.filter((s) => s.activo).length}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {servicios.map((s) => {
                const proximo = proximoVencimientoPagoFijo(s)
                const dias = daysUntil(proximo)
                return (
                  <div key={s.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, opacity: s.activo ? 1 : 0.65 }}>
                    <div className="icon-tile" style={{ width: 38, height: 38 }}><IconProduct size={17} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {s.frecuencia} · Próximo {proximo ? formatShortDate(proximo) : 'sin fecha'}{dias != null ? ` · ${dias} día${dias === 1 ? '' : 's'}` : ''}
                      </div>
                    </div>
                    <button aria-label="Notificaciones" onClick={() => openNotif(s, 'pagosFijos')} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconBell />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(s.monto)}</div>
                      <Toggle on={s.activo} onClick={() => toggleServicio(s.id, s.activo)} ariaLabel={`Activar ${s.name}`} />
                    </div>
                  </div>
                )
              })}
              {!loadingPagos && !errorPagos && servicios.length === 0 && <div className="empty-state">Sin Vitall todavía</div>}
            </div>
          </div>
        )}
      </div>

      {notifFor && (
        <>
          <div className="sheet-backdrop" onClick={() => setNotifFor(null)} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body">
              <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 14px' }}>Notificaciones — {notifFor.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <NotifRow
                  label="Recordatorio formal"
                  hint="2 días antes del vencimiento"
                  on={notifFor.notifFormal}
                  onClick={() => setNotifFor((f) => ({ ...f, notifFormal: !f.notifFormal }))}
                />
                <NotifRow
                  label="Recordatorio mini"
                  hint="Diario, desde que se activa hasta el día de pago"
                  on={notifFor.notifMini}
                  onClick={() => setNotifFor((f) => ({ ...f, notifMini: !f.notifMini }))}
                />
              </div>
              <button className="btn-primary" style={{ marginTop: 14 }} onClick={saveNotif}>
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      {apartarFor && (
        <>
          <div className="sheet-backdrop" style={{ zIndex: 45 }} onClick={() => setApartarFor(null)} />
          <div className="sheet" style={{ zIndex: 46 }}>
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body">
              <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 6px' }}>Apartar fondos — {apartarFor.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                Dinero que ya tienes guardado por tu cuenta (efectivo, otra cuenta) para este Whimm — no es parte del presupuesto diario, se suma a lo que ya se acumuló solo.
              </div>
              <input
                className="fld"
                placeholder="Monto ya juntado"
                inputMode="decimal"
                value={apartarValue}
                onChange={(e) => setApartarValue(e.target.value)}
              />
              <button className="btn-primary" style={{ marginTop: 14 }} onClick={saveApartar}>
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      {detail && (
        <>
          <div className="sheet-backdrop" style={{ zIndex: 40 }} onClick={() => setDetailId(null)} />
          <div className="card-solid" style={{ position: 'absolute', left: 16, right: 16, top: 40, bottom: 40, borderRadius: 20, boxShadow: '0 12px 32px rgba(0,0,0,.28)', zIndex: 41, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {detail.imagenUrl && (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 16, marginBottom: 16, overflow: 'hidden', background: 'var(--beige2)' }}>
                  <img
                    src={detail.imagenUrl}
                    alt={detail.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  <button aria-label="Cerrar" onClick={() => setDetailId(null)} style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, background: 'rgba(250,247,240,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}>
                    <IconClose />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {!detail.imagenUrl && <div className="icon-tile" style={{ width: 60, height: 60, borderRadius: 14 }}><IconProduct size={26} /></div>}
                  <div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--wine4)' }}>#{whimmsOrdenados.findIndex((w) => w.id === detail.id) + 1}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{detail.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{detail.categoria}{detail.lugar ? ` · ${detail.lugar}` : ''}</div>
                  </div>
                </div>
                {!detail.imagenUrl && (
                  <button aria-label="Cerrar" onClick={() => setDetailId(null)} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconClose />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 500, flex: 1 }}>
                  {fmt(detail.estado === 'comprado' ? (detail.precioComprado ?? detail.precio) : detail.precio)}
                </div>
              </div>
              {detail.estado === 'comprado' && detail.precioComprado != null && detail.precioComprado !== detail.precio && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
                  Estimado original: {fmt(detail.precio)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Categoría</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{detail.categoria}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Estado</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{ESTADO_LABEL[detail.estado] || 'En espera'}</div>
                </div>
              </div>

              {detail.estado !== 'comprado' && (
                <div style={{ background: 'var(--beige2)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>¿Cuándo puedo comprarlo?</div>
                  <WhimmProgressBar whimm={detail} height={10} />
                </div>
              )}

              {detail.estado !== 'comprado' && (
                <>
                  <button
                    onClick={() => openApartar(detail)}
                    style={{ width: '100%', background: 'var(--beige2)', borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}
                  >
                    {detail.estado === 'apartando' ? 'Actualizar monto apartado' : 'Apartar fondos'}
                  </button>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, marginBottom: 16 }}>
                    Dinero que ya tienes guardado por tu cuenta (efectivo, otra cuenta) — aparte de lo que el presupuesto diario ya va acumulando solo para este Whimm.
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Necesidad</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{detail.necesidad ?? '—'}/5</div>
                </div>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Deseo</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{detail.deseo ?? '—'}/5</div>
                </div>
              </div>

              {detail.fechaProyectada && detail.estado !== 'comprado' && (
                <div style={{ background: 'var(--beige2)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Fecha estimada de compra</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{formatShortDate(detail.fechaProyectada)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Predicción favorable: asume que no hay más gastos en el camino.</div>
                </div>
              )}

              {detailLinks.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Dónde lo encontré</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detailLinks.map((lk, idx) => {
                      const key = `${detail.id}-${idx}`
                      if (dismissed[key]) return null
                      return (
                        <div key={key} style={{ background: 'var(--beige2)', borderRadius: 12, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{siteLabelFromUrl(lk) || detail.lugar || `Link ${idx + 1}`}</div>
                          </div>
                          <a href={lk} target="_blank" rel="noreferrer" style={{ background: 'var(--wine)', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>Ver</a>
                          <button
                            aria-label="Quitar esta fuente"
                            onClick={() => setDismissed((prev) => ({ ...prev, [key]: true }))}
                            style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          >
                            <IconClose size={12} color="var(--muted)" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--beige3)' }}>
              <button onClick={() => openEditWhimm(detail)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--beige2)', borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
                <IconEdit color="var(--wine)" /> Editar
              </button>
              <button onClick={deleteDetail} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--red-bg)', borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600, color: 'var(--red)' }}>
                <IconTrash size={13} color="var(--red)" /> Eliminar
              </button>
            </div>
          </div>
        </>
      )}

      {editingWhimm && (
        <>
          <div className="sheet-backdrop" style={{ zIndex: 50 }} onClick={closeEditWhimm} />
          <div className="card-solid" style={{ position: 'absolute', left: 16, right: 16, top: 40, bottom: 40, borderRadius: 20, boxShadow: '0 12px 32px rgba(0,0,0,.28)', zIndex: 51, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <button aria-label="Atrás" onClick={closeEditWhimm}>
                  <IconChevronLeft />
                </button>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Editar Whimm</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="fld"
                  placeholder="Nombre del producto"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                />
                <div>
                  <div className="chiprow">
                    {[...cats, ...editExtraCats.filter((c) => !cats.includes(c))].map((c) => (
                      <span
                        key={c}
                        onClick={() => setEditForm((f) => ({ ...f, categoria: c }))}
                        className="pill"
                        style={{ background: editForm.categoria === c ? 'var(--wine)' : '#fff', color: editForm.categoria === c ? '#fff' : 'var(--muted)', border: `1px solid ${editForm.categoria === c ? 'var(--wine)' : 'var(--beige3)'}` }}
                      >
                        {c}
                      </span>
                    ))}
                    <button aria-label="Nueva categoría" onClick={() => setEditNewCatOpen((v) => !v)} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 14, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconPlus size={13} color="var(--wine)" />
                    </button>
                  </div>
                  {editNewCatOpen && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        className="fld"
                        style={{ flex: 1 }}
                        placeholder="Nombre de la categoría"
                        value={editNewCatValue}
                        onChange={(e) => setEditNewCatValue(e.target.value)}
                      />
                      <button
                        style={{ background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '0 14px', fontSize: 12, fontWeight: 600 }}
                        onClick={() => {
                          const name = editNewCatValue.trim()
                          if (name) {
                            setEditExtraCats((prev) => [...new Set([...prev, name])])
                            setEditForm((f) => ({ ...f, categoria: name }))
                          }
                          setEditNewCatValue('')
                          setEditNewCatOpen(false)
                        }}
                      >
                        Crear
                      </button>
                    </div>
                  )}
                </div>
                <input
                  className="fld"
                  placeholder="Precio"
                  inputMode="decimal"
                  value={editForm.precio}
                  onChange={(e) => setEditForm((f) => ({ ...f, precio: e.target.value }))}
                />
                <input
                  className="fld"
                  placeholder="Lugar de compra"
                  value={editForm.lugar}
                  onChange={(e) => setEditForm((f) => ({ ...f, lugar: e.target.value }))}
                />
                <input
                  className="fld"
                  placeholder="URL de imagen (pégala desde Google Imágenes u otro sitio)"
                  value={editForm.imagenUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, imagenUrl: e.target.value }))}
                />
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                  Links donde lo encontré
                </div>
                {editLinks.map((l, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="fld"
                      style={{ flex: 1 }}
                      placeholder="Link de dónde lo encontré"
                      value={l}
                      onChange={(e) => updateEditLink(idx, e.target.value)}
                    />
                    {editLinks.length > 1 && (
                      <button aria-label="Quitar link" onClick={() => removeEditLinkRow(idx)} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconClose size={12} color="var(--muted)" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addEditLinkRow} style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: 'var(--wine)' }}>
                  + Agregar otro link
                </button>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                  Necesidad
                </div>
                <ScalePicker value={editNecesidad} onChange={setEditNecesidad} />
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                  Deseo
                </div>
                <ScalePicker value={editDeseo} onChange={setEditDeseo} />
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span
                    onClick={() => setEditEstado('espera')}
                    className="pill"
                    style={{ flex: 1, textAlign: 'center', background: editEstado === 'espera' ? 'var(--wine)' : 'var(--card)', color: editEstado === 'espera' ? '#fff' : 'var(--muted)', border: editEstado === 'espera' ? 'none' : '1px solid var(--beige3)' }}
                  >
                    En espera
                  </span>
                  <span
                    onClick={() => setEditEstado('apartando')}
                    className="pill"
                    style={{ flex: 1, textAlign: 'center', background: editEstado === 'apartando' ? 'var(--wine)' : 'var(--card)', color: editEstado === 'apartando' ? '#fff' : 'var(--muted)', border: editEstado === 'apartando' ? 'none' : '1px solid var(--beige3)' }}
                  >
                    Apartando fondos
                  </span>
                  <span
                    onClick={() => setEditEstado('comprado')}
                    className="pill"
                    style={{ flex: 1, textAlign: 'center', background: editEstado === 'comprado' ? 'var(--wine)' : 'var(--card)', color: editEstado === 'comprado' ? '#fff' : 'var(--muted)', border: editEstado === 'comprado' ? 'none' : '1px solid var(--beige3)' }}
                  >
                    Comprado
                  </span>
                </div>
                {editEstado === 'apartando' && (
                  <input
                    className="fld"
                    placeholder="¿Cuánto ya llevas juntado?"
                    inputMode="decimal"
                    value={editMontoApartado}
                    onChange={(e) => setEditMontoApartado(e.target.value)}
                  />
                )}
                {editEstado === 'comprado' && (
                  <>
                    <input
                      className="fld"
                      placeholder="¿Al final en cuánto lo compraste?"
                      inputMode="decimal"
                      value={editPrecioComprado}
                      onChange={(e) => setEditPrecioComprado(e.target.value)}
                    />
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
                      Los precios varían del estimado — esto es lo que de verdad se resta de tu saldo y de lo que queda para el resto de la fila.
                    </div>
                  </>
                )}
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 6 }}>
                  Notificaciones
                </div>
                <NotifRow label="Recordatorio formal" hint="2 días antes" on={editNotifFormal} onClick={() => setEditNotifFormal((v) => !v)} />
                <NotifRow label="Recordatorio mini" hint="Diario, desde que se activa hasta el día estimado" on={editNotifMini} onClick={() => setEditNotifMini((v) => !v)} />
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--beige3)' }}>
              <button className="btn-primary" style={{ opacity: editSaving ? 0.7 : 1 }} onClick={saveEditWhimm} disabled={editSaving}>
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

function NotifRow({ label, hint, on, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--beige2)', borderRadius: 10, padding: '11px 12px' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>
      </div>
      <Toggle on={on} onClick={onClick} ariaLabel={label} />
    </div>
  )
}

function ScalePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: value === n ? 'var(--wine)' : 'var(--card)', color: value === n ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: 700, border: value === n ? 'none' : '1px solid var(--beige3)' }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// Barra de progreso real de un Whimm: monto ya apartado a mano (fuera de
// la app) + lo que ya acumuló del presupuesto diario real (novena tanda,
// ver src/lib/budget.js) contra su precio — el bloque que pedía el diseño
// original desde el principio y nunca se había construido de verdad.
function WhimmProgressBar({ whimm, height = 6, style }) {
  const precio = Number(whimm.precio) || 0
  const progreso = (Number(whimm.montoApartado) || 0) + (Number(whimm.acumuladoAutomatico) || 0)
  const pct = precio > 0 ? Math.min(100, Math.round((progreso / precio) * 100)) : 0
  return (
    <div style={style}>
      <div style={{ height, background: 'var(--beige2)', borderRadius: height / 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--wine)', borderRadius: height / 2, transition: 'width .3s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--wine4)' }}>{pct}%</span>
      </div>
    </div>
  )
}
