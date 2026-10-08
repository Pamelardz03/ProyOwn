import { useNavigate } from 'react-router-dom'
import { IconCard, IconHeart, IconPlus, IconReceipt, IconSalary, IconVitall } from '../../components/Icons'
import Modal from './Modal'

// Cada opción abre su formulario donde corresponde (la pantalla lee `state.nuevo`).
const OPCIONES = [
  { texto: 'Gasto', Icono: IconReceipt, ir: ['/gastos', { nuevo: true }] },
  { texto: 'Whimm', Icono: IconHeart, ir: ['/whimms', { nuevo: true }] },
  { texto: 'Vitall', Icono: IconVitall, ir: ['/vitalls', { nuevo: 'suscripcion' }] },
  { texto: 'Pago a plazos', Icono: IconCard, ir: ['/vitalls', { nuevo: 'plazos' }] },
  { texto: 'Sueldo fijo', Icono: IconSalary, ir: ['/perfil/sueldos', { nuevo: 'sueldo' }] },
  { texto: 'Ingreso rápido', Icono: IconPlus, ir: ['/perfil/sueldos', { nuevo: 'rapido' }] },
]

// Ventana del botón + del menú de abajo: ¿qué quieres agregar?
export default function MenuAgregar({ abierto, onClose }) {
  const navigate = useNavigate()
  return (
    <Modal abierto={abierto} onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>¿Qué quieres agregar?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OPCIONES.map(({ texto, Icono, ir }) => (
          <button key={texto} className="pick-option" onClick={() => { onClose(); navigate(ir[0], { state: ir[1] }) }}>
            <span className="icon"><Icono color="#fff" /></span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{texto}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
