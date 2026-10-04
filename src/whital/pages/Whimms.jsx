import { useMemo, useState } from 'react'
import Toast from '../../components/Toast'
import { IconPlus } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, setUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import Campo, { Aviso } from '../components/Campo'
import Sheet from '../components/Sheet'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { NIVEL_DEFAULT, NIVEL_MAX, addMonthsISO, analizarPresupuestoSemanal, normalizarNivel, progresoPagoFijo, proyectarColaWhimms, todayISO } from '../lib/budget'
import { fechaCorta, fmt, parametrosMotor } from '../lib/vista'

const ESTATUS = {
  comprable_hoy: { texto: 'Comprable hoy', color: 'var(--green)', bg: 'var(--green-bg)' },
  en_fecha: { texto: 'En fecha', color: 'var(--green)', bg: 'var(--green-bg)' },
  tarde: { texto: 'Llegaría tarde', color: 'var(--red)', bg: 'var(--red-bg)' },
  sin_fecha_segura: { texto: 'Sin fecha segura', color: 'var(--red)', bg: 'var(--red-bg)' },
}

const num = (v) => (v === '' || v == null ? 0 : Number(v))

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
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow">Presupuesto semanal fijo</div>
          <div className="mono" style={{ fontSize: 22, marginTop: 4 }}>{fmt(base.presupuestoSemanal)}</div>
        </div>
        <button className="pill" style={{ background: 'var(--beige2)', color: 'var(--wine)' }} onClick={() => { setValor(String(base.presupuestoSemanal)); setEditando(!editando) }}>
          {editando ? 'Cerrar' : 'Cambiar'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.4 }}>
        Todo lo que no se va en gastos de la semana ni en Vitalls queda libre para tu fila de Whimms.
      </div>
      {analisis.semanasCerradasAnalizadas > 0 && (
        <div style={{ fontSize: 11, marginTop: 8, color: analisis.confiable ? 'var(--text)' : 'var(--muted)' }}>
          {analisis.confiable
            ? `Lo que más has gastado por semana: ${fmt(analisis.sugerido)} (últimas ${analisis.semanasCerradasAnalizadas} semanas).`
            : `Con ${analisis.semanasCerradasAnalizadas} semana(s) cerrada(s) todavía no hay un número confiable; ~${fmt(analisis.sugerido)} por ahora.`}
          {analisis.confiable && analisis.sugerido !== base.presupuestoSemanal && (
            <button style={{ marginLeft: 8, color: 'var(--wine)', fontWeight: 700, textDecoration: 'underline' }} onClick={() => guardar(analisis.sugerido)}>Usar {fmt(analisis.sugerido)}</button>
          )}
        </div>
      )}
      {editando && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="fld" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff', flex: 'none', padding: '0 16px' }} onClick={() => guardar(num(valor))}>Guardar</button>
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

  const comprar = () =>
    ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { ...campos(), estado: 'comprado', compradoEn: fechaCompra, precioComprado: num(precioPagado) }), 'Marcado como comprado')

  const guardarCompra = () =>
    ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { compradoEn: fechaCompra, precioComprado: num(precioPagado) }), 'Compra actualizada')

  const regresarAFila = () =>
    ejecutar(() => updateUserDoc(user.uid, 'whimms', whimm.id, { estado: 'espera', compradoEn: null, precioComprado: null }), 'Regresó a la fila')

  const apartar = () => {
    const monto = Math.min(num(extra), faltante)
    if (!(monto > 0)) return
    return ejecutar(
      () => updateUserDoc(user.uid, 'whimms', whimm.id, { montoApartado: (Number(whimm.montoApartado) || 0) + monto, estado: 'apartando' }),
      `Apartaste ${fmt(monto)}`
    )
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
    }, 'MSI cancelado, regresó a la fila')

  const eliminar = () =>
    ejecutar(async () => {
      if (whimm.pagoFijoMsiId) await deleteUserDoc(user.uid, 'pagosFijos', whimm.pagoFijoMsiId)
      await deleteUserDoc(user.uid, 'whimms', whimm.id)
    }, 'Whimm eliminado')

  const puedeGuardar = name.trim() && num(precio) > 0

  // --- Comprado: solo precio/fecha reales ---
  if (estado === 'comprado') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{whimm.name}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Campo label="Precio pagado"><input className="fld" type="number" inputMode="decimal" value={precioPagado} onChange={(e) => setPrecioPagado(e.target.value)} /></Campo></div>
          <div style={{ flex: 1 }}><Campo label="Fecha de compra"><input className="fld" type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} /></Campo></div>
        </div>
        <button className="btn-primary" onClick={guardarCompra}>Guardar cambios</button>
        <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={regresarAFila}>Regresar a la fila</button>
        <button style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmarEliminar ? eliminar() : setConfirmarEliminar(true))}>{confirmarEliminar ? 'Toca de nuevo para eliminar' : 'Eliminar'}</button>
      </div>
    )
  }

  // --- Pagando (MSI): detalle del plan ---
  if (estado === 'pagando') {
    const pago = datos.pagosFijos.find((p) => p.id === whimm.pagoFijoMsiId)
    const prog = pago ? progresoPagoFijo(pago, hoy) : null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{whimm.name}</div>
        {pago ? (
          <Aviso tono="green">
            {fmt(pago.monto)} al mes · pago {Math.min(prog.pagados + (prog.siguiente ? 1 : 0), prog.total)} de {prog.total}
            {prog.siguiente ? ` · siguiente ${fechaCorta(prog.siguiente)}` : ' · liquidado'}
          </Aviso>
        ) : (
          <Aviso tono="red">No encuentro el pago a meses ligado a este Whimm.</Aviso>
        )}
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>La mensualidad sale de tu dinero libre para Whimms, nunca de tu presupuesto semanal ni de tus Vitalls. Para cambiar fechas o montos usa Vitalls.</div>
        <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={cancelarMSI}>Cancelar los meses y regresar a la fila</button>
        <button style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmarEliminar ? eliminar() : setConfirmarEliminar(true))}>{confirmarEliminar ? 'Toca de nuevo para eliminar (borra también el pago)' : 'Eliminar'}</button>
      </div>
    )
  }

  // --- Nuevo / en fila ---
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
      <Campo label="Necesidad (1 = capricho, 5 = indispensable)"><Nivel valor={necesidad} onChange={setNecesidad} /></Campo>
      <Campo label="Deseo (1 = poco, 5 = muchísimo)"><Nivel valor={deseo} onChange={setDeseo} /></Campo>
      <Campo label="Fecha límite (opcional)" nota="Si la pones, sube su prioridad al acercarse. Sin fecha no se penaliza; solo es menos urgente.">
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="fld" type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
          {fechaLimite && <button className="pill" style={{ background: 'var(--beige2)' }} onClick={() => setFechaLimite('')}>Quitar</button>}
        </div>
      </Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Lugar"><input className="fld" value={lugar} onChange={(e) => setLugar(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}><Campo label="Link"><input className="fld" value={link} onChange={(e) => setLink(e.target.value)} /></Campo></div>
      </div>
      <Campo label="URL de imagen"><input className="fld" value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} /></Campo>

      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45 }} disabled={!puedeGuardar} onClick={guardar}>{nuevo ? 'Agregar a la fila' : 'Guardar cambios'}</button>

      {!nuevo && (
        <div style={{ borderTop: '1px solid var(--beige3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['comprar', 'Ya lo compré'], ['apartar', 'Apartar fondos'], ['msi', 'Pagar a meses']].map(([k, t]) => (
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
              <Campo label="Monto a apartar" nota={`Aún faltan ${fmt(faltante)}. Es dinero reservado para este Whimm; el resto de la fila ya no cuenta con él.`}>
                <input className="fld" type="number" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
              </Campo>
              <button className="btn-primary" onClick={apartar}>Apartar</button>
            </>
          )}
          {accion === 'msi' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><Campo label="Meses"><input className="fld" type="number" inputMode="numeric" value={numPagos} onChange={(e) => setNumPagos(e.target.value)} /></Campo></div>
                <div style={{ flex: 1 }}><Campo label="Primer pago"><input className="fld" type="date" value={primerPago} onChange={(e) => setPrimerPago(e.target.value)} /></Campo></div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmt(num(precio) / Math.max(Math.round(num(numPagos)), 2))} al mes. Sale de tu dinero libre para Whimms.</div>
              <button className="btn-primary" onClick={pagarAMeses}>Pasar a pagos a meses</button>
            </>
          )}
          <button style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmarEliminar ? eliminar() : setConfirmarEliminar(true))}>{confirmarEliminar ? 'Toca de nuevo para eliminar' : 'Eliminar Whimm'}</button>
        </div>
      )}
    </div>
  )
}

