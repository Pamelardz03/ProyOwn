import { isThisMonth, todayISO, addDaysISO, extenderFechasPago, compareISOAsc, daysUntil } from './date'

// Un sueldo fijo no tiene fecha de fin por default — 2 años hacia adelante
// es más que suficiente para cualquier vista/paginación real de la app.
const HORIZONTE_DIAS_SUELDO = 730

// Serie de fechas de pago de un sueldo fijo, extendida hacia el futuro
// indefinidamente a partir de lo que ya se calculó/guardó (`fechasPago`, o
// `fecha` como respaldo para sueldos viejos que no tienen ese arreglo) —
// para que el sueldo siga "vivo" aunque ya pasó la ventana que se generó
// al darlo de alta o al validar sus fechas. Si el sueldo se "detuvo" (tiene
// `fechaFin`, ver removeFijo en Sueldos.jsx), no se generan ni se muestran
// fechas después de esa fecha — pero las anteriores siguen contando para
// el historial/ingresos ya ocurridos.
export function fechasPagoVivas(sueldo, hastaISO) {
  const base = Array.isArray(sueldo.fechasPago) && sueldo.fechasPago.length
    ? sueldo.fechasPago
    : sueldo.fecha ? [sueldo.fecha] : []
  if (base.length === 0) return []
  let hasta = hastaISO || addDaysISO(todayISO(), HORIZONTE_DIAS_SUELDO)
  if (sueldo.fechaFin && sueldo.fechaFin < hasta) hasta = sueldo.fechaFin
  const fechas = extenderFechasPago(sueldo.frecuencia, base, hasta)
  return sueldo.fechaFin ? fechas.filter((f) => f <= sueldo.fechaFin) : fechas
}

// La próxima fecha de pago real (hoy o después) de un sueldo fijo —
// reemplaza leer el campo `fecha` guardado en el documento, que se calculó
// una sola vez al dar de alta el sueldo y se queda obsoleto con el tiempo.
export function proximaFechaSueldo(sueldo, hoyISO) {
  const hoy = hoyISO || todayISO()
  const fechas = fechasPagoVivas(sueldo)
  return fechas.find((f) => f >= hoy) || null
}

// --- Ingresos mensuales reales (no mensualizado ciego) ---
// Sueldos fijos sin ninguna fecha guardada (caso extremo, no debería
// pasar) caen al estimado mensualizado como respaldo.
function monthlyEqSueldoLegacy(s) {
  const monto = Number(s.monto) || 0
  if (s.frecuencia === 'Semanal') return monto * 4.33
  if (s.frecuencia === 'Quincenal') return monto * 2.166
  return monto
}

// Cuánto de un sueldo fijo ya se pagó en lo que va del mes actual — cuenta
// cualquier fecha de pago (fechasPagoVivas, incluye la fecha "anterior" que
// se haya declarado como ancla) que ya ocurrió este mes. Antes se excluían
// las fechas previas a `fechaInicio` (la fecha en que se dio de alta el
// sueldo), pero eso descartaba pagos que el usuario declaró explícitamente
// como ya ocurridos (p. ej. "el pago anterior fue el 15"), dando $0 cuando
// el sueldo se agregaba o editaba el mismo día que un pago ya vencido.
export function ingresoDelMesSueldo(s) {
  const hoy = todayISO()
  const fechas = fechasPagoVivas(s)
  if (!fechas.length) return monthlyEqSueldoLegacy(s)
  const ocurridos = fechas.filter((f) => isThisMonth(f) && f <= hoy)
  return ocurridos.length * (Number(s.monto) || 0)
}

export function ingresosFijosDelMes(sueldosFijos) {
  return sueldosFijos.reduce((sum, s) => sum + ingresoDelMesSueldo(s), 0)
}

