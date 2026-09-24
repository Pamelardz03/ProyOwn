import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import Toggle from '../components/Toggle'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconBell, IconClose, IconEdit, IconTrash, IconPlus, IconChevronLeft } from '../components/Icons'
import { fmt } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, useUserDoc, setUserDoc, deleteUserDoc, updateUserDoc } from '../lib/firestoreCollections'
import { useBolsillos } from '../hooks/useBolsillos'
import { formatShortDate, daysUntil, todayISO } from '../lib/date'
import { computeWhimmScore } from '../lib/score'
import { construirFlujoFuturo, proyectarColaWhimms, proximoVencimientoPagoFijo, promedioGastoHormigaDiario } from '../lib/budget'
import { deriveWhimmCats } from '../lib/categorias'
import { hayCambios } from '../lib/objectDiff'

// Estado real a mostrar (treceava tanda, a pedido de Pame): el campo
// `estado` guardado solo distingue espera/apartando/comprado — pero un
// Whimm "en espera" que ya empezó a recibir dinero del reparto automático
// (acumuladoAutomatico > 0, ver src/lib/budget.js) ya no está realmente
// "esperando sin avanzar", así que se muestra "Juntando" en vez de "En
// espera" para que se note la diferencia de un vistazo.
function estadoDisplay(w) {
  if (w.estado === 'comprado') return 'Comprado'
  if (w.estado === 'apartando') return 'Apartando fondos'
  const progreso = (Number(w.montoApartado) || 0) + (Number(w.acumuladoAutomatico) || 0)
  return progreso > 0 ? 'Juntando' : 'En espera'
}

// "Cuándo comprarlo" en vez de solo una fecha lejana, cuando ya está muy
// cerca (a pedido de Pame, quinceava tanda: "cuando esperarme mejor dos
// días, 1 día, o ya de una") — comprar cualquier Whimm de esta fila NUNCA
// toca tu meta de gasto del día, porque `saldoWhimms` y `saldoGastos` son
// dos bolsillos REALMENTE independientes (trigésima segunda tanda, ver
// useBolsillos()/src/lib/budget.js) — por eso este aviso no necesita
// advertir nada sobre gasto hormiga, ya está garantizado por diseño.
function cuandoComprarLabel(fechaProyectada) {
  if (!fechaProyectada) return null
  const dias = daysUntil(fechaProyectada)
  if (dias == null || dias > 2) return null
  if (dias <= 0) return 'Cómpralo hoy'
  return `Espera ${dias} día${dias === 1 ? '' : 's'}`
}

