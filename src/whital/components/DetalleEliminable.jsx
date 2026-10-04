import { IconClose } from '../../components/Icons'
import { fmt } from '../lib/vista'
import BotonEliminar from './BotonEliminar'
import Modal from './Modal'

// Ventana sencilla para un movimiento suelto (ingreso rápido, ajuste de saldo):
// muestra el dato y deja eliminarlo con el botón de siempre.
export default function DetalleEliminable({ titulo, sub, monto, mensaje, onEliminar, onCerrar }) {
  return (
    <Modal abierto onClose={onCerrar} nivel={1}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{titulo}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        <button aria-label="Cerrar" onClick={onCerrar} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconClose />
        </button>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500, marginBottom: 18 }}>{monto > 0 ? '+' : ''}{fmt(monto)}</div>
      <BotonEliminar mensaje={mensaje} onConfirmar={onEliminar} />
    </Modal>
  )
}
