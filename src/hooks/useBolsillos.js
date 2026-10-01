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
            // Bug real (cuarentava tanda, cont. -- la tarjeta de Métricas
            // nunca aparecía): faltaba pasarle el `ultimoCierre` YA
            // GUARDADO en Firestore como punto de partida. Sin esto, en
            // CUALQUIER render donde no hay un día nuevo que cerrar (la
            // gran mayoría del día), `procesarDiasPendientes` no tenía de
            // dónde traerlo y lo devolvía en `null` -- borrando en la
            // vista el cierre real que sí se había guardado una vez.
            ultimoCierre: configPresupuesto.ultimoCierre,
            bonoGastosPendiente: configPresupuesto.bonoGastosPendiente,
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
      // Última foto de premio/castigo (cuarentava tanda) — solo se manda
      // cuando ya existe (procesarDiasPendientes la trae, aunque no haya
      // cerrado un día nuevo esta vez); así Métricas siempre tiene el
      // último cierre disponible sin depender de que hoy se cierre otro.
      ...(base.ultimoCierre ? { ultimoCierre: base.ultimoCierre } : {}),
      // Bono/deuda de un solo día (cuadragésima tercera tanda, cont.):
      // a diferencia de `ultimoCierre`, este SÍ puede volver a caer en 0
      // después de usarse (igual que ya se documentó cuando se intentó
      // la primera vez en la 39ª tanda) -- por eso se manda siempre, sin
      // ningún `if`, para no dejar en Firestore un bono/deuda viejo ya
      // resuelto que nunca se vuelve a limpiar.
      bonoGastosPendiente: base.bonoGastosPendiente || 0,
    }).catch((e) => console.error('No se pudieron guardar los bolsillos', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, base?.ultimoProcesado, base?.saldoWhimms, base?.saldoGastos, base?.saldoPagosFijos, JSON.stringify(base?.correccionesAplicadas || [])])

  if (!base) return { saldoWhimms: 0, saldoGastos: 0, saldoPagosFijos: 0, metaGastosHoy: 0, ultimoCierre: null, loading: true }
  const hoyView = bolsillosDeHoy(base, params, hoy)
  // `ultimoCierre` no lo calcula bolsillosDeHoy (es la vista en vivo de
  // HOY, que todavía no cierra) -- viene siempre de `base`, que lo trae
  // de procesarDiasPendientes (o null si la cuenta es nueva y ningún día
  // se ha cerrado todavía).
  return { ...hoyView, ultimoCierre: base.ultimoCierre || null, loading: false }
}