// Ingreso mensual ESPERADO (promedio estable por frecuencia) — a
// diferencia de `ingresosFijosDelMes` (lo que ya se ha COBRADO en lo que
// va del mes calendario, correcto para "Saldo del mes"/"Ingresos de este
// mes"), esta versión sirve de base para cualquier cálculo que proyecte
// HACIA ADELANTE (presupuesto diario, riesgos de flujo, cola de Whimms):
// SÍ cuenta el ingreso de tus sueldos fijos futuros conocidos (ej. tu
// próxima quincena de Kenet, tu próximo Domingo semanal), no solo lo que
// ya cayó en el banco. Usar "lo ya cobrado este mes" para eso hacía que
// el presupuesto diario se desplomara casi a $0 justo después de que
// empieza un mes nuevo (antes de que caiga el primer pago) y se disparara
// de golpe en cuanto cae un sueldo grande — un vaivén según qué día del
// mes es, no un ingreso promedio real. (21 sep, catorceava/quinceava
// tanda, a partir del reporte de Pame de fechas proyectadas demasiado
// lejanas para Whimms de score bajo, con datos reales donde Kenet — su
// sueldo más grande — apenas se había cobrado una vez este mes al momento
// de revisar.)
export function ingresoMensualEsperado(sueldosFijos, hoyISO) {
  const hoy = hoyISO || todayISO()
  return (sueldosFijos || [])
    .filter((s) => !s.fechaFin || s.fechaFin >= hoy)
    .reduce((sum, s) => sum + monthlyEqSueldoLegacy(s), 0)
}

export function monthlyEqPagoFijo(p) {
  const monto = Number(p.monto) || 0
  return p.frecuencia === 'Semanal' ? monto * 4.33 : monto
}

// --- Reserva real por vencimiento próximo (20 sep, novena tanda) ---
// Reemplaza el promedio fijo por ciclo (monto/30 días sin importar cuándo
// vence de verdad) que había antes: ahora cada pago fijo/Vitall activo
// exige juntar monto/díasRestantes cada día hasta su PRÓXIMO vencimiento
// real, en vez de una reserva constante. Así un pago grande que se acerca
// "pesa" más en el presupuesto diario mientras más cerca está — si debo
// $900 y faltan 4 días, son $225/día esos 4 días, no un promedio parejo
// todo el mes.
export function reservasDiariasPagosFijos(pagosFijos, hoyISO) {
  const hoy = hoyISO || todayISO()
  return (pagosFijos || [])
    .filter((p) => p.activo !== false)
    .map((p) => {
      const vencimiento = proximoVencimientoPagoFijo(p, hoy)
      if (!vencimiento) return null
      const dias = Math.max(daysUntil(vencimiento), 1)
      const monto = Number(p.monto) || 0
      return { pago: p, vencimiento, dias, monto, reservaDiaria: monto / dias }
    })
    .filter(Boolean)
}

export function presupuestoDiarioBruto({ sueldosFijos, sueldosRapidosMes }) {
  const ingresoMensual = ingresoMensualEsperado(sueldosFijos) + (sueldosRapidosMes || 0)
  return ingresoMensual / 30
}

// Presupuesto diario neto "favorable" — bruto menos la reserva diaria REAL
// de cada pago fijo activo (ver reservasDiariasPagosFijos arriba, novena
// tanda) en vez del promedio por ciclo que usaba antes esta misma función.
// Es optimista: no resta gasto futuro (asume que no hay más gastos), tal
// como se pidió para proyectar la cola de Whimms.
export function estimatePresupuestoDiarioNeto({ sueldosFijos, sueldosRapidosMes, pagosFijos }) {
  const bruto = presupuestoDiarioBruto({ sueldosFijos, sueldosRapidosMes })
  const reservaTotal = reservasDiariasPagosFijos(pagosFijos).reduce((s, r) => s + r.reservaDiaria, 0)
  return Math.max(bruto - reservaTotal, 0)
}

// Riesgos reales de flujo (novena tanda): ¿el presupuesto diario bruto
// alcanza para juntar a tiempo TODAS las reservas diarias activas? Se
// ordenan por fecha más próxima primero (el más urgente reserva primero
// del presupuesto disponible); si en algún punto la reserva acumulada ya
// supera el bruto, ese pago (y los que sigan en la fila) quedan en riesgo
// real de no juntarse a tiempo al ritmo actual — no un aviso genérico de
// "hay pagos pronto", sino cuánto exactamente falta por día.
export function detectarRiesgosPagosFijos({ sueldosFijos, sueldosRapidosMes, pagosFijos }) {
  const bruto = presupuestoDiarioBruto({ sueldosFijos, sueldosRapidosMes })
  const ordenados = [...reservasDiariasPagosFijos(pagosFijos)].sort((a, b) => a.dias - b.dias)
  let acumReserva = 0
  const riesgos = []
  ordenados.forEach((r) => {
    acumReserva += r.reservaDiaria
    if (acumReserva > bruto) {
      riesgos.push({
        nombre: r.pago.name,
        monto: r.monto,
        vencimiento: r.vencimiento,
        dias: r.dias,
        reservaDiaria: r.reservaDiaria,
        faltante: Math.round((acumReserva - bruto) * r.dias),
      })
    }
  })
  return riesgos
}

