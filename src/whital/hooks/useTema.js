import { useEffect, useMemo, useState } from 'react'
import { useUserDoc } from '../../lib/firestoreCollections'
import { FONDOS, TEMA_DEFECTO, fondoValido, paletaValida } from '../lib/temas'

const CLAVE = 'whital:tema'

function leerLocal() {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE) || '{}')
    return { paleta: paletaValida(t.paleta) ? t.paleta : TEMA_DEFECTO.paleta, fondo: fondoValido(t.fondo) ? t.fondo : TEMA_DEFECTO.fondo }
  } catch {
    return TEMA_DEFECTO
  }
}

export function guardarTemaLocal(tema) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(tema))
  } catch {
    /* sin almacenamiento: el tema queda solo en la nube */
  }
}

// Tema activo: el guardado en tu cuenta (se sincroniza entre dispositivos) y, mientras
// carga, el último que se usó en este dispositivo para que no parpadee.
export function useTema() {
  const { data: config } = useUserDoc('config', 'presupuesto')
  const [local] = useState(leerLocal)
  const rPaleta = config?.tema?.paleta
  const rFondo = config?.tema?.fondo
  const tema = useMemo(
    () => ({
      paleta: paletaValida(rPaleta) ? rPaleta : local.paleta,
      fondo: fondoValido(rFondo) ? rFondo : local.fondo,
    }),
    [rPaleta, rFondo, local]
  )

  useEffect(() => {
    guardarTemaLocal(tema)
    // El fondo también detrás de la app (bordes en pantallas anchas) y la barra del sistema.
    const f = FONDOS.find((x) => x.id === tema.fondo)
    const anterior = document.body.style.background
    const meta = document.querySelector('meta[name="theme-color"]')
    const metaAntes = meta?.getAttribute('content')
    document.body.style.background = f.fondo
    meta?.setAttribute('content', f.barra)
    return () => {
      document.body.style.background = anterior
      if (meta && metaAntes) meta.setAttribute('content', metaAntes)
    }
  }, [tema])

  return tema
}