// Score en escala 0.0-10.0 en vez del número crudo de la fórmula (que sale
// en decimales chicos tipo 0.65, 0.03 — poco intuitivo). Es solo una
// transformación de escala para mostrarlo — no cambia el orden ni la
// fórmula real (`computeWhimmScore`), que sigue siendo la que decide la
// prioridad (a pedido de Pame, quinceava tanda). El multiplicador (×2.2,
// antes ×10) se recalibró en la dieciochoava tanda: con la fórmula v2
// (precio^0.25, ver src/lib/score.js) el score crudo de un Whimm real de
// Pame llega hasta ~4.5 (necesidad/deseo al máximo + el precio más barato
// de su lista, ~$125) — con ×10 casi cualquier Whimm con buena prioridad
// se topaba en 10.0 sin distinguirse de otro. Con ×2.2 ese mismo tope
// llega a ~9.9, dejando espacio para diferenciar entre los que antes se
// veían idénticos.
function scoreOutOf10(score) {
  return Math.min(10, Math.max(0, Number(score) || 0) * 2.2).toFixed(1)
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
  const location = useLocation()
  const navigate = useNavigate()
  const [tab, setTab] = useState('deseos')
  const [subTabDeseos, setSubTabDeseos] = useState('activos') // 'activos' | 'comprados' — historial de Whimms ya comprados, separado de la cola que se sigue recorriendo
  const [detailId, setDetailId] = useState(null)

  // Abrir el detalle de un Whimm específico al llegar desde otra pantalla
  // (Historial, Inicio, Gastos) con navigate('/compras', { state: {
  // openWhimmId } }) — antes esa navegación no hacía nada porque aquí
  // nunca se leía el state (a pedido de Pame, vigésima séptima tanda:
  // "hacer click en el whimm te debe llevar al detalle de ese whimm en
  // compras"). Se limpia el state después de abrirlo para no reabrirlo
  // solo con un "atrás"/"adelante" del navegador.
  useEffect(() => {
    if (location.state?.openWhimmId) {
      setDetailId(location.state.openWhimmId)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])
  const [notifFor, setNotifFor] = useState(null) // { id, collection, name, notifFormal, notifMini }
  const [dismissed, setDismissed] = useState({})
  const [apartarFor, setApartarFor] = useState(null) // { id, name }
  const [apartarValue, setApartarValue] = useState('')
  const [showConfig, setShowConfig] = useState(false) // submenu: "Financiar a la vez" + reparto
  // Vista previa del % antes de confirmar (trigésima segunda tanda, a
  // pedido de Pame: cambiar el % ya no es instantáneo — se puede ver cómo
  // quedaría el reparto y solo se aplica al darle a "Guardar"). Se
  // reinicia al valor confirmado cada vez que se abre la hoja.
  const [porcentajePreview, setPorcentajePreview] = useState(porcentajeWhimms)
  useEffect(() => {
    if (showConfig) setPorcentajePreview(porcentajeWhimms)
  }, [showConfig, porcentajeWhimms])
  const [pauseDialogFor, setPauseDialogFor] = useState(null) // Vitall pendiente de elegir alcance de pausa

  const [editingWhimm, setEditingWhimm] = useState(null) // whimm object siendo editado, o null
  const [editForm, setEditForm] = useState({ nombre: '', categoria: '', lugar: '', precio: '', imagenUrl: '' })
  const [editNecesidad, setEditNecesidad] = useState(3)
  const [editDeseo, setEditDeseo] = useState(3)
  const [editEstado, setEditEstado] = useState('espera')
  const [editMontoApartado, setEditMontoApartado] = useState('')
  const [editPrecioComprado, setEditPrecioComprado] = useState('')
  const [editMontoApartadoComprado, setEditMontoApartadoComprado] = useState('')
  const [editCompradoEn, setEditCompradoEn] = useState('')
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
  const { data: configPresupuesto, loading: loadingConfig } = useUserDoc('config', 'presupuesto')
  const servicios = pagosFijos.filter((p) => p.tipo === 'Vitall')

  const cats = deriveWhimmCats(whimms, gastos)

  // Cuántos Whimms se financian a la vez con el saldo libre acumulado real
  // (novena tanda, a pedido de Pame) — configurable, default 3. Antes todo
  // el excedente iba solo al #1 hasta completarlo.
  const whimmsSimultaneos = configPresupuesto?.whimmsSimultaneos || 3
  const saldoInicial = Number(configPresupuesto?.saldoInicial) || 0
  // Qué fracción del saldo libre puede reclamar la wishlist — el resto
  // queda como colchón de gasto hormiga (doceava tanda, a pedido de
  // Pame). Default 50/50, ajustable con el stepper de abajo.
  const porcentajeWhimms = configPresupuesto?.porcentajeWhimms != null ? configPresupuesto.porcentajeWhimms : 0.5

  // La cola: Whimms activos ordenados por score (necesidad/deseo/precio,
  // ver src/lib/score.js), con una fecha estimada de compra por EVENTOS
  // reales de dinero (dieciochoava tanda, a pedido de Pame) — cada sueldo
  // fijo que cae se reparte de una vez entre los primeros de la fila,
  // después de cubrir lo que venza antes, en vez de asumir un goteo diario
  // parejo. Ver `construirFlujoFuturo` en src/lib/budget.js.
  const eventosFlujo = construirFlujoFuturo({ sueldosFijos, pagosFijos })

  // Dos bolsillos REALMENTE independientes (trigésima segunda tanda, a
  // pedido de Pame: comprar un Whimm nunca debe tocar el gasto del día, ni
  // al revés) — `saldoWhimms` se acumula solo para tu wishlist, `saldoGastos`
  // es tu presupuesto de gasto del día a día. Ya no es un % en vivo del mismo
  // saldo compartido: son dos saldos persistidos en Firestore que se
  // liquidan día por día (ver useBolsillos()/src/lib/budget.js).
  const { saldoWhimms, saldoGastos, metaGastosHoy } = useBolsillos({
    configPresupuesto, loadingConfig, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms,
  })
  const disponibleWhimms = saldoWhimms
  const gastoHormigaPromedioDiario = promedioGastoHormigaDiario(gastos)
  const colchonBajo = metaGastosHoy != null && metaGastosHoy < gastoHormigaPromedioDiario
  const activos = whimms
    .filter((w) => w.estado !== 'comprado')
    .map((w) => ({ ...w, _score: computeWhimmScore(w) }))
    .sort((a, b) => b._score - a._score)
  // proyectarColaWhimms ya reparte el saldo libre entre los primeros
  // whimmsSimultaneos por score (mismo criterio que asignarSaldoWhimms) y
  // devuelve tanto la fecha proyectada como el acumuladoAutomatico de hoy
  // para las barras de progreso — ya no hace falta llamar asignarSaldoWhimms
  // por separado aquí.
  const comprados = whimms.filter((w) => w.estado === 'comprado')
  // Última fecha de compra real, para el canal de cadencia mínima
  // (veinticuatroava tanda) dentro de proyectarColaWhimms: si ya pasaron
  // 14 días sin comprar NINGÚN Whimm, se le da prioridad extra al más
  // barato pendiente para que la fila no se estanque.
  const ultimaCompraISO = comprados.reduce((max, w) => (w.compradoEn && w.compradoEn > (max || '') ? w.compradoEn : max), null)
  const activosConFecha = proyectarColaWhimms(activos, eventosFlujo, porcentajeWhimms, disponibleWhimms, whimmsSimultaneos, ultimaCompraISO)
  const whimmsOrdenados = [...activosConFecha, ...comprados]
  const compradosOrdenados = [...comprados].sort((a, b) => (b.compradoEn || '').localeCompare(a.compradoEn || ''))

  // Cuando 2+ de la fila ya juntaron su precio completo al mismo tiempo,
  // vale más comprar el más caro de ellos que varios chicos de golpe (a
  // pedido de Pame) — ver nudge más abajo, solo informativo.
  const listosParaComprar = activosConFecha.filter((w) => {
    const progreso = (Number(w.montoApartado) || 0) + (Number(w.acumuladoAutomatico) || 0)
    return w.precio > 0 && progreso >= w.precio - 1e-6
  })
  const masCaroListo = listosParaComprar.length > 1
    ? [...listosParaComprar].sort((a, b) => b.precio - a.precio)[0]
    : null

  const detail = whimmsOrdenados.find((w) => w.id === detailId)
  const detailLinks = detail ? (detail.links && detail.links.length ? detail.links : detail.link ? [detail.link] : []) : []

  // Pausar un Vitall desde aquí (a pedido de Pame, vigésima séptima
  // tanda) — mismo mecanismo y mismos diálogos que Precios fijos: pausar
  // SIEMPRE pregunta si es solo la próxima vez (excepciones) o
  // indefinido (activo: false); reactivar no pregunta nada.
  async function reactivarServicio(s) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', s.id, { activo: true })
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  async function pausarServicioSoloProximaVez(s) {
    try {
      const hoy = todayISO()
      const proxima = proximoVencimientoPagoFijo(s, hoy)
      if (!proxima) { setPauseDialogFor(null); return }
      const excepciones = { ...(s.excepciones || {}), [proxima]: { omitida: true } }
      await updateUserDoc(user.uid, 'pagosFijos', s.id, { excepciones })
      setPauseDialogFor(null)
      show(`Se salta el cobro del ${formatShortDate(proxima)} — vuelve normal en el siguiente`)
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  async function pausarServicioIndefinido(s) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', s.id, { activo: false })
      setPauseDialogFor(null)
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  function toggleServicio(s) {
    if (s.activo === false) {
      reactivarServicio(s)
    } else {
      setPauseDialogFor(s)
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

  // Reparto del saldo libre entre Whimms y colchón de gasto hormiga
  // (stepper en la pestaña Whimm) — persistido junto con whimmsSimultaneos
  // en /users/{uid}/config/presupuesto. En pasos de 10%, entre 10% y 90%
  // (nunca 0/100 — siempre debe quedar algo del otro lado).
  async function setPorcentajeWhimms(p) {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { porcentajeWhimms: Math.max(0, Math.min(1, p)) })
      show('Reparto actualizado')
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
    setEditMontoApartadoComprado(String(w.montoApartado ?? ''))
    setEditCompradoEn(w.compradoEn || todayISO())
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
    const links = editLinks.map((l) => l.trim()).filter(Boolean)
    const score = computeWhimmScore({ necesidad: editNecesidad, deseo: editDeseo, precio })
    const payload = {
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
      // Al marcar "comprado" se conserva lo que ya estaba apartado en
      // efectivo/otra cuenta (editMontoApartadoComprado) en vez de
      // resetearlo a 0 — de eso depende que totalWhimmsCompradosHasta
      // solo reste del banco la parte que de verdad salió de ahí.
      montoApartado:
        editEstado === 'apartando'
          ? Number(editMontoApartado) || 0
          : editEstado === 'comprado'
            ? Number(editMontoApartadoComprado) || 0
            : 0,
      precioComprado: editEstado === 'comprado' ? (Number(editPrecioComprado) || precio) : null,
      compradoEn: editEstado === 'comprado' ? (editCompradoEn || todayISO()) : null,
      notifFormal: editNotifFormal,
      notifMini: editNotifMini,
    }
    if (!hayCambios(editingWhimm, payload)) {
      setEditingWhimm(null)
      return
    }
    setEditSaving(true)
    try {
      await updateUserDoc(user.uid, 'whimms', editingWhimm.id, payload)
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Reparto y prioridad</div>
                <div style={{ fontSize: 10, color: colchonBajo ? 'var(--red)' : 'var(--muted)', fontWeight: colchonBajo ? 600 : 400, marginTop: 2 }}>
                  {fmt(saldoWhimms)} whimms · {fmt(metaGastosHoy)}/día gastos · {whimmsSimultaneos} a la vez
                </div>
              </div>
              <button
                aria-label="Editar reparto y prioridad"
                onClick={() => setShowConfig(true)}
                style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <IconEdit size={14} color="var(--wine)" />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, background: 'var(--beige2)', padding: 4, borderRadius: 12 }}>
              <button className="segbtn" onClick={() => setSubTabDeseos('activos')} style={{ background: subTabDeseos === 'activos' ? 'var(--wine)' : 'transparent', color: subTabDeseos === 'activos' ? '#fff' : 'var(--muted)' }}>
                En fila ({activosConFecha.length})
              </button>
              <button className="segbtn" onClick={() => setSubTabDeseos('comprados')} style={{ background: subTabDeseos === 'comprados' ? 'var(--wine)' : 'transparent', color: subTabDeseos === 'comprados' ? '#fff' : 'var(--muted)' }}>
                Comprados ({compradosOrdenados.length})
              </button>
            </div>

            {subTabDeseos === 'activos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {masCaroListo && (
                  <div className="card" style={{ padding: 12, background: 'var(--beige2)', fontSize: 11, color: 'var(--muted)' }}>
                    Mejor 1 caro que varios chicos: prioriza <strong style={{ color: 'var(--wine)' }}>{masCaroListo.name}</strong> ({fmt(masCaroListo.precio)})
                  </div>
                )}
                {activosConFecha.map((w, i) => (
                  <div key={w.id} onClick={() => setDetailId(w.id)} className="card" style={{ padding: 14, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div className="icon-tile" style={{ width: 76, height: 76, borderRadius: 16, background: w.imagenUrl ? '#fff' : undefined, overflow: 'hidden' }}>
                          {w.imagenUrl ? (
                            <img
                              src={w.imagenUrl}
                              alt={w.name}
                              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : (
                            <IconProduct size={30} />
                          )}
                        </div>
                        <div>
                          <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--wine4)' }}>#{i + 1}</div>
                          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{w.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{w.categoria}{w.lugar ? ` · ${w.lugar}` : ''}</div>
                        </div>
                      </div>
                      <span className="mono" style={{ background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '6px 14px', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                        {scoreOutOf10(w._score ?? w.score)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{fmt(w.precio)}</div>
                      <button
                        aria-label="Notificaciones"
                        onClick={(e) => { e.stopPropagation(); openNotif(w, 'whimms') }}
                        style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <IconBell />
                      </button>
                    </div>

                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--beige2)', padding: '5px 10px', borderRadius: 8 }}>
                        {estadoDisplay(w)}
                      </span>
                      {w.viaCadencia && (
                        <span style={{ fontSize: 11, color: 'var(--wine4)', background: 'var(--beige2)', padding: '5px 10px', borderRadius: 8, fontWeight: 600 }}>
                          Turno especial
                        </span>
                      )}
                      {w.fechaProyectada && (
                        <span style={{ fontSize: 11, color: 'var(--wine4)', fontWeight: 600 }}>
                          {cuandoComprarLabel(w.fechaProyectada) || `Estimado ${formatShortDate(w.fechaProyectada)}`}
                        </span>
                      )}
                    </div>

                    <WhimmProgressBar whimm={w} style={{ marginTop: 8 }} />
                  </div>
                ))}
                {!loadingWhimms && !errorWhimms && activosConFecha.length === 0 && <div className="empty-state">Sin Whimms en fila</div>}
              </div>
            )}

            {subTabDeseos === 'comprados' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {compradosOrdenados.map((w) => (
                  <div key={w.id} onClick={() => setDetailId(w.id)} className="card" style={{ padding: 16, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div className="icon-tile" style={{ width: 76, height: 76, borderRadius: 16, background: w.imagenUrl ? '#fff' : undefined, overflow: 'hidden' }}>
                          {w.imagenUrl ? (
                            <img
                              src={w.imagenUrl}
                              alt={w.name}
                              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : (
                            <IconProduct size={30} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{w.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{w.categoria}{w.lugar ? ` · ${w.lugar}` : ''}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{fmt(w.precioComprado ?? w.precio)}</div>
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--beige2)', padding: '5px 10px', borderRadius: 8, fontWeight: 600 }}>
                        Comprado
                      </span>
                      {w.compradoEn && (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatShortDate(w.compradoEn)}</span>
                      )}
                    </div>
                  </div>
                ))}
                {!loadingWhimms && !errorWhimms && compradosOrdenados.length === 0 && <div className="empty-state">Aún no has comprado ningún Whimm</div>}
              </div>
            )}
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
                      <Toggle on={s.activo} onClick={() => toggleServicio(s)} ariaLabel={`Activar ${s.name}`} />
                    </div>
                  </div>
                )
              })}
              {!loadingPagos && !errorPagos && servicios.length === 0 && <div className="empty-state">Sin Vitall todavía</div>}
            </div>
          </div>
        )}
      </div>

      {showConfig && (
        <>
          <div className="sheet-backdrop" onClick={() => setShowConfig(false)} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body">
              <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 16px' }}>Reparto y prioridad</div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Financiar a la vez</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{fmt(disponibleWhimms)} entre los primeros {whimmsSimultaneos}</div>
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

              <div style={{ fontSize: 12, fontWeight: 600 }}>Whimms vs. gasto libre</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, marginBottom: 10 }}>
                Ahora: {fmt(saldoWhimms)} acumulado para whimms · {fmt(metaGastosHoy)}/día para gastos ({fmt(saldoGastos)} acumulado)
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(porcentajePreview * 100)}
                onChange={(e) => setPorcentajePreview(Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: 'var(--wine)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>0%</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--wine)' }}>{Math.round(porcentajePreview * 100)}% wishlist</span>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>100%</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, textAlign: 'center' }}>
                Vista previa de tu saldo acumulado con ese %: {fmt((saldoWhimms + saldoGastos) * porcentajePreview)} whimms · {fmt((saldoWhimms + saldoGastos) * (1 - porcentajePreview))} gastos
              </div>
              {porcentajePreview !== porcentajeWhimms && (
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, textAlign: 'center', fontStyle: 'italic' }}>
                  Solo vista previa — no cambia nada hasta que le des Guardar. No toca lo ya acumulado, solo cómo se reparten los próximos ingresos y los días sin gastar.
                </div>
              )}

              {colchonBajo && (
                <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginTop: 16 }}>
                  Bajo tu ritmo: {fmt(metaGastosHoy)}/día (prom. {fmt(gastoHormigaPromedioDiario)}/día)
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button className="pill" style={{ flex: 1, textAlign: 'center' }} onClick={() => setShowConfig(false)}>
                  Listo
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 1, opacity: porcentajePreview === porcentajeWhimms ? 0.5 : 1 }}
                  disabled={porcentajePreview === porcentajeWhimms}
                  onClick={() => setPorcentajeWhimms(porcentajePreview)}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
                Dinero aparte ya guardado (efectivo, otra cuenta)
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className="icon-tile" style={{ width: 60, height: 60, borderRadius: 14, background: detail.imagenUrl ? '#fff' : undefined, overflow: 'hidden' }}>
                    {detail.imagenUrl ? (
                      <img
                        src={detail.imagenUrl}
                        alt={detail.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <IconProduct size={26} />
                    )}
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--wine4)' }}>#{whimmsOrdenados.findIndex((w) => w.id === detail.id) + 1}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{detail.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{detail.categoria}{detail.lugar ? ` · ${detail.lugar}` : ''}</div>
                  </div>
                </div>
                <button aria-label="Cerrar" onClick={() => setDetailId(null)} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconClose />
                </button>
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
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{estadoDisplay(detail)}</div>
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
                    Dinero aparte ya guardado (efectivo, otra cuenta)
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
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>
                    {cuandoComprarLabel(detail.fechaProyectada) ? '¿Cuándo comprarlo?' : 'Fecha estimada de compra'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>
                    {cuandoComprarLabel(detail.fechaProyectada) || formatShortDate(detail.fechaProyectada)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                    {detail.viaCadencia ? 'Se adelantó su turno: llevabas 14+ días sin comprar nada' : 'Estimado favorable'}
                  </div>
                </div>
              )}

              {detail.estado === 'comprado' && detail.compradoEn && (
                <div style={{ background: 'var(--beige2)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Fecha de compra</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{formatShortDate(detail.compradoEn)}</div>
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
                      Lo que de verdad pagaste
                    </div>
                    <input
                      className="fld"
                      placeholder="¿Cuánto de eso ya tenías apartado en efectivo/otra cuenta? (opcional)"
                      inputMode="decimal"
                      value={editMontoApartadoComprado}
                      onChange={(e) => setEditMontoApartadoComprado(e.target.value)}
                    />
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
                      No sale de tu banco
                    </div>
                    <input
                      className="fld"
                      type="date"
                      value={editCompradoEn}
                      onChange={(e) => setEditCompradoEn(e.target.value)}
                    />
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
                      Fecha real de compra
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
                onClick={() => pausarServicioSoloProximaVez(pauseDialogFor)}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>Solo la próxima vez</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Se salta únicamente el próximo cobro y vuelve a activarse solo en el que sigue.
                </div>
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--red)', textAlign: 'left', padding: 12 }}
                onClick={() => pausarServicioIndefinido(pauseDialogFor)}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>Desactivar indefinido</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>
                  Deja de cobrarse/reservarse hasta que tú lo reactives con el mismo switch.
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
  // "En cola" en vez de "0%" (treceava tanda): un Whimm en 0% no está
  // roto, solo está detrás de los primeros `whimmsSimultaneos` de la fila
  // — sin esto se veía como si no estuviera recibiendo nada por error.
  return (
    <div style={style}>
      <div style={{ height, background: 'var(--beige2)', borderRadius: height / 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--wine)', borderRadius: height / 2, transition: 'width .3s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--wine4)' }}>{pct > 0 ? `${pct}%` : 'En cola'}</span>
      </div>
    </div>
  )
}