// --- Saldo libre acumulado real (novena tanda) ---
// A diferencia de "Saldo del mes" (que se reinicia cada mes), este es
// histórico: todo lo que se ha recibido (sueldos fijos + rápidos) menos
// todo lo que se ha gastado (Gastos), pagado (vencimientos de pagos
// fijos/Vitall ya ocurridos) y comprado (Whimms marcados "comprado") desde
// que hay datos en la cuenta. Sube los días que no se gasta todo el
// presupuesto, baja los que sí — es la fuente real detrás de las barras de
// progreso de los Whimms.
export function totalIngresosHasta(sueldosFijos, sueldosRapidos, hoyISO) {
  const hoy = hoyISO || todayISO()
  const fijos = (sueldosFijos || []).reduce((sum, s) => sum + fechasPagoVivas(s).filter((f) => f <= hoy).length * (Number(s.monto) || 0), 0)
  const rapidos = (sueldosRapidos || []).reduce((sum, r) => (r.fecha && r.fecha <= hoy ? sum + (Number(r.monto) || 0) : sum), 0)
  return fijos + rapidos
}

// Excluye los Gastos de categoría "Vitall": ese pago ya se cuenta en
// totalVencimientosHasta (por calendario, cuando vence de verdad), así que
// sumarlo también aquí lo restaba DOS VECES del saldo real (bug encontrado
// y corregido 20 sep, onceava tanda). El calendario de vencimientos es la
// fuente única y autoritativa para Vitall/pagos fijos — registrar un Gasto
// de Vitall queda solo como recordatorio/historial visual, no resta de
// nuevo.
export function totalGastosHasta(gastos, hoyISO) {
  const hoy = hoyISO || todayISO()
  return (gastos || []).reduce((sum, g) => {
    if (g.categoria === 'Vitall' && g.vitallId) return sum
    if (!g.fecha || g.fecha > hoy) return sum
    // reembolso (treceava tanda, a pedido de Pame): cuando alguien te
    // regresa parte de un gasto (ej. pagaste la cena completa y tus
    // amigos te regresan su parte), el monto real que salió de tu
    // bolsillo es monto - reembolso, no el monto completo registrado.
    const neto = (Number(g.monto) || 0) - (Number(g.reembolso) || 0)
    return sum + Math.max(neto, 0)
  }, 0)
}

// El monto neto de un Gasto después de descontar cualquier reembolso
// recibido — usado en las pantallas (Gastos, Inicio, Historial) para
// mostrar y sumar lo que de verdad costó, no el monto bruto registrado.
export function gastoNeto(g) {
  return Math.max((Number(g.monto) || 0) - (Number(g.reembolso) || 0), 0)
}

export function totalVencimientosHasta(pagosFijos, hoyISO) {
  const hoy = hoyISO || todayISO()
  return (pagosFijos || [])
    .filter((p) => p.activo !== false)
    .reduce((sum, p) => sum + fechasVencimientoVivas(p).filter((f) => f <= hoy).length * (Number(p.monto) || 0), 0)
}

// Usa el precio REAL de compra (`precioComprado`) cuando existe, en vez del
// precio estimado/listado (`precio`) — los precios varían al momento de
// comprar, y lo que debe restar del saldo (y afectar lo que queda para los
// demás Whimms) es lo que de verdad se pagó, no el estimado original
// (pedido por Pame, onceava tanda).
export function totalWhimmsCompradosHasta(whimms) {
  // Solo se resta la parte que realmente salió del banco (Ahorro acumulado
  // real refleja tu cuenta Nu). Si parte del precio ya se había apartado en
  // efectivo/otra cuenta (montoApartado), esa parte no vuelve a restarse.
  return (whimms || [])
    .filter((w) => w.estado === 'comprado')
    .reduce((sum, w) => {
      const precioFinal = Number(w.precioComprado ?? w.precio) || 0
      const yaApartado = Number(w.montoApartado) || 0
      return sum + Math.max(precioFinal - yaApartado, 0)
    }, 0)
}

