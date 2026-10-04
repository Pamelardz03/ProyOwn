import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Toast from '../../components/Toast'
import { IconEdit, IconPlus } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, setUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import Campo, { Aviso } from '../components/Campo'
import Sheet from '../components/Sheet'
import TileImagen from '../components/TileImagen'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { NIVEL_DEFAULT, NIVEL_MAX, addMonthsISO, analizarPresupuestoSemanal, computeBolsas, normalizarNivel, progresoPagoFijo, proyectarColaWhimms, todayISO } from '../lib/budget'
import { fechaCorta, fmt, parametrosMotor } from '../lib/vista'

const num = (v) => (v === '' || v == null ? 0 : Number(v))
const scoreDe10 = (score) => Math.min(10, Math.max(0, Number(score) || 0) * 1.1).toFixed(1)

function Nivel({ valor, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: NIVEL_MAX }, (_, i) => i + 1).map((n) => (
        <button key={n} className="segbtn" style={{ background: valor === n ? 'var(--wine)' : 'var(--beige2)', color: valor === n ? '#fff' : 'var(--muted)' }} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  )
}

function PresupuestoSemanal({ datos, base, user, show }) {
  const analisis = useMemo(() => analizarPresupuestoSemanal({ gastos: datos.gastos, presupuestoSemanal: base.presupuestoSemanal, hoyISO: base.hoyISO }), [datos.gastos, base])
  const bolsas = useMemo(() => computeBolsas(base), [base])
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')

  const guardar = async (monto) => {
    if (!(monto > 0)) return
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { presupuestoSemanal: monto })
      show('Presupuesto actualizado')
      setEditando(false)
    } catch {
      show('No se pudo guardar')
    }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Presupuesto semanal</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{fmt(base.presupuestoSemanal)}/semana · {fmt(bolsas.bolsaWhimms)} libres para Whimms</div>
        </div>
        <button aria-label="Editar presupuesto semanal" onClick={() => { setValor(String(base.presupuestoSemanal)); setEditando(!editando) }} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconEdit size={14} color="var(--wine)" />
        </button>
      </div>
      {editando && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="fld" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff', flex: 'none', padding: '0 16px' }} onClick={() => guardar(num(valor))}>Guardar</button>
          </div>
          {analisis.confiable && analisis.sugerido !== base.presupuestoSemanal && (
            <button style={{ alignSelf: 'flex-start', fontSize: 11, color: 'var(--wine)', fontWeight: 700, textDecoration: 'underline' }} onClick={() => guardar(analisis.sugerido)}>
              Lo que más gastas por semana: {fmt(analisis.sugerido)} · usar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function WhimmForm({ whimm, datos, base, user, show, onCerrar }) {
  const nuevo = !whimm?.id
  const hoy = base.hoyISO
  const [name, setName] = useState(whimm?.name || '')
  const [categoria, setCategoria] = useState(whimm?.categoria || '')
  const [precio, setPrecio] = useState(whimm?.precio != null ? String(whimm.precio) : '')
  const [lugar, setLugar] = useState(whimm?.lugar || '')
  const [imagenUrl, setImagenUrl] = useState(whimm?.imagenUrl || '')
  const [link, setLink] = useState(whimm?.links?.[0] || whimm?.link || '')
  const [necesidad, setNecesidad] = useState(normalizarNivel(whimm?.necesidad ?? NIVEL_DEFAULT))
  const [deseo, setDeseo] = useState(normalizarNivel(whimm?.deseo ?? NIVEL_DEFAULT))
  const [fechaLimite, setFechaLimite] = useState(whimm?.fechaLimite || '')
  const [accion, setAccion] = useState(null) // 'comprar' | 'apartar' | 'msi'
  const [precioPagado, setPrecioPagado] = useState(whimm?.precioComprado != null ? String(whimm.precioComprado) : String(whimm?.precio ?? ''))
  const [fechaCompra, setFechaCompra] = useState(whimm?.compradoEn || hoy)
  const [extra, setExtra] = useState('')
  const [numPagos, setNumPagos] = useState('3')
  const [primerPago, setPrimerPago] = useState(addMonthsISO(hoy, 1))
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)

  const categorias = useMemo(() => [...new Set(datos.whimms.map((w) => w.categoria).filter(Boolean))], [datos.whimms])
  const estado = whimm?.estado || 'espera'
  const faltante = Math.max(num(precio) - (Number(whimm?.montoApartado) || 0), 0)

  const campos = () => ({
    name: name.trim(),
    categoria: categoria.trim(),
    precio: num(precio),
    lugar: lugar.trim(),
    imagenUrl: imagenUrl.trim(),
    links: link.trim() ? [link.trim()] : [],
    necesidad,
    deseo,
    fechaLimite: fechaLimite || null,
  })

  const ejecutar = async (fn, mensaje) => {
    try {
      await fn()
      show(mensaje)
      onCerrar()
    } catch {
      show('No se pudo guardar')
    }
  }

  const guardar = () =>
    ejecutar(async () => {
      if (nuevo) await addUserDoc(user.uid, 'whimms', { ...campos(), estado: 'espera', montoApartado: 0, notifFormal: false, notifMini: false })
      else await updateUserDoc(user.uid, 'whimms', whimm.id, campos())
    }, nuevo ? 'Whimm agregado' : 'Whimm actualizado')

  const comprar = () => ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { ...campos(), estado: 'comprado', compradoEn: fechaCompra, precioComprado: num(precioPagado) }), 'Marcado como comprado')
  const guardarCompra = () => ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { compradoEn: fechaCompra, precioComprado: num(precioPagado) }), 'Compra actualizada')
  const regresarAFila = () => ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { estado: 'espera', compradoEn: null, precioComprado: null }), 'Regresó a la fila')

  const apartar = () => {
    const monto = Math.min(num(extra), faltante)
    if (!(monto > 0)) return
    return ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { montoApartado: (Number(whimm.montoApartado) || 0) + monto, estado: 'apartando' }), `Apartaste ${fmt(monto)}`)
  }

  const pagarAMeses = () => {
    const n = Math.max(Math.round(num(numPagos)), 2)
    const pago = Math.round((num(precio) / n) * 100) / 100
    return ejecutar(async () => {
      const ref = await addUserDoc(user.uid, 'pagosFijos', {
        name: `MSI — ${whimm.name}`, monto: pago, frecuencia: 'Mensual', tipo: 'MSI', fecha: primerPago, activo: true, finito: true, numPagos: n, whimmId: whimm.id, excepciones: {}, notifFormal: false, notifMini: false,
      })
      await updateUserDoc(user.uid, 'whimms', whimm.id, { ...campos(), estado: 'pagando', pagoFijoMsiId: ref.id, precioComprado: num(precio) })
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

  const botonEliminar = (texto) => (
    <button style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmarEliminar ? eliminar() : setConfirmarEliminar(true))}>
      {confirmarEliminar ? 'Toca de nuevo para eliminar' : texto}
    </button>
  )
  const puedeGuardar = name.trim() && num(precio) > 0

  if (estado === 'comprado') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TileImagen url={whimm.imagenUrl} size={48} radius={12} icono={20} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{whimm.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Campo label="Precio pagado"><input className="fld" type="number" inputMode="decimal" value={precioPagado} onChange={(e) => setPrecioPagado(e.target.value)} /></Campo></div>
          <div style={{ flex: 1 }}><Campo label="Fecha de compra"><input className="fld" type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} /></Campo></div>
        </div>
        <button className="btn-primary" onClick={guardarCompra}>Guardar cambios</button>
        <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={regresarAFila}>Regresar a la fila</button>
        {botonEliminar('Eliminar')}
      </div>
    )
  }

  if (estado === 'pagando') {
    const pago = datos.pagosFijos.find((p) => p.id === whimm.pagoFijoMsiId)
    const prog = pago ? progresoPagoFijo(pago, hoy) : null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TileImagen url={whimm.imagenUrl} size={48} radius={12} icono={20} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{whimm.name}</div>
        </div>
        {pago ? (
          <Aviso tono="green">
            {fmt(pago.monto)} al mes · {prog.pagados} de {prog.total} pagos{prog.siguiente ? ` · siguiente ${fechaCorta(prog.siguiente)}` : ' · liquidado'}
          </Aviso>
        ) : (
          <Aviso tono="red">No encuentro el pago a meses ligado.</Aviso>
        )}
        <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={cancelarMSI}>Cancelar los meses y regresar a la fila</button>
        {botonEliminar('Eliminar')}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Campo label="Nombre"><input className="fld" value={name} onChange={(e) => setName(e.target.value)} /></Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Precio"><input className="fld" type="number" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}>
          <Campo label="Categoría">
            <input className="fld" list="cats-whimm" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
            <datalist id="cats-whimm">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
        </div>
      </div>
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
      <Campo label="Imagen (URL)"><input className="fld" value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} /></Campo>

      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45 }} disabled={!puedeGuardar} onClick={guardar}>{nuevo ? 'Agregar a la fila' : 'Guardar cambios'}</button>

      {!nuevo && (
        <div style={{ borderTop: '1px solid var(--beige3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['comprar', 'Ya lo compré'], ['apartar', 'Apartar'], ['msi', 'A meses']].map(([k, t]) => (
              <button key={k} className="segbtn" style={{ fontSize: 11, background: accion === k ? 'var(--wine)' : 'var(--beige2)', color: accion === k ? '#fff' : 'var(--wine)' }} onClick={() => setAccion(accion === k ? null : k)}>{t}</button>
            ))}
          </div>
          {accion === 'comprar' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><Campo label="Precio pagado"><input className="fld" type="number" inputMode="decimal" value={precioPagado} onChange={(e) => setPrecioPagado(e.target.value)} /></Campo></div>
                <div style={{ flex: 1 }}><Campo label="Fecha"><input className="fld" type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} /></Campo></div>
              </div>
              <button className="btn-primary" onClick={comprar}>Marcar como comprado</button>
            </>
          )}
          {accion === 'apartar' && (
            <>
              <Campo label={`Monto a apartar · faltan ${fmt(faltante)}`}><input className="fld" type="number" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} /></Campo>
              <button className="btn-primary" onClick={apartar}>Apartar</button>
            </>
          )}
          {accion === 'msi' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><Campo label="Meses"><input className="fld" type="number" inputMode="numeric" value={numPagos} onChange={(e) => setNumPagos(e.target.value)} /></Campo></div>
                <div style={{ flex: 1 }}><Campo label="Primer pago"><input className="fld" type="date" value={primerPago} onChange={(e) => setPrimerPago(e.target.value)} /></Campo></div>
              </div>
              <button className="btn-primary" onClick={pagarAMeses}>Pasar a {fmt(num(precio) / Math.max(Math.round(num(numPagos)), 2))} al mes</button>
            </>
          )}
          {botonEliminar('Eliminar Whimm')}
        </div>
      )}
    </div>
  )
}

