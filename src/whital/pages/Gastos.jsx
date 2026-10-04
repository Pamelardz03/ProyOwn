import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Toast from '../../components/Toast'
import Toggle from '../../components/Toggle'
import { IconChevronLeft, IconChevronRight, IconEdit, IconPlus, IconReceipt } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import BotonEliminar from '../components/BotonEliminar'
import Campo, { Aviso } from '../components/Campo'
import Sheet from '../components/Sheet'
import TileImagen from '../components/TileImagen'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { computeBolsas, evaluarIntercambio, gastoNeto, todayISO } from '../lib/budget'
import { PERIODOS, PERIODO_LABEL, etiquetaPeriodo, moverPeriodo, rangoPeriodo } from '../lib/periodos'
import { fechaCorta, fmt, parametrosMotor } from '../lib/vista'

const num = (v) => (v === '' || v == null ? 0 : Number(v))
const etiquetaDe = (g) => g.etiqueta || g.categoriaWhimm || 'General'

// Formulario de alta/edición. En alta, antes de guardar simula el gasto con el
// motor y avisa si desplaza algo o rompe una fecha límite.
function GastoForm({ inicial, datos, hoy, onGuardar, onEliminar }) {
  const editando = !!inicial?.id
  const [modo, setModo] = useState('gasto') // 'gasto' | 'whimm'
  const [concepto, setConcepto] = useState(inicial?.concepto || '')
  const [monto, setMonto] = useState(inicial?.monto != null ? String(inicial.monto) : '')
  const [lugar, setLugar] = useState(inicial?.lugar || '')
  const [etiqueta, setEtiqueta] = useState(inicial ? inicial.etiqueta || inicial.categoriaWhimm || '' : '')
  const [fecha, setFecha] = useState(inicial?.fecha || hoy)
  const [compartido, setCompartido] = useState(Number(inicial?.reembolso) > 0)
  const [reembolso, setReembolso] = useState(Number(inicial?.reembolso) > 0 ? String(inicial.reembolso) : '')
  const [whimmId, setWhimmId] = useState('')

  const pendientes = datos.whimms.filter((w) => w.estado === 'espera' || w.estado === 'apartando')
  const etiquetas = useMemo(() => [...new Set(datos.gastos.map((g) => g.etiqueta || g.categoriaWhimm).filter(Boolean))], [datos.gastos])

  const montoNum = num(monto)
  const reembolsoNum = compartido ? num(reembolso) : 0

  const evaluacion = useMemo(() => {
    if (editando || modo !== 'gasto' || montoNum <= 0 || !fecha) return null
    return evaluarIntercambio({
      ...parametrosMotor(datos, hoy),
      gastoNuevo: { concepto: concepto || 'Gasto', monto: montoNum, reembolso: reembolsoNum, fecha, categoria: 'General' },
    })
  }, [editando, modo, montoNum, reembolsoNum, fecha, concepto, datos, hoy])

  const elegirWhimm = (id) => {
    setWhimmId(id)
    const w = pendientes.find((x) => x.id === id)
    if (w) setMonto(String(w.precio || ''))
  }

  const puedeGuardar = montoNum > 0 && !!fecha && (modo === 'gasto' || !!whimmId)
  const conAdvertencia = evaluacion && !evaluacion.puedeIntercambiar

  const guardar = () => {
    if (!puedeGuardar) return
    if (modo === 'whimm') onGuardar({ tipo: 'whimm', whimmId, monto: montoNum, fecha })
    else onGuardar({ tipo: 'gasto', id: inicial?.id, datos: { concepto: concepto.trim() || 'Gasto', monto: montoNum, lugar: lugar.trim(), etiqueta: etiqueta.trim(), fecha, reembolso: reembolsoNum, categoria: inicial?.categoria || 'General' } })
  }

  const chip = (activo) => ({ background: activo ? 'var(--wine)' : 'var(--beige2)', color: activo ? '#fff' : 'var(--muted)' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!editando && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="segbtn" style={chip(modo === 'gasto')} onClick={() => setModo('gasto')}>Gasto</button>
          <button className="segbtn" style={chip(modo === 'whimm')} onClick={() => setModo('whimm')}>Compré un Whimm</button>
        </div>
      )}

      {modo === 'whimm' ? (
        <Campo label="Whimm">
          <select className="fld" value={whimmId} onChange={(e) => elegirWhimm(e.target.value)}>
            <option value="">Elige uno…</option>
            {pendientes.map((w) => <option key={w.id} value={w.id}>{w.name} · {fmt(w.precio)}</option>)}
          </select>
        </Campo>
      ) : (
        <>
          <Campo label="Concepto"><input className="fld" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Campo>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Campo label="Lugar"><input className="fld" value={lugar} onChange={(e) => setLugar(e.target.value)} /></Campo></div>
            <div style={{ flex: 1 }}>
              <Campo label="Categoría">
                <input className="fld" list="etiquetas-gasto" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
                <datalist id="etiquetas-gasto">{etiquetas.map((e) => <option key={e} value={e} />)}</datalist>
              </Campo>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label={modo === 'whimm' ? 'Precio pagado' : 'Monto'}><input className="fld" type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}><Campo label="Fecha"><input className="fld" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo></div>
      </div>

      {modo === 'gasto' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Gasto compartido</span>
            <Toggle on={compartido} onClick={() => setCompartido(!compartido)} ariaLabel="Gasto compartido" />
          </div>
          {compartido && (
            <Campo label={`Reembolso${montoNum > 0 ? ` · neto ${fmt(Math.max(montoNum - reembolsoNum, 0))}` : ''}`}>
              <input className="fld" type="number" inputMode="decimal" value={reembolso} onChange={(e) => setReembolso(e.target.value)} />
            </Campo>
          )}
        </>
      )}

      {evaluacion && (
        <>
          {evaluacion.criticos.length > 0 && (
            <Aviso tono="red">{evaluacion.criticos.map((c) => `${c.nombre} llegaría tarde (límite ${fechaCorta(c.fechaLimite)})`).join(' · ')}</Aviso>
          )}
          {evaluacion.excedeSemana > 0 && <Aviso tono="amber">Te pasarías {fmt(evaluacion.excedeSemana)} del presupuesto de la semana.</Aviso>}
          {evaluacion.intercambiados.length > 0 && <Aviso tono="green">Esperan al lunes: {evaluacion.intercambiados.map((i) => i.nombre).join(', ')}.</Aviso>}
        </>
      )}

      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45, background: conAdvertencia ? 'var(--red)' : 'var(--wine)' }} onClick={guardar} disabled={!puedeGuardar}>
        {conAdvertencia ? 'Guardar de todos modos' : editando ? 'Guardar cambios' : 'Guardar'}
      </button>
      {editando && <BotonEliminar mensaje="¿Eliminar este gasto? No se puede deshacer." onConfirmar={() => onEliminar(inicial.id)} />}
    </div>
  )
}