// `saldoInicial` (20 sep, onceava tanda): lo que Pame ya tenía en el banco
// ANTES de empezar a registrar nada en la app (ej. antes de su primera
// quincena registrada) — sin esto, el cálculo asumía que arrancaba en $0,
// así que a cualquiera que empezó con algo de dinero ya guardado le iba a
// dar un número más bajo que su banco real por esa diferencia. Se guarda
// una sola vez en /users/{uid}/config/presupuesto (mismo documento que
// `whimmsSimultaneos`) y Pame lo captura ella misma desde Perfil.
export function saldoLibreAcumuladoReal({ sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, hoyISO, saldoInicial }) {
  const hoy = hoyISO || todayISO()
  return (
    (Number(saldoInicial) || 0) +
    totalIngresosHasta(sueldosFijos, sueldosRapidos, hoy) -
    totalGastosHasta(gastos, hoy) -
    totalVencimientosHasta(pagosFijos, hoy) -
    totalWhimmsCompradosHasta(whimms)
  )
}

// Del saldo acumulado real, cuánto NO se le puede prestar a los Whimms
// porque ya está comprometido con el próximo vencimiento de cada pago fijo
// activo (se reserva el monto COMPLETO del siguiente ciclo de cada uno,
// no solo la fracción diaria) — así un pago grande que ya está "cerca" no
// se lo come la wishlist antes de que llegue su fecha.
export function reservaInmediataPagosFijos(pagosFijos, hoyISO) {
  return reservasDiariasPagosFijos(pagosFijos, hoyISO).reduce((sum, r) => sum + r.monto, 0)
}

// Qué fracción del saldo libre (ya sin lo reservado a pagos fijos) se le
// permite reclamar a la wishlist de Whimms — el resto se queda como
// colchón de gasto hormiga/imprevistos, sin que "Disponible para Whimms"
// lo cuente como suyo (doceava tanda, a pedido de Pame: "no darme opción
// de comprar muchas cosas solo porque tengo el dinero"). Default 50/50,
// configurable en config/presupuesto (`porcentajeWhimms`, 0 a 1).
function porcentajeWhimmsDe(params) {
  const p = Number(params?.porcentajeWhimms)
  return Number.isFinite(p) ? Math.min(Math.max(p, 0), 1) : 0.5
}

// El saldo libre total antes de repartirlo entre Whimms y el colchón de
// gasto hormiga — ver disponibleParaWhimms/bufferGastoHormiga más abajo,
// que son las dos mitades (según `porcentajeWhimms`) de este mismo número.
export function disponibleBrutoParaWhimms(params) {
  const saldo = saldoLibreAcumuladoReal(params)
  const reserva = reservaInmediataPagosFijos(params.pagosFijos, params.hoyISO)
  return Math.max(saldo - reserva, 0)
}

export function disponibleParaWhimms(params) {
  return disponibleBrutoParaWhimms(params) * porcentajeWhimmsDe(params)
}

// La otra mitad (o lo que quede según `porcentajeWhimms`) del saldo libre
// — colchón para gasto hormiga/imprevistos hasta el próximo ingreso, que
// NO se ofrece para financiar Whimms.
export function bufferGastoHormiga(params) {
  return disponibleBrutoParaWhimms(params) * (1 - porcentajeWhimmsDe(params))
}

// Cuántos días faltan hasta el próximo ingreso de cualquier sueldo fijo
// (el que sea que caiga primero) — usado para ver el colchón de gasto
// hormiga como una tasa por día ("cuánto me queda por día hasta que me
// paguen"), no solo como un monto suelto. Mismo criterio "nunca 0 días"
// que ya usan Inicio/Perfil/Sueldos: si la próxima fecha de un sueldo es
// justo hoy, se toma la siguiente ocurrencia.
export function diasHastaProximoIngreso(sueldosFijos, hoyISO) {
  const hoy = hoyISO || todayISO()
  const dias = (sueldosFijos || [])
    .map((s) => {
      const fecha = proximaFechaSueldo(s, hoy)
      const proxima = fecha === hoy ? (fechasPagoVivas(s).find((f) => f > hoy) || null) : fecha
      return daysUntil(proxima)
    })
    .filter((d) => d != null && d > 0)
  return dias.length ? Math.min(...dias) : null
}

