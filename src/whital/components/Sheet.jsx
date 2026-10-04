import { IconClose } from '../../components/Icons'
import Modal from './Modal'

// Ventana de formulario (crear / editar): ahora en medio de la pantalla, igual que
// el detalle de un Whimm, y no desde abajo.
export default function Sheet({ abierto, onClose, titulo, children }) {
  return (
    <Modal abierto={abierto} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{titulo}</div>
        <button aria-label="Cerrar" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconClose />
        </button>
      </div>
      {children}
    </Modal>
  )
}
