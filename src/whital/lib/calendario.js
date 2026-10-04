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

// Casillas del mes en cuadrícula Dom-Sáb: null para los huecos iniciales.
export function casillasDelMes(anio, mes) {
  const { inicio, fin } = rangoDelMes(anio, mes)
  const huecos = new Date(anio, mes, 1).getDay() // la cuadrícula empieza en domingo, como la app original
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

// Lista de próximos eventos (a partir de mañana) para la lista bajo el calendario.
// cat: 'nomina' (sueldos) | 'servicio' (pagos fijos y Vitalls) | 'compra' (Whimm proyectado).
export function proximosEventos({ datos, cola, hoyISO, dias = 365 }) {
  const desde = addDaysISO(hoyISO, 1)
  const hasta = addDaysISO(hoyISO, dias)
  const out = []
  ;(datos.sueldosFijos || []).forEach((s) => {
    ocurrenciasSueldo(s, hasta, desde).filter((o) => !o.omitida).forEach((o) => out.push({ id: `sf-${s.id}-${o.fecha}`, cat: 'nomina', titulo: `${s.name || s.nombre || 'Sueldo'} depositado`, fecha: o.fecha, monto: o.monto }))
  })
  ;(datos.sueldosRapidos || []).forEach((r) => {
    if (r.fecha && r.fecha >= desde && r.fecha <= hasta) out.push({ id: `sr-${r.id}`, cat: 'nomina', titulo: `${r.desc || 'Ingreso'} depositado`, fecha: r.fecha, monto: Number(r.monto) || 0 })
  })
  ;(datos.pagosFijos || []).forEach((p) => {
    ocurrenciasPagoFijo(p, hasta, desde).filter((o) => !o.omitida).forEach((o) => out.push({ id: `pf-${p.id}-${o.fecha}`, cat: 'servicio', tipo: p.tipo, titulo: `Vencimiento — ${p.name}`, fecha: o.fecha, monto: -o.monto }))
  })
  const nombres = new Map((datos.whimms || []).map((w) => [w.id, w]))
  ;(cola || []).forEach((r) => {
    if (r.fechaProyectada && r.fechaProyectada >= desde && r.fechaProyectada <= hasta) {
      out.push({ id: `w-${r.id}`, cat: 'compra', titulo: `${nombres.get(r.id)?.name || 'Whimm'} — estimado disponible`, fecha: r.fechaProyectada, monto: -(Number(nombres.get(r.id)?.precio) || 0) })
    }
  })
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
}
