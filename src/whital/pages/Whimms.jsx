import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Toast from '../../components/Toast'
import { IconChevronLeft, IconClose, IconEdit, IconPlus } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, setUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import BotonEliminar from '../components/BotonEliminar'
import Campo, { Aviso } from '../components/Campo'
import FilaDeslizable from '../components/FilaDeslizable'
import { fotoDeEnlace, subirFotoWhimm } from '../lib/imagenes'
import InputConSugerencias from '../components/InputConSugerencias'
import Modal from '../components/Modal'
import PestanasCompras from '../components/PestanasCompras'
import SelectorRecordatorio from '../components/SelectorRecordatorio'
import { aNotif, deNotif } from '../lib/notificaciones'
import TileImagen from '../components/TileImagen'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import {
  NIVEL_DEFAULT,
  NIVEL_MAX,
  addDaysISO,
  addMonthsISO,
  computeBolsas,
  normalizarNivel,
  ocurrenciasPagoFijo,
  progresoPagoFijo,
  proyectarColaWhimms,
  todayISO,
} from '../lib/budget'
import { enDias, fechaCorta, fmt, parametrosMotor } from '../lib/vista'

const num = (v) => (v === '' || v == null ? 0 : Number(v))
const scoreDe10 = (score) => Math.min(10, Math.max(0, Number(score) || 0) * 1.1).toFixed(1)
const SITIOS = [[/amazon/, 'Amazon'], [/mercadolibre|mercadolivre/, 'Mercado Libre'], [/liverpool/, 'Liverpool'], [/coppel/, 'Coppel'], [/sephora/, 'Sephora'], [/shein/, 'Shein'], [/walmart/, 'Walmart'], [/cyamoda/, 'C&A'], [/pinterest|pin\.it/, 'Pinterest']]

function sitioDe(url) {
  const u = String(url || '').toLowerCase()
  const conocido = SITIOS.find(([re]) => re.test(u))
  if (conocido) return conocido[1]
  try {
    return new globalThis.URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Enlace'
  }
}

function Dato({ label, valor, color, sub }) {
  return (
    <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3, color }}>{valor}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Nivel({ valor, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: NIVEL_MAX }, (_, i) => i + 1).map((n) => (
        <button key={n} className="segbtn" style={{ background: valor === n ? 'var(--wine)' : 'var(--beige2)', color: valor === n ? '#fff' : 'var(--muted)' }} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  )
}

function Barra({ precio, progreso, alto = 6, texto = true }) {
  const pct = precio > 0 ? Math.min(100, Math.round((progreso / precio) * 100)) : 0
  return (
    <div>
      <div style={{ height: alto, background: 'var(--beige3)', borderRadius: alto / 2, overflow: 'hidden', opacity: 1 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--wine)', borderRadius: alto / 2, transition: 'width .3s ease' }} />
      </div>
      {texto && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)' }}>{progreso > 0 ? `${fmt(progreso)} de ${fmt(precio)}` : `De ${fmt(precio)}`}</span>
          <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--wine4)' }}>{progreso > 0 ? `${pct}%` : 'En cola'}</span>
        </div>
      )}
    </div>
  )
}

// "Reparto y prioridad": cuántos Whimms se van juntando a la vez (barra de avance).
function RepartoPrioridad({ libre, n, user, show }) {
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState(n)

  const guardar = async () => {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { whimmsSimultaneos: valor })
      show('Guardado')
      setAbierto(false)
    } catch {
      show('No se pudo guardar')
    }
  }
  const paso = { width: 40, height: 40, borderRadius: 20, background: 'var(--beige2)', fontSize: 20, fontWeight: 600, color: 'var(--acento)', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <>
      <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Reparto y prioridad</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{fmt(libre)} libres · {n} a la vez</div>
        </div>
        <button aria-label="Editar reparto y prioridad" onClick={() => { setValor(n); setAbierto(true) }} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconEdit size={14} color="var(--acento)" />
        </button>
      </div>
      <Modal abierto={abierto} onClose={() => setAbierto(false)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Financiar a la vez</div>
          <button aria-label="Cerrar" onClick={() => setAbierto(false)} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClose /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginBottom: 18 }}>
          <button aria-label="Menos Whimms a la vez" style={paso} onClick={() => setValor((v) => Math.max(1, v - 1))}>−</button>
          <div className="mono" style={{ fontSize: 34, fontWeight: 500, minWidth: 40, textAlign: 'center' }}>{valor}</div>
          <button aria-label="Más Whimms a la vez" style={paso} onClick={() => setValor((v) => Math.min(10, v + 1))}>+</button>
        </div>
        <button className="btn-primary" onClick={guardar}>Guardar</button>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------
