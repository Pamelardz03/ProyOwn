import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Toast from '../../../components/Toast'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/AuthContext'
import { deleteUserDoc } from '../../../lib/firestoreCollections'
import DetalleEliminable from '../../components/DetalleEliminable'
import EncabezadoSub from '../../components/EncabezadoSub'
import FilaDeslizable from '../../components/FilaDeslizable'
import Sheet from '../../components/Sheet'
import { useWhitalDatos } from '../../hooks/useWhitalDatos'
import { addDaysISO, ocurrenciasSueldo, todayISO } from '../../lib/budget'
import { marcarCobro } from '../../lib/cobros'
import { enDias, fechaCorta, fmt } from '../../lib/vista'
import { IngresoRapidoForm, SueldoForm } from './piezas'

export default function Sueldos() {
  const { user } = useAuth()
  const location = useLocation()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [manual, setManual] = useState(() => (location.state?.nuevo === 'sueldo' ? {} : null)) // null | {} | { sueldo }
  const [pendienteId, setPendienteId] = useState(location.state?.openSueldoId || null)
  const [rapidoAbierto, setRapidoAbierto] = useState(() => location.state?.nuevo === 'rapido')
  const [rapidoDetalle, setRapidoDetalle] = useState(null)

  // Sueldo que llegó por navegación (lápiz de Calendario o Historial): se abre su edición.
  const enlazado = !manual && pendienteId ? datos.sueldosFijos.find((s) => s.id === pendienteId) : null
  const hoja = manual || (enlazado ? { sueldo: enlazado } : null)
  const cerrar = () => { setManual(null); setPendienteId(null) }

  const proximoCobro = (s) => ocurrenciasSueldo(s, `${new Date().getFullYear() + 3}-12-31`, hoy).find((o) => !o.omitida && o.fecha >= hoy)?.fecha
  const rapidos = useMemo(() => [...datos.sueldosRapidos].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 15), [datos.sueldosRapidos])

  // Cobro que se puede marcar: uno pendiente (esperando el depósito) o el de hoy.
  const cobroMarcable = (s) => {
    const cercanos = ocurrenciasSueldo(s, hoy, addDaysISO(hoy, -14))
    return cercanos.filter((o) => o.pendiente).pop() || cercanos.find((o) => o.fecha === hoy && !o.omitida) || null
  }
  const marcar = async (s, o) => {
    try {
      await marcarCobro(user.uid, s, o.fecha, o.pendiente)
      show(o.pendiente ? 'Sueldo sumado a tu saldo' : 'Se sumará cuando llegue')
    } catch {
      show('No se pudo actualizar')
    }
  }

  const borrarSueldo = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'sueldosFijos', id)
      show('Sueldo eliminado')
    } catch {
      show('No se pudo eliminar')
    }
  }

  const borrarRapido = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'sueldosRapidos', id)
      show('Ingreso eliminado')
      setRapidoDetalle(null)
    } catch {
      show('No se pudo eliminar')
    }
  }

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <EncabezadoSub titulo="Sueldos" />
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          {loading && !error && <div className="empty-state">Cargando…</div>}
          {!loading && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff' }} onClick={() => setManual({})}>+ Sueldo fijo</button>
                <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => setRapidoAbierto(true)}>+ Ingreso rápido</button>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Sueldos fijos</div>
                {datos.sueldosFijos.length === 0 ? (
                  <div className="empty-state">Sin sueldos fijos</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {datos.sueldosFijos.map((s) => (
                      <FilaDeslizable key={s.id} radio={16} titulo={`Eliminar ${s.name || s.nombre}`} mensaje="¿Eliminar este sueldo? También se pierde su historial de cobros." onEliminar={() => borrarSueldo(s.id)} onTap={() => setManual({ sueldo: s })}>
                        <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', opacity: s.fechaFin ? 0.55 : 1 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name || s.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                              {s.frecuencia}{s.fechaFin ? ` · detenido ${fechaCorta(s.fechaFin)}` : cobroMarcable(s)?.pendiente ? ` · esperando el depósito del ${fechaCorta(cobroMarcable(s).fecha)}` : proximoCobro(s) ? ` · próximo ${fechaCorta(proximoCobro(s))} · ${enDias(proximoCobro(s), hoy)}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>+{fmt(s.monto)}</div>
                            {cobroMarcable(s) && (
                              <span onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                                <button className="pill" style={{ background: 'var(--beige2)', color: 'var(--acento)', padding: '5px 10px', fontSize: 11 }} onClick={() => marcar(s, cobroMarcable(s))}>{cobroMarcable(s).pendiente ? 'Ya llegó' : 'Aún no llega'}</button>
                              </span>
                            )}
                          </div>
                        </div>
                      </FilaDeslizable>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Ingresos rápidos</div>
                {rapidos.length === 0 ? (
                  <div className="empty-state">Sin ingresos rápidos</div>
                ) : (
                  <div className="row-list">
                    {rapidos.map((r) => (
                      <FilaDeslizable key={r.id} titulo={`Eliminar ${r.desc || 'ingreso'}`} mensaje="¿Eliminar este ingreso? No se puede deshacer." onEliminar={() => borrarRapido(r.id)} onTap={() => setRapidoDetalle(r)}>
                        <div className="row-list-item" style={{ cursor: 'pointer' }}>
                          <div style={{ flex: 1, fontSize: 13 }}>{r.desc || 'Ingreso'}</div>
                          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{fechaCorta(r.fecha)}</span>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>+{fmt(r.monto)}</span>
                        </div>
                      </FilaDeslizable>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet abierto={!!hoja} onClose={cerrar} titulo={hoja?.sueldo ? hoja.sueldo.name || 'Sueldo' : 'Nuevo sueldo fijo'}>
        {hoja && <SueldoForm key={hoja.sueldo?.id || 'nuevo'} sueldo={hoja.sueldo} hoy={hoy} user={user} show={show} onCerrar={cerrar} />}
      </Sheet>
      <Sheet abierto={rapidoAbierto} onClose={() => setRapidoAbierto(false)} titulo="Ingreso rápido">
        {rapidoAbierto && <IngresoRapidoForm hoy={hoy} user={user} show={show} onCerrar={() => setRapidoAbierto(false)} />}
      </Sheet>
      {rapidoDetalle && (
        <DetalleEliminable titulo={rapidoDetalle.desc || 'Ingreso'} sub={fechaCorta(rapidoDetalle.fecha)} monto={Number(rapidoDetalle.monto) || 0} mensaje="¿Eliminar este ingreso? No se puede deshacer." onEliminar={() => borrarRapido(rapidoDetalle.id)} onCerrar={() => setRapidoDetalle(null)} />
      )}
      <Toast message={message} />
    </>
  )
}