function FilaWhimm({ w, proy, posicion, onClick }) {
  const est = proy ? ESTATUS[proy.estatus] : null
  return (
    <button className="row-list-item" style={{ textAlign: 'left', width: '100%', alignItems: 'flex-start' }} onClick={onClick}>
      <div className="mono" style={{ width: 22, fontSize: 12, color: 'var(--muted)', paddingTop: 2 }}>{posicion}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
          {[w.categoria, `N${normalizarNivel(w.necesidad)} · D${normalizarNivel(w.deseo)}`].filter(Boolean).join(' · ')}
          {w.fechaLimite ? ` · límite ${fechaCorta(w.fechaLimite)}` : ''}
        </div>
        {proy && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            {est && <span className="pill" style={{ background: est.bg, color: est.color, padding: '3px 9px', fontSize: 10 }}>{est.texto}</span>}
            {proy.intercambiado && <span className="pill" style={{ background: 'var(--beige2)', color: 'var(--amber)', padding: '3px 9px', fontSize: 10 }}>Espera al lunes</span>}
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {proy.fechaProyectada ? (proy.estatus === 'comprable_hoy' ? 'Hoy' : fechaCorta(proy.fechaProyectada)) : 'sin fecha segura'}
            </span>
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(w.precio)}</div>
    </button>
  )
}

