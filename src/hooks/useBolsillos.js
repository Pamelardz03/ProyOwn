import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { setUserDoc } from '../lib/firestoreCollections'
import { todayISO } from '../lib/date'
import { inicializarBolsillos, procesarDiasPendientes, bolsillosDeHoy } from '../lib/budget'

// Bolsillos independientes de Whimms/gastos (trigésima segunda tanda) —
// ver el comentario grande en src/lib/budget.js para la explicación
// completa. Este hook es el único punto de la app que lee/escribe
// `saldoWhimms`/`saldoGastos`/`ultimoProcesado` de config/presupuesto:
// asienta los días ya pasados (si hace falta) y devuelve la vista en vivo
// de hoy para pintar en pantalla. Cada página que necesite "disponible
// para whimms"/"disponible para gastos" debe usar este hook en vez de
// leer esos campos directo o recalcular con las funciones viejas de foto
// instantánea (`disponibleParaWhimms`/`bufferGastoHormiga`, que siguen
// existiendo solo por si algo más las necesita, pero ya no alimentan la
// UI real).
export function useBolsillos({ configPresupuesto, loadingConfig, sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms }) {
  const { user } = useAuth()
  const ultimaEscrituraRef = useRef(null)
  const hoy = todayISO()
  const params = { sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms }

  const listo = !loadingConfig
  const necesitaSemilla = listo && configPresupuesto?.ultimoProcesado == null

  const base = necesitaSemilla
    ? inicializarBolsillos(params, hoy)
    : listo && configPresupuesto
      ? procesarDiasPendientes({
          saldoWhimms: configPresupuesto.saldoWhimms,
          saldoGastos: configPresupuesto.saldoGastos,
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

  useEffect(() => {
    if (!user || !base) return
    const yaGuardado = configPresupuesto?.ultimoProcesado === base.ultimoProcesado
      && configPresupuesto?.saldoWhimms === base.saldoWhimms
      && configPresupuesto?.saldoGastos === base.saldoGastos
    if (yaGuardado) return
    const key = `${base.ultimoProcesado}-${base.saldoWhimms}-${base.saldoGastos}`
    if (ultimaEscrituraRef.current === key) return
    ultimaEscrituraRef.current = key
    setUserDoc(user.uid, 'config', 'presupuesto', {
      saldoWhimms: base.saldoWhimms,
      saldoGastos: base.saldoGastos,
      ultimoProcesado: base.ultimoProcesado,
    }).catch((e) => console.error('No se pudieron guardar los bolsillos', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, base?.ultimoProcesado, base?.saldoWhimms, base?.saldoGastos])

  if (!base) return { saldoWhimms: 0, saldoGastos: 0, metaGastosHoy: 0, loading: true }
  const hoyView = bolsillosDeHoy(base, params, hoy)
  return { ...hoyView, loading: false }
}
