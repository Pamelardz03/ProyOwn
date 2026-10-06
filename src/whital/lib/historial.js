// Historial completo: todo lo que ya pasó (hasta hoy), en una sola lista.
// Función PURA. Las ocurrencias de sueldos fijos y de pagos fijos/Vitalls
// incluyen las omitidas (marcadas como datos atípicos) para poder restaurarlas.
import { gastoNeto, ocurrenciasPagoFijo, ocurrenciasSueldo, reservaGastos } from './budget'

export const FILTROS_HISTORIAL = [
  ['todos', 'Todos'],
  ['gasto', 'Gastos'],
  ['whimm', 'Whimms'],
  ['vitall', 'Vitalls'],
  ['sueldo', 'Sueldos'],
  ['ajuste', 'Ajustes'],
]

export function construirHistorial({ datos, hoyISO }) {
  const eventos = []
  const { destinos } = reservaGastos({ ...datos, saldoInicial: Number(datos.config?.saldoInicial) || 0, presupuestoSemanal: datos.config?.presupuestoSemanal, hoyISO })

  ;(datos.gastos || []).forEach((g) => {
    if (!g.fecha || g.fecha > hoyISO) return
    eventos.push({ id: `g-${g.id}`, tipo: 'gasto', fecha: g.fecha, titulo: g.concepto || 'Gasto', monto: -gastoNeto(g), entidad: g, visual: g.categoria === 'Vitall' })
  })

  ;(datos.whimms || []).forEach((w) => {
    if (w.estado === 'comprado' && w.compradoEn && w.compradoEn <= hoyISO) {
      eventos.push({ id: `w-${w.id}`, tipo: 'whimm', fecha: w.compradoEn, titulo: `Compraste ${w.name}`, monto: -(Number(w.precioComprado ?? w.precio) || 0), entidad: w })
    }
  })

  ;(datos.sueldosFijos || []).forEach((s) => {
    ocurrenciasSueldo(s, hoyISO).forEach((o) => {
      eventos.push({ id: `sf-${s.id}-${o.fecha}`, tipo: 'sueldo', fecha: o.fecha, titulo: `${s.name || s.nombre || 'Sueldo'} depositado`, monto: o.monto, entidad: s, ocurrencia: o, coleccion: 'sueldosFijos', omitida: o.omitida, destino: o.omitida ? null : destinos[`sf-${s.id}-${o.fecha}`] })
    })
  })

  ;(datos.sueldosRapidos || []).forEach((r) => {
    if (r.fecha && r.fecha <= hoyISO) eventos.push({ id: `sr-${r.id}`, tipo: 'sueldo', fecha: r.fecha, titulo: `${r.desc || 'Ingreso'} depositado`, monto: Number(r.monto) || 0, entidad: r, rapido: true, destino: destinos[r.id] })
  })

  ;(datos.pagosFijos || []).forEach((p) => {
    ocurrenciasPagoFijo(p, hoyISO).forEach((o) => {
      eventos.push({ id: `pf-${p.id}-${o.fecha}`, tipo: 'vitall', fecha: o.fecha, titulo: `${p.tipo === 'MSI' ? 'Pago a meses' : 'Pago'} — ${p.name}`, monto: -o.monto, entidad: p, ocurrencia: o, coleccion: 'pagosFijos', omitida: o.omitida })
    })
  })

  ;(datos.ajustesSaldo || []).forEach((a) => {
    if (a.fecha && a.fecha <= hoyISO) eventos.push({ id: `aj-${a.id}`, tipo: 'ajuste', fecha: a.fecha, titulo: 'Ajuste a mi banco', monto: Number(a.monto) || 0, entidad: a })
  })

  return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.tipo.localeCompare(b.tipo))
}
