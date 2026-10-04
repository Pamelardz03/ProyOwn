import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUserCollection, useUserDoc } from '../../lib/firestoreCollections'
import { CADENCIA_DEFAULT_MIN, aMillis, decidirRecordatorio } from '../lib/recordatorio'

const CLAVE_ULTIMO_AVISO = 'whital:ultimo-aviso-registro'

function leerUltimoAviso() {
  try {
    return Number(localStorage.getItem(CLAVE_ULTIMO_AVISO)) || 0
  } catch {
    return 0
  }
}

function guardarUltimoAviso(ms) {
  try {
    localStorage.setItem(CLAVE_ULTIMO_AVISO, String(ms))
  } catch {
    /* sin almacenamiento: el aviso solo cuenta en esta sesión */
  }
}

// Notificación del sistema (si hay permiso). Pasa por el service worker para que
// funcione en Android con la app instalada; al tocarla abre el formulario de gasto.
async function notificar(texto) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const opciones = { body: texto, tag: 'whital-registro', icon: `${import.meta.env.BASE_URL}icon-192.png`, data: { url: './?ir=gastos&nuevo=1' } }
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) await reg.showNotification('Whital', opciones)
    else new Notification('Whital', opciones)
  } catch {
    /* si el navegador no deja mostrarla, queda el aviso dentro de la app */
  }
}

// Revisa cada 15 s si toca recordar que registres gastos, según la frecuencia
// elegida en Ajustes (config/presupuesto.recordatorioCadaMin).
export function useRecordatorioRegistro() {
  const gastos = useUserCollection('gastos')
  const config = useUserDoc('config', 'presupuesto')
  const [aviso, setAviso] = useState(null)
  const [abiertoEn] = useState(() => Date.now())

  const cadaMin = config.data?.recordatorioCadaMin ?? CADENCIA_DEFAULT_MIN
  const ultimoRegistro = useMemo(() => gastos.data.reduce((max, g) => Math.max(max, aMillis(g.creadoEn)), 0), [gastos.data])
  const listo = !gastos.loading && !config.loading
  // El aviso solo vale para este último registro y esta frecuencia: si registras
  // un gasto o cambias la frecuencia, deja de mostrarse sin necesidad de un efecto.
  const marca = `${ultimoRegistro}-${cadaMin}`

  useEffect(() => {
    if (!listo || !(cadaMin > 0)) return
    const revisar = () => {
      const ahora = Date.now()
      const r = decidirRecordatorio({ ahora, cadaMin, ultimoRegistro: ultimoRegistro || abiertoEn, ultimoAviso: leerUltimoAviso() })
      if (!r.debe) return
      guardarUltimoAviso(ahora)
      setAviso({ texto: r.texto, marca })
      notificar(r.texto)
    }
    revisar()
    const timer = setInterval(revisar, 15000)
    return () => clearInterval(timer)
  }, [listo, cadaMin, ultimoRegistro, abiertoEn, marca])

  const descartar = useCallback(() => setAviso(null), [])
  return { aviso: aviso?.marca === marca ? aviso.texto : null, descartar }
}
