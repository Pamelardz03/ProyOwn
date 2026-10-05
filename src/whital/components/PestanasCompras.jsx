import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CLAVE_COMPRAS } from '../lib/ultimaCompras'

// Interruptor de arriba para cambiar entre Whimms y Vitalls (como en la primera app).
export default function PestanasCompras({ activa }) {
  const navigate = useNavigate()
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_COMPRAS, activa === 'vitalls' ? '/vitalls' : '/whimms')
    } catch {
      /* sin almacenamiento */
    }
  }, [activa])

  const opciones = [['whimms', 'Whimms', '/whimms'], ['vitalls', 'Vitalls', '/vitalls']]
  return (
    <div style={{ display: 'flex', gap: 6, background: 'var(--beige2)', borderRadius: 14, padding: 4 }}>
      {opciones.map(([id, texto, ruta]) => (
        <button
          key={id}
          className="segbtn"
          aria-pressed={activa === id}
          style={{ background: activa === id ? 'var(--wine)' : 'transparent', color: activa === id ? '#fff' : 'var(--muted)', padding: '10px 0', fontSize: 13 }}
          onClick={() => activa !== id && navigate(ruta, { replace: true })}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}
