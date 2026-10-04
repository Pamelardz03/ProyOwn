import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Toast from '../../../components/Toast'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/AuthContext'
import { deleteUserDoc } from '../../../lib/firestoreCollections'
import DetalleEliminable from '../../components/DetalleEliminable'
import EncabezadoSub from '../../components/EncabezadoSub'
import Sheet from '../../components/Sheet'
import { useWhitalDatos } from '../../hooks/useWhitalDatos'
import { ocurrenciasSueldo, todayISO } from '../../lib/budget'
import { fechaCorta, fmt } from '../../lib/vista'
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
                <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--wine)' }} onClick={() => setRapidoAbierto(true)}>+ Ingreso rápido</button>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Sueldos fijos</div>
                {datos.sueldosFijos.length === 0 ? (
                  <div className="empty-state">Sin sueldos fijos</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {datos.sueldosFijos.map((s) => (
                      <div key={s.id} onClick={() => setManual({ sueldo: s })} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', opacity: s.fechaFin ? 0.55 : 1 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name || s.nombre}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {s.frecuencia}{s.fechaFin ? ` · detenido ${fechaCorta(s.fechaFin)}` : proximoCobro(s) ? ` · próximo ${fechaCorta(proximoCobro(s))}` : ''}
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>+{fmt(s.monto)}</div>
                      </div>
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
                      <div key={r.id} onClick={() => setRapidoDetalle(r)} className="row-list-item" style={{ cursor: 'pointer' }}>
                        <div style={{ flex: 1, fontSize: 13 }}>{r.desc || 'Ingreso'}</div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{fechaCorta(r.fecha)}</span>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>+{fmt(r.monto)}</span>
                      </div>
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