// Promedio diario de gasto hormiga real (Gasto tipo Whimm, no Vitall) en
// los últimos `ventanaDias` — referencia propia de Pame (no un número
// inventado) para juzgar si el colchón por día hasta el próximo ingreso
// se está quedando corto comparado con su ritmo real reciente.
export function promedioGastoHormigaDiario(gastos, hoyISO, ventanaDias = 30) {
  const hoy = hoyISO || todayISO()
  const desde = addDaysISO(hoy, -ventanaDias)
  const total = (gastos || [])
    .filter((g) => g.categoria === 'Whimm' && g.fecha && g.fecha > desde && g.fecha <= hoy)
    .reduce((s, g) => s + (Number(g.monto) || 0), 0)
  return total / ventanaDias
}

// Reparte el saldo disponible entre los primeros `n` Whimms activos (ya
// ordenados por prioridad/score), proporcional al score de cada uno — a
// pedido de Pame, para que varios avancen a la vez en vez de que todo el
// excedente vaya solo al #1 hasta completarlo. Cuando el #1 se completa (o
// se marca comprado), su lugar lo toma el siguiente de la fila la próxima
// vez que se calcule esto — no hace falta ningún ajuste manual.
export function asignarSaldoWhimms(whimmsActivosOrdenados, saldoDisponible, n) {
  const top = (whimmsActivosOrdenados || []).slice(0, Math.max(Number(n) || 1, 1))
  const disponible = Math.max(Number(saldoDisponible) || 0, 0)
  const scoreTotal = top.reduce((s, w) => s + Math.max(w.score ?? w._score ?? 0, 0.01), 0)
  return top.map((w) => {
    const score = Math.max(w.score ?? w._score ?? 0, 0.01)
    const acumuladoAutomatico = scoreTotal > 0 ? (disponible * score) / scoreTotal : 0
    return { ...w, acumuladoAutomatico }
  })
}

