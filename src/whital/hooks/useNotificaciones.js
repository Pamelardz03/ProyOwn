import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayISO } from '../lib/budget'
import { generarAlertas } from '../lib/notificaciones'
import { calcularVistaInicio } from '../lib/vista'
import { useWhitalDatos } from './useWhitalDatos'

const PREFIJO = 'whital:n:'
const DIA_MS = 24 * 3600 * 1000
const MAX_A_LA_VEZ = 3

function leer(clave, defecto) {
  try {
    const v = localStorage.getItem(PREFIJO + clave)
    return v == null ? defecto : JSON.parse(v)
  } catch {
    return defecto
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento: los avisos solo cuentan en esta sesión */
  }
}

// Notificación del sistema (si hay permiso). Pasa por el service worker para que
// funcione en Android con la app instalada; al tocarla abre la app.
async function notificarSistema(alerta) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const opciones = { body: alerta.texto, tag: alerta.clave, icon: `${import.meta.env.BASE_URL}icon-192.png`, data: { url: alerta.ir?.ruta === '/gastos' && alerta.ir.estado?.nuevo ? './?ir=gastos&nuevo=1' : './' } }
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) await reg.showNotification('Whital', opciones)
    else new Notification('Whital', opciones)
  } catch {
    /* si el navegador no deja mostrarla, queda el aviso dentro de la app */
  }
}

// Revisa cada 15 s qué avisos tocan según la frecuencia de cada tipo (o la propia
// del producto) y los muestra de a pocos. Funciona con la app abierta o en segundo
// plano; con la app cerrada del todo haría falta push (FCM).
export function useNotificaciones() {
  const { datos, loading } = useWhitalDatos()
  const [visibles, setVisibles] = useState([])
  const [inicioMs] = useState(() => Date.now())
  const general = useMemo(
    () => ({ ...(datos.config?.recordatorioCadaMin != null ? { registro: datos.config.recordatorioCadaMin } : {}), ...(datos.config?.notificaciones || {}) }),
    [datos.config]
  )

  useEffect(() => {
    if (loading) return undefined
    const revisar = () => {
      const ahora = Date.now()
      const hoy = todayISO()
      const vista = calcularVistaInicio(datos, hoy)

      // Cambios de fecha de compra: se compara con la última fecha vista de cada Whimm.
      const previas = leer('fechas', {})
      const cambios = leer('cambiosFecha', [])
      const actuales = {}
      vista.colaDetallada.forEach((r) => {
        actuales[r.id] = r.fechaProyectada
        const antes = previas[r.id]
        if (antes && r.fechaProyectada && antes !== r.fechaProyectada) cambios.push({ id: r.id, de: antes, a: r.fechaProyectada, ts: ahora })
      })
      guardar('fechas', actuales)
      const vigentes = cambios.filter((c) => ahora - c.ts < DIA_MS).slice(-30)
      guardar('cambiosFecha', vigentes)

      const alertas = generarAlertas({ datos, vista, hoyISO: hoy, ahoraMs: ahora, inicioMs, general, cambiosFecha: vigentes })
      const vivas = new Set(alertas.map((a) => a.clave))
      const nuevas = []
      for (const a of alertas) {
        if (nuevas.length >= MAX_A_LA_VEZ) break
        const ultimo = leer(`ultimo:${a.clave}`, 0)
        if ((a.unico && ultimo > 0) || ahora < ultimo + a.cadaMin * 60000) continue
        guardar(`ultimo:${a.clave}`, ahora)
        nuevas.push(a)
        notificarSistema(a)
      }
      setVisibles((prev) => [...prev.filter((p) => vivas.has(p.clave) && !nuevas.some((n) => n.clave === p.clave)), ...nuevas].slice(-MAX_A_LA_VEZ))
    }
    revisar()
    const timer = setInterval(revisar, 15000)
    return () => clearInterval(timer)
  }, [loading, datos, general, inicioMs])

  const descartar = useCallback((clave) => setVisibles((prev) => prev.filter((p) => p.clave !== clave)), [])
  return { visibles, descartar }
}
