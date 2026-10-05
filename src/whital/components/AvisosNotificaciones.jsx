import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '../hooks/useNotificaciones'

// Avisos flotantes (visibles en cualquier pantalla), de a pocos a la vez.
export default function AvisosNotificaciones() {
  const { visibles, descartar } = useNotificaciones()
  const navigate = useNavigate()
  if (!visibles.length) return null

  const ir = (a) => {
    descartar(a.clave)
    if (a.ir) navigate(a.ir.ruta, a.ir.estado ? { state: a.ir.estado } : undefined)
  }

  return (
    <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 45, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {visibles.map((a) => (
        <div key={a.clave} className="card card-solid" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: '3px solid var(--wine)', boxShadow: '0 6px 16px rgba(0,0,0,.18)' }}>
          <div style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>{a.texto}</div>
          {a.ir && <button style={{ fontSize: 12, color: 'var(--wine)', fontWeight: 700 }} onClick={() => ir(a)}>{a.tipo === 'registro' ? 'Registrar' : 'Ver'}</button>}
          <button style={{ fontSize: 11, color: 'var(--muted)' }} onClick={() => descartar(a.clave)}>Listo</button>
        </div>
      ))}
    </div>
  )
}
