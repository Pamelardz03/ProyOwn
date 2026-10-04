// Eventos del calendario de un mes: función PURA a partir de las colecciones y
// de la proyección del motor. Los ingresos y compromisos incluyen las
// ocurrencias omitidas (marcadas) para poder restaurarlas desde el día.
import { addDaysISO, ocurrenciasPagoFijo, ocurrenciasSueldo, toISO } from './budget'

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function rangoDelMes(anio, mes) {
  const inicio = toISO(new Date(anio, mes, 1))
  const fin = toISO(new Date(anio, mes + 1, 0))
  return { inicio, fin }
}

// Casillas del mes en cuadrícula Lun-Dom: null para los huecos iniciales.
export function casillasDelMes(anio, mes) {
  const { inicio, fin } = rangoDelMes(anio, mes)
  const huecos = (new Date(anio, mes, 1).getDay() + 6) % 7
  const dias = []
  for (let f = inicio; f <= fin; f = addDaysISO(f, 1)) dias.push(f)
  return [...Array(huecos).fill(null), ...dias]
}

export function eventosDelMes({ datos, cola, anio, mes }) {
  const { inicio, fin } = rangoDelMes(anio, mes)
  const porDia = new Map()
  const dia = (fecha) => {
    if (!porDia.has(fecha)) porDia.set(fecha, { ingresos: [], compromisos: [], compras: [] })
    return porDia.get(fecha)
  }

  ;(datos.sueldosFijos || []).forEach((s) => {
    ocurrenciasSueldo(s, fin, inicio).forEach((o) => dia(o.fecha).ingresos.push({ tipo: 'fijo', entidad: s, nombre: s.name || s.nombre || 'Sueldo', ...o }))
  })
  ;(datos.sueldosRapidos || []).forEach((r) => {
    if (r.fecha && r.fecha >= inicio && r.fecha <= fin) dia(r.fecha).ingresos.push({ tipo: 'rapido', entidad: r, nombre: r.desc || 'Ingreso', fecha: r.fecha, monto: Number(r.monto) || 0, omitida: false })
  })
  ;(datos.pagosFijos || []).forEach((p) => {
    ocurrenciasPagoFijo(p, fin, inicio).forEach((o) => dia(o.fecha).compromisos.push({ entidad: p, nombre: p.name, msi: p.tipo === 'MSI', ...o }))
  })

  const nombres = new Map((datos.whimms || []).map((w) => [w.id, w.name || 'Whimm']))
  ;(cola || []).forEach((r) => {
    if (r.fechaProyectada && r.fechaProyectada >= inicio && r.fechaProyectada <= fin) {
      dia(r.fechaProyectada).compras.push({ id: r.id, nombre: nombres.get(r.id), estatus: r.estatus, faltante: r.faltante, fechaLimite: r.fechaLimite })
    }
  })

  const vivas = (lista) => lista.filter((x) => !x.omitida)
  let ingresos = 0
  let compromisos = 0
  porDia.forEach((d) => {
    ingresos += vivas(d.ingresos).reduce((s, x) => s + x.monto, 0)
    compromisos += vivas(d.compromisos).reduce((s, x) => s + x.monto, 0)
  })
  return { porDia, totales: { ingresos, compromisos } }
}
