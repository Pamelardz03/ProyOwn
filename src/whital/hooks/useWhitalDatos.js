import { useMemo } from 'react'
import { useUserCollection, useUserDoc } from '../../lib/firestoreCollections'

// Lee en vivo todo lo que el motor de Whital necesita. Cada pantalla recibe
// `datos` ya junto; el cálculo vive en lib/vista.js y lib/budget.js.
export function useWhitalDatos() {
  const gastos = useUserCollection('gastos')
  const sueldosFijos = useUserCollection('sueldosFijos')
  const sueldosRapidos = useUserCollection('sueldosRapidos')
  const pagosFijos = useUserCollection('pagosFijos')
  const whimms = useUserCollection('whimms')
  const ajustesSaldo = useUserCollection('ajustesSaldo')
  const config = useUserDoc('config', 'presupuesto')

  const loading = [gastos, sueldosFijos, sueldosRapidos, pagosFijos, whimms, ajustesSaldo, config].some((x) => x.loading)
  const error = [gastos, sueldosFijos, sueldosRapidos, pagosFijos, whimms, ajustesSaldo].map((x) => x.error).find(Boolean) || null

  const datos = useMemo(
    () => ({
      gastos: gastos.data,
      sueldosFijos: sueldosFijos.data,
      sueldosRapidos: sueldosRapidos.data,
      pagosFijos: pagosFijos.data,
      whimms: whimms.data,
      ajustesSaldo: ajustesSaldo.data,
      config: config.data,
    }),
    [gastos.data, sueldosFijos.data, sueldosRapidos.data, pagosFijos.data, whimms.data, ajustesSaldo.data, config.data]
  )

  return { datos, loading, error }
}
