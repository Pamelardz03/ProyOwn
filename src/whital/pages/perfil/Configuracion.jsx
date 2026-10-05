import { useMemo, useState } from 'react'
import Toast from '../../../components/Toast'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/AuthContext'
import { deleteUserDoc, setUserDoc } from '../../../lib/firestoreCollections'
import DetalleEliminable from '../../components/DetalleEliminable'
import EncabezadoSub from '../../components/EncabezadoSub'
import { useWhitalDatos } from '../../hooks/useWhitalDatos'
import { todayISO } from '../../lib/budget'
import { fechaCorta, fmt, parametrosMotor } from '../../lib/vista'
import { DatosDePrueba, LineaEditable } from './piezas'

export default function Configuracion() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [editando, setEditando] = useState(null) // 'saldo' | 'presupuesto'
  const [ajusteAbierto, setAjusteAbierto] = useState(null)

  const base = useMemo(() => (loading ? null : parametrosMotor(datos, hoy)), [datos, loading, hoy])
  const ajustes = useMemo(() => [...datos.ajustesSaldo].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')), [datos.ajustesSaldo])

  const guardarConfig = async (campos, mensaje) => {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', campos)
      show(mensaje)
      setEditando(null)
    } catch {
      show('No se pudo guardar')
    }
  }

  const borrarAjuste = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'ajustesSaldo', id)
      show('Ajuste eliminado')
      setAjusteAbierto(null)
    } catch {
      show('No se pudo eliminar')
    }
  }

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <EncabezadoSub titulo="Configuración" />
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          {loading && !error && <div className="empty-state">Cargando…</div>}
          {base && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <LineaEditable key={`saldo-${editando === 'saldo'}`} etiqueta="Saldo inicial" valorActual={Number(datos.config?.saldoInicial) || 0} editando={editando === 'saldo'} onAbrir={() => setEditando('saldo')} onCerrar={() => setEditando(null)} onGuardar={(n) => guardarConfig({ saldoInicial: n }, 'Saldo inicial guardado')} />
                <LineaEditable key={`pres-${editando === 'presupuesto'}`} etiqueta="Presupuesto semanal" valorActual={base.presupuestoSemanal} editando={editando === 'presupuesto'} onAbrir={() => setEditando('presupuesto')} onCerrar={() => setEditando(null)} onGuardar={(n) => (n > 0 ? guardarConfig({ presupuestoSemanal: n }, 'Presupuesto guardado') : show('Debe ser mayor a 0'))} />
              </div>

              {ajustes.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Ajustes de saldo a mi banco</div>
                  <div className="row-list">
                    {ajustes.map((a) => (
                      <div key={a.id} className="row-list-item" onClick={() => setAjusteAbierto(a)} style={{ cursor: 'pointer' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{fechaCorta(a.fecha)}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{a.saldoBanco != null ? `banco ${fmt(a.saldoBanco)}` : 'Ajuste'}</div>
                        </div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: a.monto < 0 ? 'var(--red)' : 'var(--green)' }}>{a.monto > 0 ? '+' : ''}{fmt(a.monto)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DatosDePrueba datos={datos} user={user} show={show} />
            </>
          )}
        </div>
      </div>

      {ajusteAbierto && (
        <DetalleEliminable
          titulo="Ajuste a mi banco"
          sub={`${fechaCorta(ajusteAbierto.fecha)}${ajusteAbierto.saldoBanco != null ? ` · banco ${fmt(ajusteAbierto.saldoBanco)}` : ''}`}
          monto={ajusteAbierto.monto}
          mensaje="¿Eliminar este ajuste de saldo? El saldo se vuelve a calcular sin él."
          onEliminar={() => borrarAjuste(ajusteAbierto.id)}
          onCerrar={() => setAjusteAbierto(null)}
        />
      )}
      <Toast message={message} />
    </>
  )
}
