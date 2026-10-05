import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { activarPush } from '../lib/push'
import { useNotificaciones } from '../hooks/useNotificaciones'

// Segundos que dura un aviso flotante antes de quitarse solo.
const DURACION_MS = 8000

// Avisos flotantes (visibles en cualquier pantalla), de a pocos a la vez. Cada uno se
// quita solo con un temporizador (la barrita de abajo muestra cuánto falta) y vuelve a
// salir cuando le toque según su frecuencia.
export default function AvisosNotificaciones() {
  const { visibles, descartar } = useNotificaciones()
  const navigate = useNavigate()
  const { user } = useAuth()
  const temporizadores = useRef(new Map())

  useEffect(() => {
    const vigentes = new Set(visibles.map((a) => a.clave))
    visibles.forEach((a) => {
      if (temporizadores.current.has(a.clave)) return
      temporizadores.current.set(a.clave, setTimeout(() => {
        temporizadores.current.delete(a.clave)
        descartar(a.clave)
      }, DURACION_MS))
    })
    temporizadores.current.forEach((t, clave) => {
      if (!vigentes.has(clave)) {
        clearTimeout(t)
        temporizadores.current.delete(clave)
      }
    })
  }, [visibles, descartar])

  useEffect(() => {
    const mapa = temporizadores.current
    return () => mapa.forEach((t) => clearTimeout(t))
  }, [])

  // Si ya diste permiso, se renueva el token de este dispositivo (sin pedir nada).
  useEffect(() => {
    if (user?.uid && typeof Notification !== 'undefined' && Notification.permission === 'granted') activarPush(user.uid, { pedirPermiso: false }).catch(() => {})
  }, [user?.uid])

  if (!visibles.length) return null

  const ir = (a) => {
    descartar(a.clave)
    if (a.ir) navigate(a.ir.ruta, a.ir.estado ? { state: a.ir.estado } : undefined)
  }

  return (
    <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 45, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {visibles.map((a) => (
        <div key={a.clave} className="card card-solid" style={{ position: 'relative', overflow: 'hidden', padding: '10px 12px 12px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: '3px solid var(--wine)', boxShadow: '0 6px 16px rgba(0,0,0,.18)' }}>
          <div style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>{a.texto}</div>
          {a.ir && <button style={{ fontSize: 12, color: 'var(--acento)', fontWeight: 700 }} onClick={() => ir(a)}>{a.tipo === 'registro' ? 'Registrar' : 'Ver'}</button>}
          <button style={{ fontSize: 11, color: 'var(--muted)' }} onClick={() => descartar(a.clave)}>Listo</button>
          <div style={{ position: 'absolute', left: 0, bottom: 0, height: 2, background: 'var(--wine4)', animation: `whital-barra ${DURACION_MS}ms linear forwards` }} />
        </div>
      ))}
    </div>
  )
}