// Detalle del Whimm: ventana en medio, igual que en la app original.
// ---------------------------------------------------------------------------
function WhimmDetalle({ whimm, r, posicion, progreso, datos, hoy, user, show, onCerrar, onEditar }) {
  const [accion, setAccion] = useState(null) // 'comprar' | 'apartar' | 'msi'
  const [precioPagado, setPrecioPagado] = useState(String(whimm.precioComprado ?? whimm.precio ?? ''))
  const [fechaCompra, setFechaCompra] = useState(hoy)
  const [extra, setExtra] = useState('')
  const [numPagos, setNumPagos] = useState('3')
  const [primerPago, setPrimerPago] = useState(addMonthsISO(hoy, 1))

  const estado = whimm.estado || 'espera'
  const enFila = estado === 'espera' || estado === 'apartando'
  const precio = Number(whimm.precio) || 0
  const apartado = Number(whimm.montoApartado) || 0
  const faltante = Math.max(precio - apartado, 0)
  const links = (Array.isArray(whimm.links) && whimm.links.length ? whimm.links : whimm.link ? [whimm.link] : []).filter(Boolean)
  const tarde = r && (r.estatus === 'tarde' || r.estatus === 'sin_fecha_segura')
  const estadoTexto = estado === 'comprado' ? 'Comprado' : estado === 'pagando' ? 'Pagando a meses' : tarde ? 'Llegaría tarde' : progreso > 0 ? 'Juntando' : 'En espera'

  const pago = estado === 'pagando' ? datos.pagosFijos.find((p) => p.id === whimm.pagoFijoMsiId) : null
  const fechasPago = pago ? ocurrenciasPagoFijo(pago, addDaysISO(hoy, 3660)) : []
  const progPago = pago ? progresoPagoFijo(pago, hoy) : null

  const ejecutar = async (fn, mensaje) => {
    try {
      await fn()
      show(mensaje)
      onCerrar()
    } catch {
      show('No se pudo guardar')
    }
  }

  const comprar = () => ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { estado: 'comprado', compradoEn: fechaCompra, precioComprado: num(precioPagado) }), 'Marcado como comprado')
  const regresarAFila = () => ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { estado: 'espera', compradoEn: null, precioComprado: null }), 'Regresó a la fila')
  const apartar = () => {
    const monto = Math.min(num(extra), faltante)
    if (!(monto > 0)) return undefined
    return ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { montoApartado: apartado + monto, estado: 'apartando' }), `Apartaste ${fmt(monto)}`)
  }
  const pagarAMeses = () => {
    const n = Math.max(Math.round(num(numPagos)), 2)
    const monto = Math.round((precio / n) * 100) / 100
    return ejecutar(async () => {
      const ref = await addUserDoc(user.uid, 'pagosFijos', { name: `MSI — ${whimm.name}`, monto, frecuencia: 'Mensual', tipo: 'MSI', fecha: primerPago, activo: true, finito: true, numPagos: n, whimmId: whimm.id, excepciones: {}, notifFormal: false, notifMini: false })
      await updateUserDoc(user.uid, 'whimms', whimm.id, { estado: 'pagando', pagoFijoMsiId: ref.id, precioComprado: precio })
    }, 'Ahora se paga a meses')
  }
  const cancelarMSI = () =>
    ejecutar(async () => {
      if (whimm.pagoFijoMsiId) await deleteUserDoc(user.uid, 'pagosFijos', whimm.pagoFijoMsiId)
      await updateUserDoc(user.uid, 'whimms', whimm.id, { estado: 'espera', pagoFijoMsiId: null, precioComprado: null })
    }, 'MSI cancelado')
  const eliminar = () =>
    ejecutar(async () => {
      if (whimm.pagoFijoMsiId) await deleteUserDoc(user.uid, 'pagosFijos', whimm.pagoFijoMsiId)
      await deleteUserDoc(user.uid, 'whimms', whimm.id)
    }, 'Whimm eliminado')

  const botonAccion = (k, texto) => (
    <button key={k} onClick={() => setAccion(accion === k ? null : k)} style={{ width: '100%', background: accion === k ? 'var(--wine)' : 'var(--beige2)', color: accion === k ? '#fff' : 'var(--wine)', borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 600 }}>{texto}</button>
  )

  const pie = (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={onEditar} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--beige2)', borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 600, color: 'var(--acento)' }}>
        <IconEdit color="var(--acento)" /> Editar
      </button>
      <BotonEliminar mensaje={`¿Eliminar "${whimm.name}"? No se puede deshacer.${estado === 'pagando' ? ' También se borra su plan de pagos.' : ''}`} onConfirmar={eliminar} />
    </div>
  )

  return (
    <Modal abierto onClose={onCerrar} pie={pie}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          <TileImagen url={whimm.imagenUrl} size={60} radius={14} icono={26} alt={whimm.name} />
          <div style={{ minWidth: 0 }}>
            {posicion && <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--wine4)' }}>#{posicion}</div>}
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{whimm.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{whimm.categoria}{whimm.lugar ? ` · ${whimm.lugar}` : ''}</div>
          </div>
        </div>
        <button aria-label="Cerrar" onClick={onCerrar} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconClose />
        </button>
      </div>

      <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{fmt(estado === 'comprado' || estado === 'pagando' ? whimm.precioComprado ?? precio : precio)}</div>
      {(estado === 'comprado' || estado === 'pagando') && whimm.precioComprado != null && whimm.precioComprado !== precio && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Estimado original: {fmt(precio)}</div>
      )}

      <div style={{ display: 'flex', gap: 10, margin: '16px 0 10px' }}>
        <Dato label="Categoría" valor={whimm.categoria || '—'} />
        <Dato label="Estado" valor={estadoTexto} color={tarde ? 'var(--red)' : undefined} />
      </div>

      {enFila && (
        <>
          <div style={{ background: 'var(--beige2)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>¿Cuándo puedo comprarlo?</div>
            <Barra precio={precio} progreso={progreso} alto={10} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <Dato label="Fecha estimada" valor={r?.fechaProyectada ? (r.estatus === 'comprable_hoy' ? 'Hoy' : fechaCorta(r.fechaProyectada)) : 'Sin fecha segura'} sub={r?.fechaProyectada && r.estatus !== 'comprable_hoy' ? enDias(r.fechaProyectada, hoy) : null} />
            <Dato label="Fecha límite" valor={whimm.fechaLimite ? fechaCorta(whimm.fechaLimite) : '—'} color={tarde ? 'var(--red)' : undefined} sub={whimm.fechaLimite ? enDias(whimm.fechaLimite, hoy) : null} />
          </div>
          {r?.intercambiado && <Aviso tono="amber">Espera al lunes por pasarte del presupuesto.</Aviso>}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, margin: '10px 0 16px' }}>
        <Dato label="Necesidad" valor={`${normalizarNivel(whimm.necesidad)}/${NIVEL_MAX}`} />
        <Dato label="Deseo" valor={`${normalizarNivel(whimm.deseo)}/${NIVEL_MAX}`} />
        {r && <Dato label="Calificación" valor={scoreDe10(r.score)} />}
      </div>

      {estado === 'pagando' && (
        <div style={{ background: 'var(--beige2)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>Pagando a meses (MSI)</div>
          {pago ? (
            <>
              <Barra precio={progPago.total || 1} progreso={progPago.pagados} alto={10} texto={false} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{progPago.pagados} de {progPago.total} pagos</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--wine4)' }}>{fmt(pago.monto)}/mes</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fechasPago.map((p) => (
                  <div key={p.fecha} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: p.omitida ? 0.5 : 1 }}>
                    <span style={{ color: p.fecha <= hoy ? 'var(--muted)' : 'var(--text)', textDecoration: p.omitida ? 'line-through' : 'none' }}>{fechaCorta(p.fecha)}{p.fecha <= hoy && !p.omitida ? ' · pagado' : ''}</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{fmt(p.monto)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--red)' }}>No encuentro el pago a meses ligado.</div>
          )}
        </div>
      )}

      {estado === 'comprado' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <Dato label="Fecha de compra" valor={whimm.compradoEn ? fechaCorta(whimm.compradoEn) : '—'} />
          <Dato label="Precio pagado" valor={fmt(whimm.precioComprado ?? precio)} />
        </div>
      )}

      {enFila && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {botonAccion('comprar', 'Ya lo compré')}
          {accion === 'comprar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><Campo label="Precio pagado"><input className="fld" type="number" inputMode="decimal" value={precioPagado} onChange={(e) => setPrecioPagado(e.target.value)} /></Campo></div>
                <div style={{ flex: 1 }}><Campo label="Fecha"><input className="fld" type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} /></Campo></div>
              </div>
              <button className="btn-primary" onClick={comprar}>Marcar como comprado</button>
            </div>
          )}
          {botonAccion('apartar', estado === 'apartando' ? 'Actualizar monto apartado' : 'Apartar fondos')}
          {accion === 'apartar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Campo label={`Monto a apartar · faltan ${fmt(faltante)}`}><input className="fld" type="number" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} /></Campo>
              <button className="btn-primary" onClick={apartar}>Apartar</button>
            </div>
          )}
          {botonAccion('msi', 'Pagar a meses (MSI)')}
          {accion === 'msi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><Campo label="Meses"><input className="fld" type="number" inputMode="numeric" value={numPagos} onChange={(e) => setNumPagos(e.target.value)} /></Campo></div>
                <div style={{ flex: 1 }}><Campo label="Primer pago"><input className="fld" type="date" value={primerPago} onChange={(e) => setPrimerPago(e.target.value)} /></Campo></div>
              </div>
              <button className="btn-primary" onClick={pagarAMeses}>Confirmar {fmt(precio / Math.max(Math.round(num(numPagos)), 2))} al mes</button>
            </div>
          )}
        </div>
      )}

      {estado === 'pagando' && <div style={{ marginBottom: 14 }}><BotonEliminar texto="Cancelar los meses" mensaje="Se borra el plan de pagos y el Whimm vuelve a tu fila." onConfirmar={cancelarMSI} /></div>}
      {estado === 'comprado' && <button onClick={regresarAFila} style={{ width: '100%', background: 'var(--beige2)', borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 600, color: 'var(--acento)', marginBottom: 14 }}>Regresar a la fila</button>}

      {links.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Dónde lo encontré</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {links.map((lk, i) => (
              <div key={i} style={{ background: 'var(--beige2)', borderRadius: 12, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{sitioDe(lk)}</div>
                <a href={lk} target="_blank" rel="noreferrer" style={{ background: 'var(--wine)', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600 }}>Ver</a>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Alta / edición del Whimm: también ventana en medio, con flecha para volver.
// ---------------------------------------------------------------------------
function WhimmEdicion({ whimm, datos, user, show, onCerrar }) {
  const nuevo = !whimm?.id
  const [name, setName] = useState(whimm?.name || '')
  const [categoria, setCategoria] = useState(whimm?.categoria || '')
  const [precio, setPrecio] = useState(whimm?.precio != null ? String(whimm.precio) : '')
  const [lugar, setLugar] = useState(whimm?.lugar || '')
  const [imagenUrl, setImagenUrl] = useState(whimm?.imagenUrl || '')
  const [link, setLink] = useState(whimm?.links?.[0] || whimm?.link || '')
  const [necesidad, setNecesidad] = useState(normalizarNivel(whimm?.necesidad ?? NIVEL_DEFAULT))
  const [deseo, setDeseo] = useState(normalizarNivel(whimm?.deseo ?? NIVEL_DEFAULT))
  const [fechaLimite, setFechaLimite] = useState(whimm?.fechaLimite || '')
  const [precioPagado, setPrecioPagado] = useState(whimm?.precioComprado != null ? String(whimm.precioComprado) : '')
  const [fechaCompra, setFechaCompra] = useState(whimm?.compradoEn || '')
  const [notif, setNotif] = useState(deNotif(whimm?.notifCadaMin))
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [pegarUrl, setPegarUrl] = useState(false)

  const categorias = useMemo(() => [...new Set(datos.whimms.map((w) => w.categoria).filter(Boolean))], [datos.whimms])
  const comprado = whimm?.estado === 'comprado'
  const puedeGuardar = name.trim() && num(precio) > 0

  // Foto: desde la galería/cámara del celular o tomada del enlace de la tienda.
  const conFoto = async (obtener, errorTexto) => {
    setSubiendoFoto(true)
    try {
      setImagenUrl(await obtener())
    } catch (e) {
      show(e?.message && !/internal|functions\//i.test(e.message) ? e.message : errorTexto)
    } finally {
      setSubiendoFoto(false)
    }
  }
  const elegirFoto = (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (archivo) conFoto(() => subirFotoWhimm(user.uid, archivo), 'No se pudo subir la foto')
  }

  const guardar = async () => {
    const campos = { name: name.trim(), categoria: categoria.trim(), precio: num(precio), lugar: lugar.trim(), imagenUrl: imagenUrl.trim(), links: link.trim() ? [link.trim()] : [], necesidad, deseo, fechaLimite: fechaLimite || null, notifCadaMin: aNotif(notif) }
    try {
      if (nuevo) await addUserDoc(user.uid, 'whimms', { ...campos, estado: 'espera', montoApartado: 0, notifFormal: false, notifMini: false })
      else await updateUserDoc(user.uid, 'whimms', whimm.id, comprado ? { ...campos, precioComprado: num(precioPagado), compradoEn: fechaCompra || null } : campos)
      show(nuevo ? 'Whimm agregado' : 'Whimm actualizado')
      onCerrar()
    } catch {
      show('No se pudo guardar')
    }
  }

  return (
    <Modal abierto onClose={onCerrar} nivel={1}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button aria-label="Atrás" onClick={onCerrar}><IconChevronLeft /></button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{nuevo ? 'Nuevo Whimm' : 'Editar Whimm'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo label="Nombre"><input className="fld" value={name} onChange={(e) => setName(e.target.value)} /></Campo>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Campo label="Precio"><input className="fld" type="number" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} /></Campo></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Campo label="Categoría">
              <InputConSugerencias value={categoria} onChange={setCategoria} opciones={categorias} />
            </Campo>
          </div>
        </div>
        {comprado && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Campo label="Precio pagado"><input className="fld" type="number" inputMode="decimal" value={precioPagado} onChange={(e) => setPrecioPagado(e.target.value)} /></Campo></div>
            <div style={{ flex: 1 }}><Campo label="Fecha de compra"><input className="fld" type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} /></Campo></div>
          </div>
        )}
        <Campo label="Necesidad"><Nivel valor={necesidad} onChange={setNecesidad} /></Campo>
        <Campo label="Deseo"><Nivel valor={deseo} onChange={setDeseo} /></Campo>
        <Campo label="Fecha límite (opcional)">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="fld" type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
            {fechaLimite && <button className="pill" style={{ background: 'var(--beige2)' }} onClick={() => setFechaLimite('')}>Quitar</button>}
          </div>
        </Campo>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Campo label="Lugar"><input className="fld" value={lugar} onChange={(e) => setLugar(e.target.value)} /></Campo></div>
          <div style={{ flex: 1 }}><Campo label="Link"><input className="fld" value={link} onChange={(e) => setLink(e.target.value)} /></Campo></div>
        </div>
        <Campo label="Foto">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TileImagen url={imagenUrl} size={64} radius={14} icono={26} alt={name} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <label className="pill" style={{ background: 'var(--beige2)', color: 'var(--acento)', cursor: 'pointer', opacity: subiendoFoto ? 0.5 : 1 }}>
                  {subiendoFoto ? 'Subiendo…' : 'Elegir foto'}
                  <input type="file" accept="image/*" disabled={subiendoFoto} onChange={elegirFoto} style={{ display: 'none' }} />
                </label>
                {link.trim() && (
                  <button type="button" className="pill" disabled={subiendoFoto} style={{ background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => conFoto(() => fotoDeEnlace(link.trim()), 'No pude sacar la foto de ese enlace. Elige una de tu galería')}>
                    Foto del enlace
                  </button>
                )}
                {imagenUrl && <button type="button" className="pill" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={() => setImagenUrl('')}>Quitar</button>}
              </div>
              <button type="button" style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'left' }} onClick={() => setPegarUrl((v) => !v)}>{pegarUrl ? 'Ocultar enlace de imagen' : 'o pegar enlace de imagen'}</button>
            </div>
          </div>
          {pegarUrl && <input className="fld" style={{ marginTop: 8 }} value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} placeholder="https://…" />}
        </Campo>
        <SelectorRecordatorio valor={notif} onChange={setNotif} />
        <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45 }} disabled={!puedeGuardar} onClick={guardar}>{nuevo ? 'Agregar a la fila' : 'Guardar cambios'}</button>
      </div>
    </Modal>
  )
}

const chipEstado = { fontSize: 11, color: 'var(--muted)', background: 'var(--beige2)', padding: '5px 10px', borderRadius: 8 }

function TarjetaFila({ w, r, posicion, progreso, hoy, onClick }) {
  const tarde = r.estatus === 'tarde' || r.estatus === 'sin_fecha_segura'
  return (
    <div onClick={onClick} className="card" style={{ padding: 14, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          <TileImagen url={w.imagenUrl} size={76} radius={16} icono={30} alt={w.name} />
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--wine4)' }}>#{posicion}</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{w.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{w.categoria}{w.lugar ? ` · ${w.lugar}` : ''}</div>
          </div>
        </div>
        <span className="mono" style={{ background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '6px 14px', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{scoreDe10(r.score)}</span>
      </div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 10 }}>{fmt(w.precio)}</div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={tarde ? { ...chipEstado, color: 'var(--red)', background: 'var(--red-bg)', fontWeight: 600 } : chipEstado}>
          {r.estatus === 'tarde' ? 'Llegaría tarde' : r.estatus === 'sin_fecha_segura' ? 'Sin fecha segura' : progreso > 0 ? 'Juntando' : 'En espera'}
        </span>
        {r.intercambiado && <span style={{ ...chipEstado, color: 'var(--amber)', fontWeight: 600 }}>Espera al lunes</span>}
        {r.fechaProyectada && <span style={{ fontSize: 11, color: 'var(--wine4)', fontWeight: 600 }}>{r.estatus === 'comprable_hoy' ? 'Cómpralo hoy' : `Estimado ${fechaCorta(r.fechaProyectada)} · ${enDias(r.fechaProyectada, hoy)}`}</span>}
        {r.fechaLimite && <span style={{ fontSize: 11, color: tarde ? 'var(--red)' : 'var(--muted)' }}>Límite {fechaCorta(r.fechaLimite)}</span>}
      </div>
      <div style={{ marginTop: 8 }}><Barra precio={Number(w.precio) || 0} progreso={progreso} /></div>
    </div>
  )
}

export default function Whimms() {
  const { user } = useAuth()
  const location = useLocation()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [tab, setTab] = useState('fila')
  const [detalleId, setDetalleId] = useState(location.state?.openWhimmId || null)
  const [edicion, setEdicion] = useState(location.state?.nuevo ? {} : null) // null | {} (nuevo) | { whimm }

  const base = useMemo(() => (loading ? null : parametrosMotor(datos, hoy)), [datos, loading, hoy])
  const cola = useMemo(() => (base ? proyectarColaWhimms(base) : []), [base])
  const libre = useMemo(() => (base ? computeBolsas(base).bolsaWhimms : 0), [base])
  const simultaneos = base?.whimmsSimultaneos || 1
  const porId = useMemo(() => new Map(datos.whimms.map((w) => [w.id, w])), [datos.whimms])
  const colaPorId = useMemo(() => new Map(cola.map((r, i) => [r.id, { r, posicion: i + 1 }])), [cola])

  const enFila = cola.map((r) => ({ r, w: porId.get(r.id) })).filter((x) => x.w)
  const pagando = datos.whimms.filter((w) => w.estado === 'pagando')
  const comprados = datos.whimms.filter((w) => w.estado === 'comprado').sort((a, b) => (b.compradoEn || '').localeCompare(a.compradoEn || ''))
  const progresoDe = (w) => (Number(w.montoApartado) || 0) + (colaPorId.get(w.id)?.r.avanceHoy || 0)

  const detalle = detalleId ? porId.get(detalleId) : null

  const eliminarWhimm = async (w) => {
    try {
      if (w.pagoFijoMsiId) await deleteUserDoc(user.uid, 'pagosFijos', w.pagoFijoMsiId)
      await deleteUserDoc(user.uid, 'whimms', w.id)
      show('Whimm eliminado')
    } catch {
      show('No se pudo eliminar')
    }
  }
  const deslizable = (w, hijo) => (
    <FilaDeslizable key={w.id} radio={16} titulo={`Eliminar ${w.name}`} mensaje={`¿Eliminar este Whimm? No se puede deshacer.${w.estado === 'pagando' ? ' También se borra su plan de pagos.' : ''}`} onEliminar={() => eliminarWhimm(w)} onTap={() => setDetalleId(w.id)}>
      {hijo}
    </FilaDeslizable>
  )
  const tabs = [['fila', `En fila (${enFila.length})`], ['pagando', `Pagando (${pagando.length})`], ['comprados', `Comprados (${comprados.length})`]]

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PestanasCompras activa="whimms" />
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          {!base && !error && <div className="empty-state">Cargando…</div>}
          {base && (
            <>
              <RepartoPrioridad libre={libre} n={simultaneos} user={user} show={show} />

              <div style={{ display: 'flex', gap: 6, background: 'var(--beige2)', padding: 4, borderRadius: 12 }}>
                {tabs.map(([k, t]) => (
                  <button key={k} className="segbtn" style={{ background: tab === k ? 'var(--wine)' : 'transparent', color: tab === k ? '#fff' : 'var(--muted)' }} onClick={() => setTab(k)}>{t}</button>
                ))}
              </div>

              {tab === 'fila' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {enFila.map(({ r, w }, i) => deslizable(w, <TarjetaFila w={w} r={r} posicion={i + 1} progreso={progresoDe(w)} hoy={hoy} />))}
                  {enFila.length === 0 && <div className="empty-state">Sin Whimms en fila</div>}
                </div>
              )}

              {tab === 'pagando' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pagando.map((w) => {
                    const pago = datos.pagosFijos.find((p) => p.id === w.pagoFijoMsiId)
                    const prog = pago ? progresoPagoFijo(pago, hoy) : null
                    return deslizable(w, (
                      <div className="card" style={{ padding: 14, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <TileImagen url={w.imagenUrl} size={60} radius={14} icono={26} alt={w.name} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>{w.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{w.categoria}</div>
                          </div>
                          <div className="mono" style={{ fontSize: 15, fontWeight: 500 }}>{pago ? `${fmt(pago.monto)}/mes` : fmt(w.precio)}</div>
                        </div>
                        {prog && (
                          <div style={{ marginTop: 10 }}>
                            <Barra precio={prog.total || 1} progreso={prog.pagados} texto={false} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                              <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)' }}>{prog.pagados} de {prog.total} pagos</span>
                              <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--wine4)' }}>{prog.siguiente ? `Siguiente ${fechaCorta(prog.siguiente)}` : 'Liquidado'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  })}
                  {pagando.length === 0 && <div className="empty-state">Nada a meses por ahora</div>}
                </div>
              )}

              {tab === 'comprados' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comprados.map((w) => deslizable(w,
                    <div className="card card-solid" style={{ padding: 13, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <TileImagen url={w.imagenUrl} size={44} radius={12} icono={19} alt={w.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{w.categoria} · {w.compradoEn ? fechaCorta(w.compradoEn) : 'sin fecha'}</div>
                      </div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(w.precioComprado ?? w.precio)}</div>
                    </div>
                  ))}
                  {comprados.length === 0 && <div className="empty-state">Aún no hay Whimms comprados</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <button className="fab" onClick={() => setEdicion({})} aria-label="Agregar Whimm"><IconPlus /></button>

      {detalle && base && !edicion && (
        <WhimmDetalle
          key={detalle.id}
          whimm={detalle}
          r={colaPorId.get(detalle.id)?.r}
          posicion={colaPorId.get(detalle.id)?.posicion}
          progreso={progresoDe(detalle)}
          datos={datos}
          hoy={hoy}
          user={user}
          show={show}
          onCerrar={() => setDetalleId(null)}
          onEditar={() => setEdicion({ whimm: detalle })}
        />
      )}
      {edicion && base && (
        <WhimmEdicion key={edicion.whimm?.id || 'nuevo'} whimm={edicion.whimm} datos={datos} user={user} show={show} onCerrar={() => setEdicion(null)} />
      )}
      <Toast message={message} />
    </>
  )
}
