// Métricas principales del Perfil. Función PURA a partir de las colecciones.
import { addDaysISO, analizarPresupuestoSemanal, computeWhimmScore, gastoNeto, startOfWeekISO } from './budget'

const mayorGasto = (lista) => lista.reduce((max, g) => (!max || gastoNeto(g) > gastoNeto(max) ? g : max), null)

export function calcularMetricas(datos, hoyISO, presupuestoSemanal) {
  const gastos = (datos.gastos || []).filter((g) => g.categoria !== 'Vitall' && g.fecha && g.fecha <= hoyISO)
  const total30 = gastos.filter((g) => g.fecha >= addDaysISO(hoyISO, -29)).reduce((s, g) => s + gastoNeto(g), 0)
  const mes = hoyISO.slice(0, 7)
  const semana = startOfWeekISO(hoyISO)

  const whimms = datos.whimms || []
  const comprados = whimms.filter((w) => w.estado === 'comprado')

  // Categoría de Whimm con mayor calificación promedio (la más deseada).
  const porCategoria = {}
  whimms.forEach((w) => {
    if (!w.categoria) return
    const c = (porCategoria[w.categoria] ||= { suma: 0, n: 0 })
    c.suma += computeWhimmScore(w)
    c.n += 1
  })
  let categoriaTop = null
  let mejor = -Infinity
  Object.entries(porCategoria).forEach(([cat, { suma, n }]) => {
    if (suma / n > mejor) {
      mejor = suma / n
      categoriaTop = cat
    }
  })

  const analisis = analizarPresupuestoSemanal({ gastos: datos.gastos, presupuestoSemanal, hoyISO, semanas: 4 })

  return {
    promedioDiario: total30 / 30,
    promedioSemanal: analisis.promedio,
    semanasAnalizadas: analisis.semanasCerradasAnalizadas,
    mayorMes: mayorGasto(gastos.filter((g) => g.fecha.startsWith(mes))),
    mayorSemana: mayorGasto(gastos.filter((g) => g.fecha >= semana)),
    compradosN: comprados.length,
    gastadoCompras: comprados.reduce((s, w) => s + (Number(w.precioComprado ?? w.precio) || 0), 0),
    enFilaN: whimms.filter((w) => w.estado === 'espera' || w.estado === 'apartando').length,
    pagandoN: whimms.filter((w) => w.estado === 'pagando').length,
    categoriaTop,
    vitallsActivos: (datos.pagosFijos || []).filter((p) => p.tipo !== 'MSI' && !p.finito && p.activo !== false).length,
  }
}