function Barra({ precio, apartado }) {
  const pct = precio > 0 ? Math.min(100, Math.round((apartado / precio) * 100)) : 0
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 6, background: 'var(--beige2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--wine)', borderRadius: 3 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)' }}>{apartado > 0 ? `${fmt(apartado)} de ${fmt(precio)}` : `De ${fmt(precio)}`}</span>
        <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--wine4)' }}>{apartado > 0 ? `${pct}%` : 'En cola'}</span>
      </div>
    </div>
  )
}

const chipEstado = { fontSize: 11, color: 'var(--muted)', background: 'var(--beige2)', padding: '5px 10px', borderRadius: 8 }

function TarjetaFila({ w, r, posicion, onClick }) {
  const apartado = Number(w.montoApartado) || 0
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
          {r.estatus === 'tarde' ? 'Llegaría tarde' : r.estatus === 'sin_fecha_segura' ? 'Sin fecha segura' : apartado > 0 ? 'Juntando' : 'En espera'}
        </span>
        {r.intercambiado && <span style={{ ...chipEstado, color: 'var(--amber)', fontWeight: 600 }}>Espera al lunes</span>}
        {r.fechaProyectada && (
          <span style={{ fontSize: 11, color: 'var(--wine4)', fontWeight: 600 }}>{r.estatus === 'comprable_hoy' ? 'Cómpralo hoy' : `Estimado ${fechaCorta(r.fechaProyectada)}`}</span>
        )}
        {r.fechaLimite && <span style={{ fontSize: 11, color: tarde ? 'var(--red)' : 'var(--muted)' }}>Límite {fechaCorta(r.fechaLimite)}</span>}
      </div>
      <Barra precio={Number(w.precio) || 0} apartado={apartado} />
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
  const [sheet, setSheet] = useState(null) // null | {} (nuevo) | { whimm }
  const [pendienteAbrir, setPendienteAbrir] = useState(location.state?.openWhimmId || null)

  const base = useMemo(() => (loading ? null : parametrosMotor(datos, hoy)), [datos, loading, hoy])
  const cola = useMemo(() => (base ? proyectarColaWhimms(base) : []), [base])
  const porId = useMemo(() => new Map(datos.whimms.map((w) => [w.id, w])), [datos.whimms])

  const enFila = cola.map((r) => ({ r, w: porId.get(r.id) })).filter((x) => x.w)
  const pagando = datos.whimms.filter((w) => w.estado === 'pagando')
  const comprados = datos.whimms.filter((w) => w.estado === 'comprado').sort((a, b) => (b.compradoEn || '').localeCompare(a.compradoEn || ''))

  // Abre el detalle de un Whimm que llegó por navegación (p. ej. desde Inicio).
  const whimmEnlazado = !sheet && pendienteAbrir ? porId.get(pendienteAbrir) : null
  const hojaAbierta = !!sheet || !!whimmEnlazado
  const whimmEnHoja = sheet ? sheet.whimm : whimmEnlazado
  const cerrar = () => { setSheet(null); setPendienteAbrir(null) }

  const tabs = [['fila', `En fila (${enFila.length})`], ['pagando', `Pagando (${pagando.length})`], ['comprados', `Comprados (${comprados.length})`]]
  const tituloHoja = !whimmEnHoja ? 'Nuevo Whimm' : whimmEnHoja.estado === 'comprado' ? 'Compra' : whimmEnHoja.estado === 'pagando' ? 'Pagando a meses' : 'Whimm'

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1>Whimms</h1>
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          {!base && !error && <div className="empty-state">Cargando…</div>}
          {base && (
            <>
              <PresupuestoSemanal datos={datos} base={base} user={user} show={show} />

              <div style={{ display: 'flex', gap: 6, background: 'var(--beige2)', padding: 4, borderRadius: 12 }}>
                {tabs.map(([k, t]) => (
                  <button key={k} className="segbtn" style={{ background: tab === k ? 'var(--wine)' : 'transparent', color: tab === k ? '#fff' : 'var(--muted)' }} onClick={() => setTab(k)}>{t}</button>
                ))}
              </div>

              {tab === 'fila' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {enFila.map(({ r, w }, i) => <TarjetaFila key={w.id} w={w} r={r} posicion={i + 1} onClick={() => setSheet({ whimm: w })} />)}
                  {enFila.length === 0 && <div className="empty-state">Sin Whimms en fila</div>}
                </div>
              )}

              {tab === 'pagando' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pagando.map((w) => {
                    const pago = datos.pagosFijos.find((p) => p.id === w.pagoFijoMsiId)
                    const prog = pago ? progresoPagoFijo(pago, hoy) : null
                    return (
                      <div key={w.id} onClick={() => setSheet({ whimm: w })} className="card" style={{ padding: 14, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
                        <TileImagen url={w.imagenUrl} size={60} radius={14} icono={26} alt={w.name} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{w.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {prog ? `${prog.pagados} de ${prog.total} pagos${prog.siguiente ? ` · siguiente ${fechaCorta(prog.siguiente)}` : ''}` : 'Sin plan ligado'}
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: 15, fontWeight: 500 }}>{pago ? `${fmt(pago.monto)}/mes` : fmt(w.precio)}</div>
                      </div>
                    )
                  })}
                  {pagando.length === 0 && <div className="empty-state">Nada a meses por ahora</div>}
                </div>
              )}

              {tab === 'comprados' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comprados.map((w) => (
                    <div key={w.id} onClick={() => setSheet({ whimm: w })} className="card card-solid" style={{ padding: 13, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
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

      <button className="fab" onClick={() => setSheet({})} aria-label="Agregar Whimm"><IconPlus /></button>
      <Sheet abierto={hojaAbierta} onClose={cerrar} titulo={tituloHoja}>
        {hojaAbierta && base && <WhimmForm key={whimmEnHoja?.id || 'nuevo'} whimm={whimmEnHoja} datos={datos} base={base} user={user} show={show} onCerrar={cerrar} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
