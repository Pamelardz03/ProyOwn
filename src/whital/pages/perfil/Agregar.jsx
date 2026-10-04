import { useNavigate } from 'react-router-dom'
import { IconCard, IconHeart, IconPlus, IconReceipt, IconSalary, IconVitall } from '../../../components/Icons'
import EncabezadoSub from '../../components/EncabezadoSub'

const OPCIONES = [
  { texto: 'Gasto', Icono: IconReceipt, ir: ['/gastos', { nuevo: true }] },
  { texto: 'Whimm', Icono: IconHeart, ir: ['/whimms', { nuevo: true }] },
  { texto: 'Vitall', Icono: IconVitall, ir: ['/vitalls', { nuevo: 'suscripcion' }] },
  { texto: 'Pago a plazos', Icono: IconCard, ir: ['/vitalls', { nuevo: 'plazos' }] },
  { texto: 'Sueldo fijo', Icono: IconSalary, ir: ['/perfil/sueldos', { nuevo: 'sueldo' }] },
  { texto: 'Ingreso rápido', Icono: IconPlus, ir: ['/perfil/sueldos', { nuevo: 'rapido' }] },
]

// ¿Qué quieres agregar? Cada opción abre su formulario donde corresponde.
export default function Agregar() {
  const navigate = useNavigate()
  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <EncabezadoSub titulo="Agregar" />
        <div style={{ fontSize: 15, fontWeight: 600 }}>¿Qué quieres agregar?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPCIONES.map(({ texto, Icono, ir }) => (
            <button key={texto} className="pick-option" onClick={() => navigate(ir[0], { state: ir[1] })}>
              <span className="icon"><Icono color="#fff" /></span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{texto}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
