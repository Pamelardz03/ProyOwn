import { useMemo, useState } from 'react'
import Toast from '../../components/Toast'
import Toggle from '../../components/Toggle'
import { IconPlus } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import Campo, { Aviso } from '../components/Campo'
import Sheet from '../components/Sheet'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { addDaysISO, computeBolsas, evaluarIntercambio, gastoNeto, startOfWeekISO, todayISO } from '../lib/budget'
import { fechaCorta, fmt, parametrosMotor } from '../lib/vista'

const num = (v) => (v === '' || v == null ? 0 : Number(v))
const etiquetaDe = (g) => g.etiqueta || g.categoriaWhimm || ''

// Formulario de alta/edición. En alta, antes de guardar simula el gasto con el
// motor y avisa si desplaza algo (o rompe una fecha límite).
function GastoForm({ inicial, datos, hoy, onGuardar, onEliminar, onCerrar }) {
  const editando = !!inicial?.id
  const [modo, setModo] = useState('gasto') // 'gasto' | 'whimm'
  const [concepto, setConcepto] = useState(inicial?.concepto || '')
  const [monto, setMonto] = useState(inicial?.monto != null ? String(inicial.monto) : '')
  const [lugar, setLugar] = useState(inicial?.lugar || '')
  const [etiqueta, setEtiqueta] = useState(inicial ? etiquetaDe(inicial) : '')
  const [fecha, setFecha] = useState(inicial?.fecha || hoy)
  const [compartido, setCompartido] = useState(Number(inicial?.reembolso) > 0)
  const [reembolso, setReembolso] = useState(Number(inicial?.reembolso) > 0 ? String(inicial.reembolso) : '')
  const [whimmId, setWhimmId] = useState('')
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)

  const pendientes = datos.whimms.filter((w) => w.estado === 'espera' || w.estado === 'apartando')
  const etiquetas = useMemo(() => [...new Set(datos.gastos.map(etiquetaDe).filter(Boolean))], [datos.gastos])

  const montoNum = num(monto)
  const reembolsoNum = compartido ? num(reembolso) : 0

  // Simulación del intercambio (solo gastos nuevos de la semana).
  const evaluacion = useMemo(() => {
    if (editando || modo !== 'gasto' || montoNum <= 0 || !fecha) return null
    return evaluarIntercambio({
      ...parametrosMotor(datos, hoy),
      gastoNuevo: { concepto: concepto || 'Gasto', monto: montoNum, reembolso: reembolsoNum, fecha, categoria: 'General' },
    })
  }, [editando, modo, montoNum, reembolsoNum, fecha, concepto, datos, hoy])

  const nombreDe = (w) => w.name || 'Whimm'
  const elegirWhimm = (id) => {
    setWhimmId(id)
    const w = pendientes.find((x) => x.id === id)
    if (w) {
      setMonto(String(w.precio || ''))
      if (!concepto) setConcepto(nombreDe(w))
    }
  }

  const puedeGuardar = montoNum > 0 && !!fecha && (modo === 'gasto' || !!whimmId)
  const conAdvertencia = evaluacion && !evaluacion.puedeIntercambiar

  const guardar = () => {
    if (!puedeGuardar) return
    if (modo === 'whimm') {
      onGuardar({ tipo: 'whimm', whimmId, monto: montoNum, fecha })
    } else {
      onGuardar({
        tipo: 'gasto',
        id: inicial?.id,
        datos: { concepto: concepto.trim() || 'Gasto', monto: montoNum, lugar: lugar.trim(), etiqueta: etiqueta.trim(), fecha, reembolso: reembolsoNum, categoria: inicial?.categoria || 'General' },
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!editando && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="segbtn" style={{ background: modo === 'gasto' ? 'var(--wine)' : 'var(--beige2)', color: modo === 'gasto' ? '#fff' : 'var(--muted)' }} onClick={() => setModo('gasto')}>Gasto de la semana</button>
          <button className="segbtn" style={{ background: modo === 'whimm' ? 'var(--wine)' : 'var(--beige2)', color: modo === 'whimm' ? '#fff' : 'var(--muted)' }} onClick={() => setModo('whimm')}>Compré un Whimm</button>
        </div>
      )}

      {modo === 'whimm' ? (
        <Campo label="¿Cuál Whimm compraste?">
          <select className="fld" value={whimmId} onChange={(e) => elegirWhimm(e.target.value)}>
            <option value="">Elige uno…</option>
            {pendientes.map((w) => <option key={w.id} value={w.id}>{nombreDe(w)} · {fmt(w.precio)}</option>)}
          </select>
        </Campo>
      ) : (
        <>
          <Campo label="Concepto"><input className="fld" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Comida, Uber, café…" /></Campo>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Campo label="Lugar (opcional)"><input className="fld" value={lugar} onChange={(e) => setLugar(e.target.value)} /></Campo></div>
            <div style={{ flex: 1 }}>
              <Campo label="Categoría (opcional)">
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
            <span style={{ fontSize: 13, fontWeight: 500 }}>¿Es gasto compartido?</span>
            <Toggle on={compartido} onClick={() => setCompartido(!compartido)} ariaLabel="Gasto compartido" />
          </div>
          {compartido && (
            <Campo label="Reembolso (lo que te regresan)" nota={montoNum > 0 ? `Gasto neto: ${fmt(Math.max(montoNum - reembolsoNum, 0))}` : undefined}>
              <input className="fld" type="number" inputMode="decimal" value={reembolso} onChange={(e) => setReembolso(e.target.value)} />
            </Campo>
          )}
        </>
      )}

      {evaluacion && (
        <>
          {evaluacion.excedeSemana > 0 && <Aviso tono="amber">Con este gasto te pasarías {fmt(evaluacion.excedeSemana)} del presupuesto de la semana.</Aviso>}
          {evaluacion.criticos.length > 0 && (
            <Aviso tono="red">
              <b>Ojo:</b> no se puede intercambiar sin romper una fecha planificada.{' '}
              {evaluacion.criticos.map((c) => `${c.nombre} llegaría tarde (límite ${fechaCorta(c.fechaLimite)})`).join(', ')}.
            </Aviso>
          )}
          {evaluacion.avisos.length > 0 && <Aviso tono="amber">Se retrasan, pero siguen a tiempo: {evaluacion.avisos.map((a) => `${a.nombre} (${fechaCorta(a.despues)})`).join(', ')}.</Aviso>}
          {evaluacion.intercambiados.length > 0 && <Aviso tono="green">Esperan hasta el lunes a cambio de este gasto: {evaluacion.intercambiados.map((i) => i.nombre).join(', ')}.</Aviso>}
          {evaluacion.desplazados.length > 0 && evaluacion.intercambiados.length === 0 && <Aviso tono="green">Se corren un poco (sin urgencia): {evaluacion.desplazados.map((d) => d.nombre).join(', ')}.</Aviso>}
        </>
      )}

      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45, background: conAdvertencia ? 'var(--red)' : 'var(--wine)' }} onClick={guardar} disabled={!puedeGuardar}>
        {conAdvertencia ? 'Guardar de todos modos' : editando ? 'Guardar cambios' : 'Guardar'}
      </button>
      {editando && (
        confirmarEliminar ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="segbtn" style={{ background: 'var(--beige2)' }} onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
            <button className="segbtn" style={{ background: 'var(--red)', color: '#fff' }} onClick={() => onEliminar(inicial.id)}>Sí, eliminar</button>
          </div>
        ) : (
          <button style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => setConfirmarEliminar(true)}>Eliminar gasto</button>
        )
      )}
      <button style={{ color: 'var(--muted)', fontSize: 12 }} onClick={onCerrar}>Cancelar</button>
    </div>
  )
}

