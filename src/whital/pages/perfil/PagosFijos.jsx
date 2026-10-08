import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronRight } from '../../../components/Icons'
import EncabezadoSub from '../../components/EncabezadoSub'
import { useWhitalDatos } from '../../hooks/useWhitalDatos'
import { progresoPagoFijo, todayISO } from '../../lib/budget'
import { calcularMetricas } from '../../lib/metricas'
import { enDias, fechaCorta, fmt, parametrosMotor } from '../../lib/vista'

// Todos los pagos recurrentes (suscripciones, a plazos y a meses) con su peso en un mes.
export default function PagosFijos() {
  const navigate = useNavigate()
  const { datos, loading, error } = useWhitalDatos()
  const hoy = todayISO()
  const metricas = useMemo(() => (loading ? null : calcularMetricas(datos, hoy, parametrosMotor(datos, hoy).presupuestoSemanal)), [datos, loading, hoy])
  const abrir = (id) => navigate('/vitalls', { state: { openPagoId: id } })

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <EncabezadoSub titulo="Pagos fijos" />
        {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
        {loading && !error && <div className="empty-state">Cargando…</div>}
        {metricas && (
          <>
            <div data-guia="fijo-total" className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Total fijo mensual</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{fmt(metricas.totalFijoMensual)}</div>
            </div>
            <div data-guia="fijo-lista">
            {metricas.pagosFijosVigentes.length === 0 ? (
              <div className="empty-state">Sin pagos fijos</div>
            ) : (
              <div className="row-list">
                {metricas.pagosFijosVigentes.map((p) => (
                  <div key={p.id} className="row-list-item" onClick={() => abrir(p.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{p.frecuencia}{p.tipo && p.tipo !== 'Vitall' ? ` · ${p.tipo === 'MSI' ? 'a meses' : p.tipo}` : ''}{(() => { const sig = progresoPagoFijo(p, hoy).siguiente; return sig ? ` · ${fechaCorta(sig)} · ${enDias(sig, hoy)}` : '' })()}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(p.monto)}</div>
                    <IconChevronRight />
                  </div>
                ))}
              </div>
            )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