// Proyecta la fecha estimada de compra de cada Whimm activo de la fila,
// simulando día por día el reparto REAL del ahorro (duodécima tanda, a
// pedido de Pame): antes esto era una cascada serial que asumía que cada
// Whimm arrancaba desde $0 y que solo UNO a la vez recibía todo el
// presupuesto diario — no coincidía con `asignarSaldoWhimms`, que reparte
// el saldo libre entre los primeros `whimmsSimultaneos` a la vez, ni con
// el progreso que cada Whimm ya trae (montoApartado + su parte ya
// asignada del saldo libre). Por eso, si se compraban varios Whimms de
// golpe con dinero ya acumulado, los que seguían en la fila se veían con
// fechas mucho más próximas de golpe, aunque en realidad no se había
// ahorrado nada nuevo todavía para ellos.
//
// Ahora: el punto de partida de cada Whimm es su progreso real de HOY
// (igual que `asignarSaldoWhimms`), y de ahí en adelante se reparte el
// `presupuestoDiarioNeto` (el ahorro diario real, según ingreso mensual y
// frecuencias de sueldo) entre los primeros `whimmsSimultaneos` de la fila
// que aún no se completan, por score — igual que hoy, pero como flujo
// diario. Cuando uno se completa, el siguiente de la fila entra a recibir
// presupuesto desde ESE momento (no desde antes), así que los que venían
// más atrás nunca "se recorren" hacia una fecha más próxima solo porque
// otros se compraron con dinero que ya estaba ahorrado.
export function proyectarColaWhimms(whimmsActivosOrdenados, presupuestoDiarioNeto, disponibleWhimms, whimmsSimultaneos) {
  const lista = whimmsActivosOrdenados || []
  const n = Math.max(Number(whimmsSimultaneos) || 1, 1)
  const diario = Math.max(Number(presupuestoDiarioNeto) || 0, 0)
  const hoy = todayISO()

  // Progreso de hoy: lo apartado a mano + la parte de hoy del saldo libre
  // ya disponible, repartida por score entre los primeros `n` de la fila
  // (mismo criterio que `asignarSaldoWhimms`, reutilizado aquí para que el
  // punto de arranque de la simulación sea el mismo que ven las barras de
  // progreso).
  const activosHoy = asignarSaldoWhimms(lista, disponibleWhimms, n)
  const acumuladoHoyById = Object.fromEntries(activosHoy.map((w) => [w.id, w.acumuladoAutomatico]))

  const estado = lista.map((w) => ({
    id: w.id,
    score: Math.max(w.score ?? w._score ?? 0, 0.01),
    precio: Number(w.precio) || 0,
    progreso: (Number(w.montoApartado) || 0) + (acumuladoHoyById[w.id] || 0),
    diasDesdeHoy: null,
  }))

  // Lo que ya alcanza para comprarse hoy mismo con el saldo libre que ya
  // está repartido (posible si el saldo cubre a varios de la fila de una).
  estado.forEach((e) => {
    if (e.diasDesdeHoy == null && e.progreso >= e.precio - 1e-6) e.diasDesdeHoy = 0
  })

  const MAX_DIAS = 20 * 365 // más allá de esto simplemente no se proyecta fecha
  if (diario > 0) {
    let diasTranscurridos = 0
    let fases = 0
    while (fases < lista.length + 2 && diasTranscurridos < MAX_DIAS) {
      fases += 1
      const activos = estado.filter((e) => e.diasDesdeHoy == null).slice(0, n)
      if (activos.length === 0) break
      const scoreTotal = activos.reduce((s, e) => s + e.score, 0)
      const shares = activos.map((e) => (scoreTotal > 0 ? (diario * e.score) / scoreTotal : 0))
      let minDias = Infinity
      activos.forEach((e, i) => {
        if (shares[i] > 0) minDias = Math.min(minDias, Math.max(e.precio - e.progreso, 0) / shares[i])
      })
      if (!Number.isFinite(minDias)) break
      minDias = Math.min(minDias, MAX_DIAS - diasTranscurridos)
      activos.forEach((e, i) => { e.progreso += shares[i] * minDias })
      diasTranscurridos += minDias
      activos.forEach((e) => {
        if (e.diasDesdeHoy == null && e.progreso >= e.precio - 1e-6) e.diasDesdeHoy = Math.ceil(diasTranscurridos)
      })
    }
  }

  const resultById = Object.fromEntries(
    estado.map((e) => [
      e.id,
      {
        fechaProyectada: e.diasDesdeHoy != null ? addDaysISO(hoy, e.diasDesdeHoy) : null,
        acumuladoAutomatico: acumuladoHoyById[e.id] || 0,
      },
    ])
  )

  return lista.map((w) => ({ ...w, ...resultById[w.id] }))
}


// --- Vencimientos de pagos fijos (Vitall/Vivienda/Transporte/Deuda) ---
// Igual idea que fechasPagoVivas para sueldos: a partir de una fecha ancla
// guardada (`fecha`) y la frecuencia, se extiende hacia el futuro de forma
// indefinida (o hasta `numPagos` si el pago fijo es finito), en vez de
// depender de un campo `fecha` estático que se queda obsoleto en cuanto
// pasa esa fecha.
const HORIZONTE_DIAS_PAGOFIJO = 365

export function fechasVencimientoVivas(pagoFijo, hastaISO) {
  if (!pagoFijo.fecha) return []
  const hasta = hastaISO || addDaysISO(todayISO(), HORIZONTE_DIAS_PAGOFIJO)
  let fechas = extenderFechasPago(pagoFijo.frecuencia, [pagoFijo.fecha], hasta)
  if (pagoFijo.finito && pagoFijo.numPagos) {
    fechas = [...fechas].sort(compareISOAsc).slice(0, Number(pagoFijo.numPagos) || fechas.length)
  }
  return fechas
}

// El próximo vencimiento (hoy o después) de un pago fijo — reemplaza leer
// el campo `fecha` estático, que nunca avanzaba de un ciclo al siguiente.
export function proximoVencimientoPagoFijo(pagoFijo, hoyISO) {
  const hoy = hoyISO || todayISO()
  const fechas = fechasVencimientoVivas(pagoFijo)
  return fechas.find((f) => f >= hoy) || null
}
