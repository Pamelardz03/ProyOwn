import { useState } from 'react'
import { IconTrash } from '../../components/Icons'

// ÚNICO botón para eliminar en toda la app: pieza a lo largo, en rojo suave, abajo.
// Al tocarlo pide confirmación con un mensaje; solo "Sí, eliminar" borra.
export default function BotonEliminar({ texto = 'Eliminar', mensaje = '¿Seguro? No se puede deshacer.', onConfirmar, deshabilitado }) {
  const [pidiendo, setPidiendo] = useState(false)

  if (!pidiendo) {
    return (
      <button
        disabled={deshabilitado}
        onClick={() => setPidiendo(true)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--red-bg)', borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 600, color: 'var(--red)', opacity: deshabilitado ? 0.5 : 1 }}
      >
        <IconTrash size={13} color="var(--red)" /> {texto}
      </button>
    )
  }
  return (
    <div style={{ width: '100%', background: 'var(--red-bg)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.4, fontWeight: 500 }}>{mensaje}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="segbtn" style={{ background: '#fff', color: 'var(--muted)' }} onClick={() => setPidiendo(false)}>Cancelar</button>
        <button className="segbtn" style={{ background: 'var(--red)', color: '#fff' }} onClick={onConfirmar}>Sí, eliminar</button>
      </div>
    </div>
  )
}