function agruparPorSemana(gastos) {
  const grupos = new Map()
  gastos.forEach((g) => {
    if (!g.fecha) return
    const inicio = startOfWeekISO(g.fecha)
    if (!grupos.has(inicio)) grupos.set(inicio, [])
    grupos.get(inicio).push(g)
  })
  return [...grupos.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([inicio, items]) => ({ inicio, items: items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')) }))
}

export default function Gastos() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [sheet, setSheet] = useState(null) // null | { gasto?: {...} }

  const base = useMemo(() => (loading ? null : parametrosMotor(datos, hoy)), [datos, loading, hoy])
  const bolsas = useMemo(() => (base ? computeBolsas(base) : null), [base])
  const semanas = useMemo(() => agruparPorSemana(datos.gastos), [datos.gastos])

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
      setSheet(null)
    } catch {
      show('No se pudo guardar')
    }
  }

  const eliminar = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'gastos', id)
      show('Gasto eliminado')
      setSheet(null)
    } catch {
      show('No se pudo eliminar')
    }
  }

  return (
    <>
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow">Whital</div>
          <h1>Gastos</h1>
        </div>
        {error && <Aviso tono="red">{error}</Aviso>}
        {!bolsas && !error && <div className="empty-state">Cargando…</div>}

        {bolsas && (
          <>
            <div className="hero">
              <div className="eyebrow" style={{ color: 'rgba(255,255,255,.65)' }}>Disponible esta semana</div>
              <div className="stat-display mono" style={{ fontSize: 36, marginTop: 6 }}>{fmt(bolsas.disponibleSemana)}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>
                {fmt(bolsas.gastadoSemanaActual)} gastados de {fmt(bolsas.presupuestoSemanaActual)} · quedan {bolsas.diasRestantesSemana} días
              </div>
            </div>

            {semanas.length === 0 && <div className="empty-state">Todavía no hay gastos. Agrega el primero con el botón +.</div>}
            {semanas.map(({ inicio, items }) => {
              const total = items.filter((g) => g.categoria !== 'Vitall').reduce((s, g) => s + gastoNeto(g), 0)
              const esActual = inicio === bolsas.semanaInicio
              return (
                <div key={inicio}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 2px 8px' }}>
                    <span className="eyebrow">{fechaCorta(inicio)} – {fechaCorta(addDaysISO(inicio, 6))}{esActual ? ' · esta semana' : ''}</span>
                    <span className="mono" style={{ fontSize: 11, color: total > bolsas.presupuestoSemanaActual ? 'var(--red)' : 'var(--muted)' }}>
                      {fmt(total)} / {fmt(bolsas.presupuestoSemanaActual)}
                    </span>
                  </div>
                  <div className="row-list">
                    {items.map((g) => (
                      <button key={g.id} className="row-list-item" style={{ textAlign: 'left', width: '100%', opacity: g.categoria === 'Vitall' ? 0.55 : 1 }} onClick={() => setSheet({ gasto: g })}>
                        <div style={{ width: 42 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{fechaCorta(g.fecha)}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.concepto}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {[etiquetaDe(g), g.lugar].filter(Boolean).join(' · ')}
                            {Number(g.reembolso) > 0 ? ` · reembolso ${fmt(g.reembolso)}` : ''}
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(gastoNeto(g))}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      <button className="fab" onClick={() => setSheet({})} aria-label="Agregar gasto"><IconPlus /></button>
      <Sheet abierto={!!sheet} onClose={() => setSheet(null)} titulo={sheet?.gasto ? 'Editar gasto' : 'Nuevo gasto'}>
        {sheet && base && (
          <GastoForm key={sheet.gasto?.id || 'nuevo'} inicial={sheet.gasto} datos={datos} hoy={hoy} onGuardar={guardar} onEliminar={eliminar} onCerrar={() => setSheet(null)} />
        )}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
