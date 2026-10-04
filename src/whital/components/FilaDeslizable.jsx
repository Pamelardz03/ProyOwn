import { useState } from 'react'
import { IconTrash } from '../../components/Icons'
import { useSwipeX } from '../../hooks/useSwipe'
import Modal from './Modal'

// Pregunta de confirmación (ventana en medio) antes de borrar algo.
export function ConfirmarEliminar({ titulo, mensaje = '¿Eliminar? No se puede deshacer.', onConfirmar, onCerrar }) {
  return (
    <Modal abierto onClose={onCerrar} nivel={2}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45, marginBottom: 18 }}>{mensaje}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={onCerrar}>Cancelar</button>
        <button className="segbtn" style={{ background: 'var(--red)', color: '#fff' }} onClick={onConfirmar}>Sí, eliminar</button>
      </div>
    </Modal>
  )
}

// Fila que se desliza a la izquierda para mostrar la papelera roja (como en la app
// original). Tocar la papelera pide confirmación; tocar la fila ejecuta `onTap`.
export default function FilaDeslizable({ children, onEliminar, titulo, mensaje, onTap, radio = 0 }) {
  const [abierto, setAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const { x, dragging, handlers } = useSwipeX({ isOpen: abierto, onChange: setAbierto, onTap: () => (abierto ? setAbierto(false) : onTap?.()) })

  return (
    <>
      <div style={{ position: 'relative', borderRadius: radio, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end', opacity: x < -4 ? 1 : 0, pointerEvents: abierto ? 'auto' : 'none', transition: dragging ? 'none' : 'opacity .12s ease' }}>
          <button aria-label="Eliminar" onClick={() => setConfirmando(true)} style={{ width: 72, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconTrash />
          </button>
        </div>
        <div {...handlers} style={{ position: 'relative', transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform .12s ease', touchAction: 'pan-y' }}>
          {children}
        </div>
      </div>
      {confirmando && (
        <ConfirmarEliminar
          titulo={titulo}
          mensaje={mensaje}
          onCerrar={() => setConfirmando(false)}
          onConfirmar={() => { setConfirmando(false); setAbierto(false); onEliminar() }}
        />
      )}
    </>
  )
}
