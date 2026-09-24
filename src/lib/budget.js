import { isThisMonth, todayISO, addDaysISO, extenderFechasPago, compareISOAsc, daysUntil, parseISODate } from './date'

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
// `excepciones` (vigésima sexta tanda, a pedido de Pame: "pregunta si
// solo una frecuencia y activar a la siguiente frecuencia o desactivar
// indefinido") — mismo mecanismo que ya tienen los pagos fijos: un mapa
// { [fechaISO]: { omitida: true } } en el propio documento del sueldo
// para saltarse UNA sola ocurrencia (ej. "esta quincena no me pagaron")
// sin tocar `fechaFin` ni las demás fechas — la serie sigue viva y
// retoma normal en la siguiente ocurrencia.
export function fechasPagoVivas(sueldo, hastaISO) {
  const base = Array.isArray(sueldo.fechasPago) && sueldo.fechasPago.length
    ? sueldo.fechasPago
    : sueldo.fecha ? [sueldo.fecha] : []
  if (base.length === 0) return []
  let hasta = hastaISO || addDaysISO(todayISO(), HORIZONTE_DIAS_SUELDO)
  if (sueldo.fechaFin && sueldo.fechaFin < hasta) hasta = sueldo.fechaFin
  let fechas = extenderFechasPago(sueldo.frecuencia, base, hasta)
  if (sueldo.fechaFin) fechas = fechas.filter((f) => f <= sueldo.fechaFin)
  const excepciones = sueldo.excepciones || {}
  return fechas.filter((f) => !excepciones[f]?.omitida)
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

// --- Reserva real por vencimiento próximo (20 sep, novena tanda; ---
// --- acumulación gradual, 23 sep, vigésima sexta tanda) ---
// Reemplaza el promedio fijo por ciclo (monto/30 días sin importar cuándo
// vence de verdad) que había antes: ahora cada pago fijo/Vitall activo
// exige juntar monto/díasRestantes cada día hasta su PRÓXIMO vencimiento
// real, en vez de una reserva constante. Así un pago grande que se acerca
// "pesa" más en el presupuesto diario mientras más cerca está — si debo
// $900 y faltan 4 días, son $225/día esos 4 días, no un promedio parejo
// todo el mes.
//
// `reservaAcumulada` (vigésima sexta tanda, a pedido de Pame: "no me
// convence que me quita dinero de whimms apenas pague un pago fijo, con
// otra ronda de pagos fijos siempre") — antes `reservaInmediataPagosFijos`
// apartaba de un jalón el monto COMPLETO del siguiente vencimiento de
// CADA pago fijo activo, todo el tiempo, sin importar qué tan lejos
// estuviera: en cuanto pagabas uno, su "próximo vencimiento" saltaba al
// siguiente ciclo pero la reserva volvía a exigir el monto completo de
// inmediato, como si venciera hoy. Ahora la reserva de cada pago fijo
// CRECE a lo largo del ciclo: $0 justo después de pagarlo (o de darlo de
// alta, para el primer ciclo), subiendo día a día en línea recta hasta
// llegar al monto completo justo el día que vence — igual que ya
// acumulan los Whimms, no un "corte" de un solo golpe. `cicloDias` es la
// duración de ESTE ciclo (del vencimiento anterior al próximo); si no hay
// vencimiento anterior (primer ciclo), se usa la fecha de alta del pago
// fijo como inicio.
export function reservasDiariasPagosFijos(pagosFijos, hoyISO) {
  const hoy = hoyISO || todayISO()
  return (pagosFijos || [])
    .filter((p) => p.activo !== false)
    .map((p) => {
      const vencimiento = proximoVencimientoPagoFijo(p, hoy)
      if (!vencimiento) return null
      const dias = Math.max(daysUntil(vencimiento), 1)
      const monto = montoOcurrenciaPagoFijo(p, vencimiento)
      const serieHastaVencimiento = fechasVencimientoVivas(p, vencimiento).sort(compareISOAsc)
      const anterior = [...serieHastaVencimiento].filter((f) => f < vencimiento).pop() || p.fecha || hoy
      const cicloDias = Math.max(Math.round((parseISODate(vencimiento) - parseISODate(anterior)) / 86400000), 1)
      const transcurridos = Math.min(Math.max(cicloDias - dias, 0), cicloDias)
      const reservaAcumulada = monto * (transcurridos / cicloDias)
      return { pago: p, vencimiento, dias, monto, reservaDiaria: monto / dias, reservaAcumulada }
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
    .reduce((sum, p) => sum + fechasVencimientoVivas(p).filter((f) => f <= hoy).reduce((s2, f) => s2 + montoOcurrenciaPagoFijo(p, f), 0), 0)
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
// porque ya está comprometido con los pagos fijos activos — la reserva de
// CADA uno se acumula gradualmente a lo largo de su ciclo (ver
// `reservasDiariasPagosFijos`, vigésima sexta tanda), así un pago grande
// que ya está "cerca" pesa cada vez más, pero uno que se acaba de pagar
// no vuelve a quitarle dinero a whimms de un jalón.
export function reservaInmediataPagosFijos(pagosFijos, hoyISO) {
  return reservasDiariasPagosFijos(pagosFijos, hoyISO).reduce((sum, r) => sum + r.reservaAcumulada, 0)
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

// --- Tasa diaria de colchón ESTABLE, no "repartida" entre lo que queda ---
// A pedido explícito de Pame (22 sep): "cuánto tengo disponible por día"
// no debe recalcularse dividiendo el mismo colchón entre los días que
// van quedando hasta el próximo pago (eso hace que la cifra se infle sola
// nada más porque pasan los días sin gastar, aunque el colchón real no
// haya crecido) — quiere que, si no se gasta, el dinero se vaya juntando
// normal para el día siguiente, con una tasa diaria que no cambie por sí
// sola. `limitesPeriodoActual` encuentra la fecha de pago (de cualquier
// sueldo fijo) más reciente que ya cayó y la próxima que va a caer —
// delimitan el periodo de pago vigente.
export function limitesPeriodoActual(sueldosFijos, hoyISO) {
  const hoy = hoyISO || todayISO()
  const hasta = addDaysISO(hoy, HORIZONTE_DIAS_SUELDO)
  const todas = (sueldosFijos || []).flatMap((s) => fechasPagoVivas(s, hasta))
  const pasadas = todas.filter((f) => f <= hoy).sort(compareISOAsc)
  const futuras = todas.filter((f) => f > hoy).sort(compareISOAsc)
  return {
    inicio: pasadas.length ? pasadas[pasadas.length - 1] : null,
    fin: futuras.length ? futuras[0] : null,
  }
}

// Duración FIJA (en días) del periodo de pago vigente — de la última
// fecha de pago real a la próxima. A diferencia de `diasHastaProximoIngreso`
// (que se encoge día a día), este número se mantiene constante durante
// todo el periodo, así que sirve como divisor estable para la tasa diaria
// del colchón: si no gastas, el colchón no se "reparte" entre menos días
// restantes — la tasa diaria se queda igual, y lo que no gastaste sigue
// disponible tal cual para el día siguiente (y el que sigue).
export function diasPeriodoActual(sueldosFijos, hoyISO) {
  const { inicio, fin } = limitesPeriodoActual(sueldosFijos, hoyISO)
  if (!inicio || !fin) return null
  const dias = Math.round((parseISODate(fin) - parseISODate(inicio)) / 86400000)
  return dias > 0 ? dias : null
}

// Presupuesto diario TOTAL — whimms + gasto libre juntos, ANTES de aplicar
// `porcentajeWhimms` — a pedido de Pame (23 sep): "si me da 200 al día por
// whimm y gastos, yo decido el porcentaje... así no cambian los 200 de los
// futuros días". El % solo decide cómo se reparte ESTE mismo total entre
// juntar para whimms y tener libre para gastar hoy, no cambia el total en
// sí (por eso se calcula sobre `disponibleBrutoParaWhimms`, que es previo
// a aplicar el %).
//
// Divisor (vuelta atrás, 23 sep — tanda 26): entre la tanda 22 y esta, se
// probó `diasPeriodoActual` (duración FIJA del periodo de pago, para que
// la tasa diaria no se "inflara" sola con los días sin gastar) y `diasHastaProximoIngreso`
// (los días que van QUEDANDO hasta el próximo pago, encogiéndose día a
// día). A pedido explícito de Pame, se regresa a `diasHastaProximoIngreso`:
// el saldo no gastado se reparte equitativamente entre los días que
// quedan del periodo actual, no entre la duración fija de todo el periodo.
export function presupuestoDiarioTotal(params) {
  const dias = diasHastaProximoIngreso(params.sueldosFijos, params.hoyISO)
  if (!dias) return null
  return disponibleBrutoParaWhimms(params) / dias
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

// Línea de tiempo de eventos de dinero FUTUROS (dieciochoava tanda, a
// pedido de Pame: "quiero que la fecha esperada esté en base a los
// ingresos de sueldos, ya contando los pagos fijos, y en base al
// porcentaje que le doy a Whimms" — el dinero no llega parejito cada día
// como asumía `estimatePresupuestoDiarioNeto`, llega en montos concretos
// en fechas concretas: tu quincena de Kenet cae el 30, no 1/30 de ella
// cada día del mes). Cada evento es un día real con dinero que se mueve:
// positivo cuando cae un sueldo fijo, negativo cuando vence un pago
// fijo/Vitall activo. Se excluye a propósito el PRÓXIMO vencimiento de
// cada pago fijo (el que ya reserva `reservaInmediataPagosFijos` del saldo
// de HOY) — si también se restara aquí, se contaría dos veces; esta línea
// de tiempo solo cubre lo que pasa DESPUÉS de eso.
export function construirFlujoFuturo({ sueldosFijos, pagosFijos, hoyISO }) {
  const hoy = hoyISO || todayISO()
  const hasta = addDaysISO(hoy, HORIZONTE_DIAS_SUELDO)
  const porFecha = {}
  ;(sueldosFijos || []).forEach((s) => {
    fechasPagoVivas(s, hasta)
      .filter((f) => f > hoy)
      .forEach((f) => { porFecha[f] = (porFecha[f] || 0) + (Number(s.monto) || 0) })
  })
  ;(pagosFijos || []).filter((p) => p.activo !== false).forEach((p) => {
    const proximo = proximoVencimientoPagoFijo(p, hoy)
    fechasVencimientoVivas(p, hasta)
      .filter((f) => f > hoy && f > (proximo || hoy))
      .forEach((f) => { porFecha[f] = (porFecha[f] || 0) - (Number(p.monto) || 0) })
  })
  return Object.keys(porFecha)
    .sort(compareISOAsc)
    .map((fecha) => ({ fecha, neto: porFecha[fecha] }))
}

// Proyecta la fecha estimada de compra de cada Whimm activo de la fila.
// Duodécima tanda: simulación día por día con una tasa constante.
// Dieciochoava tanda: se cambió a repartir el dinero completo el mismo día
// de cada pago — pero eso hacía que TODAS las fechas cayeran justo en tus
// días de pago (30, 15...), amontonando varios Whimms en la misma fecha
// exacta en vez de fechas distintas y escalonadas (a pedido de Pame:
// "no quería que se repartiera solo los días de pago, quería que lo
// estimara en fechas distintas").
//
// Diecinueveava tanda — modelo híbrido: entre dos eventos de dinero
// consecutivos (un sueldo que cae o un pago fijo/Vitall que vence), el
// dinero que quedó disponible para Whimms en el evento anterior (ya neto
// de lo que venza antes de que llegue el siguiente) se reparte como una
// tasa CONSTANTE día por día durante ese tramo — no de golpe el día del
// pago, así que la fecha exacta de cada Whimm cae el día real en que se
// cruza su precio, no necesariamente un día de pago. El monto total
// repartido en cada tramo sigue siendo el real de esa quincena (ni más ni
// menos), y cada vencimiento de pago fijo sigue restándose PRIMERO, antes
// de calcular la tasa del tramo siguiente — solo cambia que ya no se
// aplica todo de un solo golpe el día exacto del depósito.
//
// El punto de partida de cada Whimm sigue siendo su progreso real de HOY
// (igual que `asignarSaldoWhimms`): lo apartado a mano + su parte ya
// asignada del saldo libre ya disponible. Cuando uno se completa, el
// siguiente de la fila entra a recibir dinero desde ESE momento (no desde
// antes), así que los que venían más atrás nunca "se recorren" hacia una
// fecha más próxima solo porque otros se compraron con dinero que ya
// estaba ahorrado.
// Cadencia mínima (veinticuatroava tanda, a pedido de Pame: "quisiera el
// método que permitiera comprar cosas más frecuentemente, al menos 1 vez
// cada 2 semanas" — sin esto, un Whimm caro de score alto (ej. el fondo
// del viaje a Disney, $8,500) puede bloquear la fila 30+ días mientras
// junta su parte, aunque haya Whimms baratos esperando atrás en la fila).
// Cuando ya pasaron CADENCIA_DIAS sin completarse NINGÚN Whimm (real o
// simulado), se abre un segundo canal EN PARALELO al de siempre: se
// reserva RESERVA_CADENCIA del dinero de ese momento para el más barato
// de TODA la fila (no solo los primeros `whimmsSimultaneos`), sin
// quitarle el reparto normal a los de más arriba. Probado contra los 13
// Whimms reales de Pame: baja el peor caso de ~31 días entre compras a
// ~16 días — no se puede garantizar 14 exactos porque el dinero no llega
// parejo (a veces un pago fijo deja 2-3 días sin nada disponible), pero
// es la mejor mejora encontrada tras probar reservas fijas (20%-50%) y
// una versión que calcula la reserva exacta según los días que faltan.
const CADENCIA_DIAS = 14
const RESERVA_CADENCIA = 0.2

// El más barato (lo que le falta, no su precio total) de los pendientes
// que NO están ya en el canal normal (`idsExcluir` = los primeros n por
// score) — ese es al que le toca el canal de cadencia.
function elegirBaratoPendiente(pendientes, idsExcluir) {
  let elegido = null
  pendientes.forEach((e) => {
    if (idsExcluir.has(e.id)) return
    const falta = Math.max(e.precio - e.progreso, 0)
    if (!elegido || falta < Math.max(elegido.precio - elegido.progreso, 0)) elegido = e
  })
  return elegido
}

export function proyectarColaWhimms(whimmsActivosOrdenados, eventosFlujo, porcentajeWhimms, disponibleWhimms, whimmsSimultaneos, ultimaCompraISO) {
  const lista = whimmsActivosOrdenados || []
  const n = Math.max(Number(whimmsSimultaneos) || 1, 1)
  const pctRaw = Number(porcentajeWhimms)
  const pct = Number.isFinite(pctRaw) ? Math.min(Math.max(pctRaw, 0), 1) : 0.5
  const hoy = todayISO()

  // Progreso de hoy: lo apartado a mano + la parte de hoy del saldo libre
  // ya disponible, repartida por score entre los primeros `n` de la fila
  // (mismo criterio que `asignarSaldoWhimms`, reutilizado aquí para que el
  // punto de arranque de la simulación sea el mismo que ven las barras de
  // progreso) — y, si ya lleva CADENCIA_DIAS sin comprar nada, la parte de
  // hoy que le toca al más barato pendiente por el canal de cadencia.
  const topIds = new Set(lista.slice(0, n).map((w) => w.id))
  const estadoBase = lista.map((w) => ({
    id: w.id,
    score: Math.max(w.score ?? w._score ?? 0, 0.01),
    precio: Number(w.precio) || 0,
    progreso: Number(w.montoApartado) || 0,
    diasDesdeHoy: null,
    viaCadencia: false,
  }))

  const diasSinComprarHoy = ultimaCompraISO != null ? Math.max(-daysUntil(ultimaCompraISO), 0) : 0
  let disponibleParaTopN = Math.max(Number(disponibleWhimms) || 0, 0)
  let baratoHoyId = null
  let reservaCadenciaHoy = 0
  if (diasSinComprarHoy >= CADENCIA_DIAS) {
    const barato = elegirBaratoPendiente(estadoBase, topIds)
    if (barato) {
      const falta = Math.max(barato.precio - barato.progreso, 0)
      reservaCadenciaHoy = Math.min(falta, disponibleParaTopN * RESERVA_CADENCIA)
      if (reservaCadenciaHoy > 0) {
        baratoHoyId = barato.id
        disponibleParaTopN -= reservaCadenciaHoy
      }
    }
  }

  const activosHoy = asignarSaldoWhimms(lista, disponibleParaTopN, n)
  const acumuladoHoyById = Object.fromEntries(activosHoy.map((w) => [w.id, w.acumuladoAutomatico]))
  if (baratoHoyId) acumuladoHoyById[baratoHoyId] = (acumuladoHoyById[baratoHoyId] || 0) + reservaCadenciaHoy

  const estado = estadoBase.map((e) => ({
    ...e,
    progreso: e.progreso + (acumuladoHoyById[e.id] || 0),
  }))

  // Lo que ya alcanza para comprarse hoy mismo con el saldo libre que ya
  // está repartido (posible si el saldo cubre a varios de la fila de una).
  estado.forEach((e) => {
    if (e.diasDesdeHoy == null && e.progreso >= e.precio - 1e-6) {
      e.diasDesdeHoy = 0
      if (e.id === baratoHoyId) e.viaCadencia = true
    }
  })

  // `poolSinRepartir` es dinero que ya cayó (sueldos) menos lo que ya
  // venció (pagos fijos), neto, todavía sin convertir en una tasa diaria
  // — negativo cuando un vencimiento se adelanta a su sueldo (se carga
  // hacia adelante hasta que un sueldo lo vuelva a poner en positivo).
  let poolSinRepartir = 0
  let diaActual = 0
  const MAX_DIAS = 20 * 365 // más allá de esto simplemente no se proyecta fecha
  const eventos = eventosFlujo || []

  // Día simulado de la última compra (real o dentro de esta misma
  // simulación) — arranca antes de "hoy" si ya llevaba días sin comprar
  // nada, y se actualiza cada vez que algo se completa, para saber cuándo
  // el canal de cadencia debe activarse más adelante en la fila.
  let diaUltimaCompra = -diasSinComprarHoy
  if (estado.some((e) => e.diasDesdeHoy === 0)) diaUltimaCompra = 0

  // Reparte `diario` (una tasa constante de Whimms) día por día entre los
  // primeros `n` de la fila que aún no se completan, por score, dentro del
  // tramo [diaActual, diaLimite) — mismo cálculo de "fases" que la versión
  // original (día por día, duodécima tanda), acotado a este tramo. Si ya
  // pasaron CADENCIA_DIAS desde la última compra, una parte de `diario`
  // (RESERVA_CADENCIA) se desvía en paralelo hacia el más barato pendiente
  // fuera de esos primeros `n`, sin tocar lo que les toca a ellos.
  function repartirTramo(diario, diaLimite) {
    let dias = diaActual
    let fases = 0
    while (fases < lista.length * 2 + 4 && dias < diaLimite) {
      fases += 1
      const pendientes = estado.filter((e) => e.diasDesdeHoy == null)
      if (pendientes.length === 0) break
      const activos = pendientes.slice(0, n)
      const idsActivos = new Set(activos.map((e) => e.id))

      let barato = null
      let diarioBarato = 0
      if (dias - diaUltimaCompra >= CADENCIA_DIAS) {
        barato = elegirBaratoPendiente(pendientes, idsActivos)
        if (barato) diarioBarato = diario * RESERVA_CADENCIA
      }
      const diarioActivos = diario - diarioBarato

      const scoreTotal = activos.reduce((s, e) => s + e.score, 0)
      const shares = activos.map((e) => (scoreTotal > 0 ? (diarioActivos * e.score) / scoreTotal : 0))
      let minDias = Infinity
      activos.forEach((e, i) => {
        if (shares[i] > 0) minDias = Math.min(minDias, Math.max(e.precio - e.progreso, 0) / shares[i])
      })
      if (barato && diarioBarato > 0) {
        minDias = Math.min(minDias, Math.max(barato.precio - barato.progreso, 0) / diarioBarato)
      }
      if (!Number.isFinite(minDias)) break
      minDias = Math.min(minDias, diaLimite - dias)

      activos.forEach((e, i) => { e.progreso += shares[i] * minDias })
      if (barato && diarioBarato > 0) barato.progreso += diarioBarato * minDias
      dias += minDias

      activos.forEach((e) => {
        if (e.diasDesdeHoy == null && e.progreso >= e.precio - 1e-6) {
          e.diasDesdeHoy = Math.ceil(dias)
          diaUltimaCompra = dias
        }
      })
      if (barato && barato.diasDesdeHoy == null && barato.progreso >= barato.precio - 1e-6) {
        barato.diasDesdeHoy = Math.ceil(dias)
        barato.viaCadencia = true
        diaUltimaCompra = dias
      }
    }
  }

  let idx = 0
  while (idx <= eventos.length && estado.some((e) => e.diasDesdeHoy == null) && diaActual < MAX_DIAS) {
    const evento = idx < eventos.length ? eventos[idx] : null
    const diaLimite = evento ? Math.max(daysUntil(evento.fecha), 0) : MAX_DIAS
    const duracion = diaLimite - diaActual
    if (poolSinRepartir > 0 && duracion > 0) {
      repartirTramo((poolSinRepartir * pct) / duracion, diaLimite)
      poolSinRepartir = 0 // ya se repartió por completo a lo largo del tramo
    }
    diaActual = diaLimite
    if (!evento) break
    poolSinRepartir += evento.neto
    idx += 1
  }

  // Fechas siempre en el mismo orden que la prioridad (a pedido de Pame,
  // dieciseisava tanda: "no me gusta lo de las fechas, quiero que se
  // cumplan en orden también"). Sin este ajuste, un Whimm barato de menor
  // score podía completarse antes que uno carísimo de mayor score que
  // lleva más tiempo activo — el reparto real del dinero no cambia
  // (`acumuladoAutomatico`/progreso siguen igual, cada Whimm sigue
  // juntando lo que de verdad le toca), solo la FECHA que se muestra de
  // cada uno nunca queda antes que la del Whimm justo arriba en la fila.
  // Si uno no alcanza fecha dentro del horizonte (MAX_DIAS), todos los de
  // menor score tampoco muestran fecha, por la misma razón. EXCEPCIÓN a
  // propósito (veinticuatroava tanda): un Whimm que se completó por el
  // canal de cadencia (`viaCadencia`) se salta esta regla — su fecha real,
  // aunque sea más temprana que la de uno de mayor score, se muestra tal
  // cual, porque el punto del canal es justamente comprarlo fuera de su
  // turno normal. No participa en el orden de los demás ni para adelante
  // ni para atrás.
  let maxDiasEnOrden = -Infinity
  let bloqueado = false
  estado.forEach((e) => {
    if (e.viaCadencia) return
    if (bloqueado) { e.diasDesdeHoy = null; return }
    if (e.diasDesdeHoy == null) { bloqueado = true; return }
    e.diasDesdeHoy = Math.max(e.diasDesdeHoy, maxDiasEnOrden)
    maxDiasEnOrden = e.diasDesdeHoy
  })

  const resultById = Object.fromEntries(
    estado.map((e) => [
      e.id,
      {
        fechaProyectada: e.diasDesdeHoy != null ? addDaysISO(hoy, e.diasDesdeHoy) : null,
        acumuladoAutomatico: acumuladoHoyById[e.id] || 0,
        viaCadencia: !!e.viaCadencia,
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

// `excepciones` (vigésima sexta tanda, a pedido de Pame: "los pagos fijos
// se pueden editar en el historial... y solo se eliminará esa frecuencia")
// — mapa { [fechaISODeLaOcurrencia]: { omitida: true } | { monto: N } }
// guardado en el propio documento del pago fijo. Una ocurrencia "omitida"
// (ej. el día que no fue a clases y no pagó el estacionamiento) deja de
// existir para CUALQUIER cálculo — ya no se reserva, no se cuenta en el
// saldo, y la serie salta derecho a la siguiente — sin tocar la
// definición recurrente ni las demás fechas. Eliminar el pago fijo
// completo sigue siendo una acción aparte, con su propia confirmación,
// en PreciosFijos.jsx.
export function fechasVencimientoVivas(pagoFijo, hastaISO) {
  if (!pagoFijo.fecha) return []
  const hasta = hastaISO || addDaysISO(todayISO(), HORIZONTE_DIAS_PAGOFIJO)
  let fechas = extenderFechasPago(pagoFijo.frecuencia, [pagoFijo.fecha], hasta)
  if (pagoFijo.finito && pagoFijo.numPagos) {
    fechas = [...fechas].sort(compareISOAsc).slice(0, Number(pagoFijo.numPagos) || fechas.length)
  }
  const excepciones = pagoFijo.excepciones || {}
  return fechas.filter((f) => !excepciones[f]?.omitida)
}

// El próximo vencimiento (hoy o después) de un pago fijo — reemplaza leer
// el campo `fecha` estático, que nunca avanzaba de un ciclo al siguiente.
export function proximoVencimientoPagoFijo(pagoFijo, hoyISO) {
  const hoy = hoyISO || todayISO()
  const fechas = fechasVencimientoVivas(pagoFijo)
  return fechas.find((f) => f >= hoy) || null
}

// Monto real de UNA ocurrencia puntual — el monto guardado por default, o
// el que se haya corregido solo para esa fecha exacta (misma excepción de
// arriba). El monto general del pago fijo (y las demás fechas) no cambia.
export function montoOcurrenciaPagoFijo(pagoFijo, fechaISO) {
  const ex = (pagoFijo.excepciones || {})[fechaISO]
  if (ex && ex.monto != null) return Number(ex.monto) || 0
  return Number(pagoFijo.monto) || 0
}
