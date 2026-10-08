import { useMemo } from 'react'
import EncabezadoSub from '../../components/EncabezadoSub'
import { useWhitalDatos } from '../../hooks/useWhitalDatos'
import { gastoNeto, todayISO } from '../../lib/budget'
import { calcularMetricas } from '../../lib/metricas'
import { fechaCorta, fmt, parametrosMotor } from '../../lib/vista'

// Más métricas: promedios, cantidades y gastos.
export default function Metricas() {
  const { datos, loading, error } = useWhitalDatos()
  const hoy = todayISO()
  const m = useMemo(() => (loading ? null : calcularMetricas(datos, hoy, parametrosMotor(datos, hoy).presupuestoSemanal)), [datos, loading, hoy])

  const tarjetas = m && [
    ['Promedio diario', fmt(m.promedioDiario), 'últimos 30 días'],
    ['Promedio semanal', fmt(m.promedioSemanal), m.semanasAnalizadas ? `últimas ${m.semanasAnalizadas} semanas` : 'sin semanas cerradas'],
    ['Mayor gasto · mes', m.mayorMes ? `${fechaCorta(m.mayorMes.fecha)} · ${fmt(gastoNeto(m.mayorMes))}` : 'Sin datos', m.mayorMes?.concepto],
    ['Mayor gasto · semana', m.mayorSemana ? `${fechaCorta(m.mayorSemana.fecha)} · ${fmt(gastoNeto(m.mayorSemana))}` : 'Sin datos', m.mayorSemana?.concepto],
    ['Whimms en fila', String(m.enFilaN), m.pagandoN ? `${m.pagandoN} pagando a meses` : null],
    ['Comprados', String(m.compradosN), `${fmt(m.gastadoCompras)} en compras`],
    ['Categoría top', m.categoriaTop || 'Sin datos', 'la más deseada'],
    ['Vitalls activos', String(m.vitallsActivos), null],
    ['Total fijo mensual', fmt(m.totalFijoMensual), 'pagos fijos'],
  ]

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <EncabezadoSub titulo="Métricas" />
        {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
        {loading && !error && <div className="empty-state">Cargando…</div>}
        {tarjetas && (
          <div data-guia="metricas" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {tarjetas.map(([etiqueta, valor, pista]) => (
              <div key={etiqueta} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{etiqueta}</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{valor}</div>
                {pista && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{pista}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