export default function Whimms() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [tab, setTab] = useState('fila')
  const [sheet, setSheet] = useState(null) // null | { whimm? }

  const base = useMemo(() => (loading ? null : parametrosMotor(datos, hoy)), [datos, loading, hoy])
  const cola = useMemo(() => (base ? proyectarColaWhimms(base) : []), [base])
  const porId = useMemo(() => new Map(datos.whimms.map((w) => [w.id, w])), [datos.whimms])

  const enFila = cola.map((r) => ({ r, w: porId.get(r.id) })).filter((x) => x.w)
  const pagando = datos.whimms.filter((w) => w.estado === 'pagando')
  const comprados = datos.whimms.filter((w) => w.estado === 'comprado').sort((a, b) => (b.compradoEn || '').localeCompare(a.compradoEn || ''))

  const tabs = [['fila', `En fila (${enFila.length})`], ['pagando', `Pagando (${pagando.length})`], ['comprados', `Comprados (${comprados.length})`]]

  return (
    <>
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow">Whital</div>
          <h1>Whimms</h1>
        </div>
        {error && <Aviso tono="red">{error}</Aviso>}
        {!base && !error && <div className="empty-state">Cargando…</div>}
        {base && (
          <>
            <PresupuestoSemanal datos={datos} base={base} user={user} show={show} />
            <div style={{ display: 'flex', gap: 8 }}>
              {tabs.map(([k, t]) => (
                <button key={k} className="segbtn" style={{ fontSize: 11, background: tab === k ? 'var(--wine)' : 'var(--beige2)', color: tab === k ? '#fff' : 'var(--muted)' }} onClick={() => setTab(k)}>{t}</button>
              ))}
            </div>

            {tab === 'fila' && (enFila.length === 0
              ? <div className="empty-state">Tu fila está vacía. Agrega un Whimm con el botón +.</div>
              : <div className="row-list">{enFila.map(({ r, w }, i) => <FilaWhimm key={w.id} w={w} proy={r} posicion={i + 1} onClick={() => setSheet({ whimm: w })} />)}</div>)}

            {tab === 'pagando' && (pagando.length === 0
              ? <div className="empty-state">Nada a meses por ahora. Desde un Whimm de la fila puedes elegir "Pagar a meses".</div>
              : <div className="row-list">
                  {pagando.map((w) => {
                    const pago = datos.pagosFijos.find((p) => p.id === w.pagoFijoMsiId)
                    const prog = pago ? progresoPagoFijo(pago, hoy) : null
                    return (
                      <button key={w.id} className="row-list-item" style={{ textAlign: 'left', width: '100%' }} onClick={() => setSheet({ whimm: w })}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {prog ? `${prog.pagados} de ${prog.total} pagos${prog.siguiente ? ` · siguiente ${fechaCorta(prog.siguiente)}` : ''}` : 'sin plan ligado'}
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{pago ? `${fmt(pago.monto)}/mes` : fmt(w.precio)}</div>
                      </button>
                    )
                  })}
                </div>)}

            {tab === 'comprados' && (comprados.length === 0
              ? <div className="empty-state">Aún no marcas ningún Whimm como comprado.</div>
              : <div className="row-list">
                  {comprados.map((w) => (
                    <button key={w.id} className="row-list-item" style={{ textAlign: 'left', width: '100%' }} onClick={() => setSheet({ whimm: w })}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{w.compradoEn ? fechaCorta(w.compradoEn) : 'sin fecha'} · {w.categoria}</div>
                      </div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(w.precioComprado ?? w.precio)}</div>
                    </button>
                  ))}
                </div>)}
          </>
        )}
      </div>

      <button className="fab" onClick={() => setSheet({})} aria-label="Agregar Whimm"><IconPlus /></button>
      <Sheet abierto={!!sheet} onClose={() => setSheet(null)} titulo={sheet?.whimm ? (sheet.whimm.estado === 'comprado' ? 'Compra' : sheet.whimm.estado === 'pagando' ? 'Pagando a meses' : 'Whimm') : 'Nuevo Whimm'}>
        {sheet && base && <WhimmForm key={sheet.whimm?.id || 'nuevo'} whimm={sheet.whimm} datos={datos} base={base} user={user} show={show} onCerrar={() => setSheet(null)} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