function Tarjeta({ icono, titulo, sub, extra, monto, onEditar, etiquetaEditar }) {
  return (
    <div className="card card-solid" style={{ padding: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
      {icono}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
        {extra && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 1 }}>{extra}</div>}
      </div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>-{fmt(monto)}</div>
      <button aria-label={etiquetaEditar} onClick={onEditar}><IconEdit /></button>
    </div>
  )
}

export default function Gastos() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [periodo, setPeriodo] = useState('semana')
  const [ref, setRef] = useState(hoy)
  // El atajo del launcher ("Agregar gasto") y el aviso de recordatorio abren directo el formulario.
  const [sheet, setSheet] = useState(() => (location.state?.nuevo ? {} : null))
  const [pendienteId, setPendienteId] = useState(location.state?.openGastoId || null)
  const cerrar = () => { setSheet(null); setPendienteId(null) }

  const base = useMemo(() => (loading ? null : parametrosMotor(datos, hoy)), [datos, loading, hoy])
  const bolsas = useMemo(() => (base ? computeBolsas(base) : null), [base])
  const { inicio, fin } = rangoPeriodo(periodo, ref)

  const { lista, totalGastos, totalCompras } = useMemo(() => {
    const dentro = (f) => !!f && f >= inicio && f <= fin
    const gastos = datos.gastos.filter((g) => g.categoria !== 'Vitall' && dentro(g.fecha)).map((g) => ({ tipo: 'gasto', fecha: g.fecha, g }))
    const compras = datos.whimms.filter((w) => w.estado === 'comprado' && dentro(w.compradoEn)).map((w) => ({ tipo: 'whimm', fecha: w.compradoEn, w }))
    return {
      lista: [...gastos, ...compras].sort((a, b) => b.fecha.localeCompare(a.fecha)),
      totalGastos: gastos.reduce((s, x) => s + gastoNeto(x.g), 0),
      totalCompras: compras.reduce((s, x) => s + (Number(x.w.precioComprado ?? x.w.precio) || 0), 0),
    }
  }, [datos.gastos, datos.whimms, inicio, fin])

  const esActual = rangoPeriodo(periodo, hoy).inicio === inicio

  const guardar = async (accion) => {
    try {
      if (accion.tipo === 'whimm') {
        await updateUserDoc(user.uid, 'whimms', accion.whimmId, { estado: 'comprado', compradoEn: accion.fecha, precioComprado: accion.monto })
        show('Whimm marcado como comprado')
      } else if (accion.id) {
        await updateUserDoc(user.uid, 'gastos', accion.id, accion.datos)
        show('Gasto actualizado')
      } else {
        await addUserDoc(user.uid, 'gastos', accion.datos)
        show('Gasto guardado')
      }
      cerrar()
    } catch {
      show('No se pudo guardar')
    }
  }

  const eliminar = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'gastos', id)
      show('Gasto eliminado')
      cerrar()
    } catch {
      show('No se pudo eliminar')
    }
  }

  const semanaActualVisible = periodo === 'semana' && esActual && bolsas
  // Gasto que llegó por navegación (p. ej. desde Historial): se abre su edición.
  const gastoEnlazado = !sheet && pendienteId ? datos.gastos.find((g) => g.id === pendienteId) : null
  const hojaAbierta = !!sheet || !!gastoEnlazado
  const gastoEnHoja = sheet ? sheet.gasto : gastoEnlazado

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1>Gastos</h1>

          <div style={{ display: 'flex', gap: 6, background: 'var(--beige2)', padding: 4, borderRadius: 12 }}>
            {PERIODOS.map((p) => (
              <button key={p} className="segbtn" onClick={() => { setPeriodo(p); setRef(hoy) }} style={{ background: periodo === p ? 'var(--wine)' : 'transparent', color: periodo === p ? '#fff' : 'var(--muted)' }}>
                {PERIODO_LABEL[p]}
              </button>
            ))}
          </div>

          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          {loading && !error && <div className="empty-state">Cargando…</div>}

          {!loading && (
            <>
              <div className="hero" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <button aria-label="Periodo anterior" onClick={() => setRef(moverPeriodo(periodo, ref, -1))} style={{ width: 26, height: 26, borderRadius: 13, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconChevronLeft size={14} color="#fff" />
                  </button>
                  <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500, textAlign: 'center' }}>Gastado en {etiquetaPeriodo(periodo, ref, hoy)}</div>
                  <button aria-label="Periodo siguiente" onClick={() => setRef(moverPeriodo(periodo, ref, 1))} style={{ width: 26, height: 26, borderRadius: 13, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconChevronRight size={14} color="#fff" />
                  </button>
                </div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 500, marginTop: 3, textAlign: 'center' }}>{fmt(totalGastos + totalCompras)}</div>
                {semanaActualVisible && (
                  <div style={{ fontSize: 11, textAlign: 'center', marginTop: 4, color: bolsas.disponibleSemana < 0 ? '#ffb4b4' : 'rgba(255,255,255,.8)' }}>
                    {bolsas.disponibleSemana < 0 ? `Te pasaste ${fmt(-bolsas.disponibleSemana)} del presupuesto` : `Disponible ${fmt(bolsas.disponibleSemana)} de ${fmt(bolsas.presupuestoSemanaActual)}`}
                  </div>
                )}
                {!esActual && (
                  <button onClick={() => setRef(hoy)} style={{ display: 'block', margin: '6px auto 0', fontSize: 10, opacity: 0.8, color: '#fff', textDecoration: 'underline' }}>Volver a hoy</button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <div className="card" style={{ flex: 1, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Gastos</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: 'var(--wine3)' }}>{fmt(totalGastos)}</div>
                </div>
                <div className="card" style={{ flex: 1, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Compras Whimm</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: 'var(--wine4)' }}>{fmt(totalCompras)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lista.map((it) =>
                  it.tipo === 'gasto' ? (
                    <Tarjeta
                      key={`g-${it.g.id}`}
                      icono={<div className="icon-tile" style={{ width: 38, height: 38 }}><IconReceipt size={17} /></div>}
                      titulo={it.g.concepto}
                      sub={`${etiquetaDe(it.g)} · ${fechaCorta(it.fecha)}`}
                      extra={Number(it.g.reembolso) > 0 ? `+${fmt(it.g.reembolso)} reembolso` : null}
                      monto={gastoNeto(it.g)}
                      etiquetaEditar="Editar gasto"
                      onEditar={() => setSheet({ gasto: it.g })}
                    />
                  ) : (
                    <Tarjeta
                      key={`w-${it.w.id}`}
                      icono={<TileImagen url={it.w.imagenUrl} size={38} radius={10} icono={17} />}
                      titulo={`Se compró: ${it.w.name}`}
                      sub={`Whimm · ${it.w.categoria || 'Sin categoría'} · ${fechaCorta(it.fecha)}`}
                      monto={Number(it.w.precioComprado ?? it.w.precio) || 0}
                      etiquetaEditar="Ver en Whimms"
                      onEditar={() => navigate('/whimms', { state: { openWhimmId: it.w.id } })}
                    />
                  )
                )}
                {lista.length === 0 && <div className="empty-state">Sin gastos en este periodo</div>}
              </div>
            </>
          )}
        </div>
      </div>

      <button className="fab" onClick={() => setSheet({})} aria-label="Agregar gasto"><IconPlus /></button>
      <Sheet abierto={hojaAbierta} onClose={cerrar} titulo={gastoEnHoja ? 'Editar gasto' : 'Nuevo gasto'}>
        {hojaAbierta && base && <GastoForm key={gastoEnHoja?.id || 'nuevo'} inicial={gastoEnHoja} datos={datos} hoy={hoy} onGuardar={guardar} onEliminar={eliminar} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
