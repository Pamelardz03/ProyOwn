import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { setUserDoc } from '../lib/firestoreCollections'
import { todayISO } from '../lib/date'
import { inicializarBolsillos, migrarPagosFijos, procesarDiasPendientes, bolsillosDeHoy, aplicarCorreccionesManuales } from '../lib/budget'

// Bolsillos independientes de Whimms/gastos/pagos fijos (trigésima
// segunda y trigésima tercera tanda) — ver el comentario grande en
// src/lib/budget.js para la explicación completa. Este hook es el único
// punto de la app que lee/escribe `saldoWhimms`/`saldoGastos`/
// `saldoPagosFijos`/`ultimoProcesado` de config/presupuesto: asienta los
// días ya pasados (o migra a quien todavía no tenga `saldoPagosFijos`) y
// devuelve la vista en vivo de hoy para pintar en pantalla. Cada página
// que necesite "disponible para whimms"/"gastos"/"pagos fijos" debe usar
// este hook en vez de leer esos campos directo o recalcular con las
// funciones viejas de foto instantánea (`disponibleParaWhimms`/
// `bufferGastoHormiga`, que siguen existiendo solo por si algo más las
// necesita, pero ya no alimentan la UI real).
export function useBolsillos({ configPresupuesto, loadingConfig, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms }) {
  const { user } = useAuth()
  const ultimaEscrituraRef = useRef(null)
  const hoy = todayISO()
  const params = { sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms }

  const listo = !loadingConfig
  const necesitaSemilla = listo && configPresupuesto?.ultimoProcesado == null
  // Cuentas que ya venían de la tanda 32 (sí tienen ultimoProcesado) pero
  // todavía no tienen `saldoPagosFijos` (el bolsillo se agregó en la
  // tanda 33) — se migran una sola vez, separando de gastos lo que ya le
  // tocaría tener a pagos fijos/Vitall, sin tocar ultimoProcesado.
  const necesitaMigracionPagosFijos = listo && !necesitaSemilla && configPresupuesto?.saldoPagosFijos == null

  const baseSinCorregir = necesitaSemilla
    ? inicializarBolsillos(params, hoy)
    : necesitaMigracionPagosFijos
      ? migrarPagosFijos(
          { saldoWhimms: configPresupuesto.saldoWhimms, saldoGastos: configPresupuesto.saldoGastos, ultimoProcesado: configPresupuesto.ultimoProcesado },
          params,
          hoy
        )
      : listo && configPresupuesto
        ? procesarDiasPendientes({
            saldoWhimms: configPresupuesto.saldoWhimms,
            saldoGastos: configPresupuesto.saldoGastos,
            saldoPagosFijos: configPresupuesto.saldoPagosFijos,
            ultimoProcesado: configPresupuesto.ultimoProcesado,
            sueldosFijos,
            sueldosRapidos,
            gastos,
            pagosFijos,
            whimms,
            porcentajeWhimms,
            hoyISO: hoy,
          })
        : null

  // Correcciones manuales de una sola vez (trigésima cuarta tanda) — solo
  // sobre bolsillos que ya existían de antes (una semilla recién armada
  // con los datos YA corregidos no necesita ajuste, ver el comentario
  // grande en budget.js). Se aplican encima del resultado de arriba, sin
  // pisar `ultimoProcesado`.
  const base = baseSinCorregir && !necesitaSemilla
    ? (() => {
        const correccion = aplicarCorreccionesManuales({ ...baseSinCorregir, correccionesAplicadas: configPresupuesto?.correccionesAplicadas })
        return { ...baseSinCorregir, saldoWhimms: correccion.saldoWhimms, saldoGastos: correccion.saldoGastos, saldoPagosFijos: correccion.saldoPagosFijos, correccionesAplicadas: correccion.correccionesAplicadas }
      })()
    : baseSinCorregir

  useEffect(() => {
    if (!user || !base) return
    const correccionesKey = JSON.stringify(base.correccionesAplicadas || [])
    const yaGuardado = configPresupuesto?.ultimoProcesado === base.ultimoProcesado
      && configPresupuesto?.saldoWhimms === base.saldoWhimms
      && configPresupuesto?.saldoGastos === base.saldoGastos
      && configPresupuesto?.saldoPagosFijos === base.saldoPagosFijos
      && JSON.stringify(configPresupuesto?.correccionesAplicadas || []) === correccionesKey
    if (yaGuardado) return
    const key = `${base.ultimoProcesado}-${base.saldoWhimms}-${base.saldoGastos}-${base.saldoPagosFijos}-${correccionesKey}`
    if (ultimaEscrituraRef.current === key) return
    ultimaEscrituraRef.current = key
    setUserDoc(user.uid, 'config', 'presupuesto', {
      saldoWhimms: base.saldoWhimms,
      saldoGastos: base.saldoGastos,
      saldoPagosFijos: base.saldoPagosFijos,
      ultimoProcesado: base.ultimoProcesado,
      ...(base.correccionesAplicadas ? { correccionesAplicadas: base.correccionesAplicadas } : {}),
    }).catch((e) => console.error('No se pudieron guardar los bolsillos', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, base?.ultimoProcesado, base?.saldoWhimms, base?.saldoGastos, base?.saldoPagosFijos, JSON.stringify(base?.correccionesAplicadas || [])])

  if (!base) return { saldoWhimms: 0, saldoGastos: 0, saldoPagosFijos: 0, metaGastosHoy: 0, loading: true }
  const hoyView = bolsillosDeHoy(base, params, hoy)
  return { ...hoyView, loading: false }
}
