import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Toast from '../../components/Toast'
import { IconChevronLeft, IconClose } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { deleteUserDoc } from '../../lib/firestoreCollections'
import BotonEliminar from '../components/BotonEliminar'
import FilaExcepcion from '../components/FilaExcepcion'
import Modal from '../components/Modal'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { todayISO } from '../lib/budget'
import { FILTROS_HISTORIAL, construirHistorial } from '../lib/historial'
import { fechaCorta, fmt, textoDestino } from '../lib/vista'

const COLOR = { gasto: 'var(--acento)', whimm: 'var(--amber)', vitall: 'var(--wine4)', sueldo: 'var(--green)', ajuste: 'var(--muted)' }
const boton = { flex: 1, borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600, textAlign: 'center' }

// Detalle de un movimiento. Los cobros y pagos que se repiten (sueldos fijos,
// Vitalls) se pueden excluir como dato atípico o corregir solo ese día.
function Detalle({ ev, hoy, user, show, onCerrar }) {
  const navigate = useNavigate()
  const recurrente = !!ev.ocurrencia

  const borrar = async (coleccion, id, mensaje) => {
    try {
      await deleteUserDoc(user.uid, coleccion, id)
      show(mensaje)
      onCerrar()
    } catch {
      show('No se pudo eliminar')
    }
  }

  return (
    <Modal abierto onClose={onCerrar}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{ev.titulo}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fechaCorta(ev.fecha)}</div>
        </div>
        <button aria-label="Cerrar" onClick={onCerrar} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconClose />
        </button>
      </div>

      {recurrente ? (
        <FilaExcepcion coleccion={ev.coleccion} entidad={ev.entidad} ocurrencia={ev.ocurrencia} hoy={hoy} user={user} show={show} />
      ) : (
        <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{ev.monto > 0 ? '+' : ''}{fmt(ev.monto)}</div>
      )}

      {ev.tipo === 'gasto' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{ ...boton, background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => navigate('/gastos', { state: { openGastoId: ev.entidad.id } })}>Editar o eliminar</button>
        </div>
      )}
      {ev.tipo === 'whimm' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{ ...boton, background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => navigate('/whimms', { state: { openWhimmId: ev.entidad.id } })}>Ver Whimm</button>
        </div>
      )}
      {ev.tipo === 'sueldo' && ev.destino && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.4 }}>{textoDestino(ev.destino)}</div>}
      {ev.tipo === 'sueldo' && ev.rapido && (
        <div style={{ marginTop: 16 }}>
          <BotonEliminar mensaje="¿Eliminar este ingreso? No se puede deshacer." onConfirmar={() => borrar('sueldosRapidos', ev.entidad.id, 'Ingreso eliminado')} />
        </div>
      )}
      {ev.tipo === 'ajuste' && (
        <div style={{ marginTop: 16 }}>
          <BotonEliminar mensaje="¿Eliminar este ajuste de saldo? El saldo se vuelve a calcular sin él." onConfirmar={() => borrar('ajustesSaldo', ev.entidad.id, 'Ajuste eliminado')} />
        </div>
      )}
    </Modal>
  )
}

export default function Historial() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [filtro, setFiltro] = useState('todos')
  const [visibles, setVisibles] = useState(30)
  const [abiertoId, setAbiertoId] = useState(null)

  const eventos = useMemo(() => (loading ? [] : construirHistorial({ datos, hoyISO: hoy })), [datos, loading, hoy])
  const filtrados = eventos.filter((e) => filtro === 'todos' || e.tipo === filtro)
  const mostrados = filtrados.slice(0, visibles)
  const abierto = abiertoId ? eventos.find((e) => e.id === abiertoId) : null

  return (
    <>
      <div className="screen" style={{ paddingBottom: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/perfil" aria-label="Volver" className="back-btn"><IconChevronLeft /></Link>
            <h1>Historial</h1>
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          {loading && !error && <div className="empty-state">Cargando…</div>}
          {!loading && (
            <>
              <div className="chiprow">
                {FILTROS_HISTORIAL.map(([k, t]) => (
                  <span key={k} onClick={() => { setFiltro(k); setVisibles(30) }} className="pill" style={{ background: filtro === k ? 'var(--wine)' : 'transparent', color: filtro === k ? '#fff' : 'var(--muted)' }}>{t}</span>
                ))}
              </div>
              <div className="row-list">
                {mostrados.map((e) => (
                  <div key={e.id} onClick={() => setAbiertoId(e.id)} className="row-list-item" style={{ cursor: 'pointer', opacity: e.visual ? 0.55 : 1 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[e.tipo], flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, textDecoration: e.omitida ? 'line-through' : 'none', opacity: e.omitida ? 0.6 : 1 }}>{e.titulo}</div>
                      {e.omitida && <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 1 }}>{e.ocurrencia?.pendiente ? 'Esperando el depósito' : 'Dato atípico'}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{fechaCorta(e.fecha)}</span>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: e.monto > 0 ? 'var(--green)' : 'var(--text)', textDecoration: e.omitida ? 'line-through' : 'none' }}>{e.monto > 0 ? '+' : ''}{fmt(e.monto)}</span>
                  </div>
                ))}
                {mostrados.length === 0 && <div className="empty-state">Sin movimientos</div>}
              </div>
              {filtrados.length > mostrados.length && (
                <button onClick={() => setVisibles((n) => n + 30)} style={{ display: 'block', margin: '0 auto', fontSize: 12, fontWeight: 600, color: 'var(--acento)' }}>Ver más</button>
              )}
            </>
          )}
        </div>
      </div>
      {abierto && <Detalle key={abierto.id} ev={abierto} hoy={hoy} user={user} show={show} onCerrar={() => setAbiertoId(null)} />}
      <Toast message={message} />
    </>
  )
}
