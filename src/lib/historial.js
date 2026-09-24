// Constructor compartido de "eventos de historial" — antes vivía solo
// dentro de HistorialCompleto.jsx; se extrajo aquí (treceava tanda, a
// pedido de Pame) para que Inicio.jsx pueda mostrar el mismo historial
// completo y sin filtro (antes Inicio armaba su propia lista reducida,
// solo con gastos/sueldos rápidos/Whimms comprados — sin sueldos fijos ni
// los eventos de "Cambios" como crear un Whimm o un Vitall).
import { gastoNeto, fechasVencimientoVivas, montoOcurrenciaPagoFijo } from './budget'

const GASTO_DOT = { Whimm: '#8c5a6e', Vitall: '#5c2536' }

function msFromTimestamp(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

function isoFromTimestamp(ts) {
  const ms = msFromTimestamp(ts)
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function buildHistorialEvents({ gastos, sueldosRapidos, sueldosFijos, pagosFijos, whimms, hoyISO }) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10)
  const out = []

  ;(gastos || []).forEach((g) => {
    out.push({
      id: `gasto-${g.id}`,
      cat: 'gasto',
      subcat: g.categoria === 'Whimm'
        ? (g.categoriaWhimm || '')
        : g.categoria === 'Vitall'
          ? (g.vitallNombre || '')
          : '',
      badge: g.categoria || 'Gasto',
      title: g.concepto || 'Gasto',
      amount: -gastoNeto(g),
      dotColor: GASTO_DOT[g.categoria] || GASTO_DOT.Whimm,
      dateISO: g.fecha || '',
      editable: 'gasto',
      gastoId: g.id,
    })
  })

  ;(sueldosRapidos || []).forEach((r) => {
    out.push({
      id: `rapido-${r.id}`,
      cat: 'nomina',
      badge: 'Sueldo rápido',
      title: r.desc || 'Sueldo rápido',
      amount: Number(r.monto) || 0,
      dotColor: '#3a0f1f',
      dateISO: r.fecha || '',
      editable: 'sueldoRapido',
      sueldoRapidoId: r.id,
    })
  })

  ;(sueldosFijos || []).forEach((s) => {
    const fechas = Array.isArray(s.fechasPago) ? s.fechasPago : []
    fechas
      .filter((f) => f && f <= hoy)
      .forEach((f) => {
        out.push({
          id: `fijo-${s.id}-${f}`,
          cat: 'nomina',
          badge: 'Sueldos',
          title: `${s.name || 'Sueldo fijo'} depositado`,
          amount: Number(s.monto) || 0,
          dotColor: '#3a0f1f',
          dateISO: f,
        })
      })
  })

  ;(pagosFijos || []).forEach((p) => {
    out.push({
      id: `pagofijo-${p.id}`,
      cat: 'cambio',
      subcat: p.tipo || '',
      badge: 'Registro',
      title: `Agregaste "${p.name || 'pago'}" como ${p.tipo === 'Vitall' ? 'Vitall' : 'pago fijo'}`,
      amount: null,
      dotColor: '#7a7156',
      dateISO: isoFromTimestamp(p.creadoEn),
      editable: 'pagoFijoDef',
      pagoFijoId: p.id,
    })

    // Una fila por cada ocurrencia YA vencida (vigésima sexta tanda, a
    // pedido de Pame) — antes el historial no mostraba nada de los cobros
    // de pagos fijos/Vitall en sí, solo el registro de cuando se creó. Se
    // puede editar cada una desde aquí (HistorialCompleto.jsx: cambiar el
    // monto de ese día o marcarlo como no cobrado) sin afectar la
    // definición recurrente ni las demás fechas — ver `excepciones` en
    // src/lib/budget.js.
    if (p.activo !== false) {
      fechasVencimientoVivas(p, hoy)
        .filter((f) => f <= hoy)
        .forEach((f) => {
          out.push({
            id: `pagofijovenc-${p.id}-${f}`,
            cat: 'gasto',
            subcat: p.tipo === 'Vitall' ? (p.name || '') : (p.tipo || ''),
            badge: p.tipo === 'Vitall' ? 'Vitall' : 'Pago fijo',
            title: `Se cobró "${p.name || 'pago'}"`,
            amount: -montoOcurrenciaPagoFijo(p, f),
            dotColor: GASTO_DOT.Vitall,
            dateISO: f,
            editable: 'pagoFijoOcurrencia',
            pagoFijoId: p.id,
            pagoFijoNombre: p.name || 'pago',
            ocurrenciaFecha: f,
          })
        })
    }
  })

  ;(whimms || []).forEach((w) => {
    out.push({
      id: `whimm-${w.id}`,
      cat: 'cambio',
      subcat: w.categoria || '',
      badge: 'Creación',
      title: `Agregaste "${w.name || 'un Whimm'}" a la lista`,
      amount: null,
      dotColor: '#3f6b45',
      dateISO: isoFromTimestamp(w.creadoEn),
      editable: 'whimm',
      whimmId: w.id,
    })

    if (w.estado === 'comprado' && w.compradoEn) {
      const precioFinal = Number(w.precioComprado ?? w.precio) || 0
      const yaApartado = Number(w.montoApartado) || 0
      out.push({
        id: `whimmcomprado-${w.id}`,
        cat: 'gasto',
        subcat: w.categoria || '',
        badge: 'Whimm',
        title: `Se compró "${w.name || 'un Whimm'}"`,
        amount: -Math.max(precioFinal - yaApartado, 0),
        dotColor: GASTO_DOT.Whimm,
        dateISO: w.compradoEn,
        editable: 'whimm',
        whimmId: w.id,
      })
    }
  })

  return out.filter((e) => e.dateISO)
}
