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
  const { x, dragging, handlers } = useSwipeX({ isOpen: abierto, onChange: setAbierto, lockThreshold: 16, dominancia: 2, abrirDesde: 0.7, cancelaTap: false, onTap: () => (abierto ? setAbierto(false) : onTap?.()) })

  return (
    <>
      <div style={{ position: 'relative', borderRadius: radio, overflow: 'hidden' }}>
        {/* La papelera ocupa solo lo que ya se destapó (nunca queda detrás de la fila),
            así no se ve a través de las tarjetas semitransparentes. */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: Math.max(0, -x), overflow: 'hidden', display: 'flex', justifyContent: 'flex-end', pointerEvents: abierto ? 'auto' : 'none', transition: dragging ? 'none' : 'width .12s ease' }}>
          <button aria-label="Eliminar" onClick={() => setConfirmando(true)} style={{ width: 72, flexShrink: 0, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
