import { IconHeart, IconReceipt, IconVitall } from '../../components/Icons'

const EJEMPLOS = {
  whimm: { Icono: IconHeart, titulo: 'Audífonos', sub: 'Whimm · te alcanza en 12 días', monto: '$1,299' },
  vitall: { Icono: IconVitall, titulo: 'Streaming', sub: 'Vitall · cada mes', monto: '$149' },
  gasto: { Icono: IconReceipt, titulo: 'Café', sub: 'Comida · hoy', monto: '$45' },
}

// Tarjeta de ejemplo (falsa) que se ve solo durante la guía animada si aún no hay datos.
// No se guarda en ninguna parte.
export default function EjemploGuia({ tipo }) {
  const { Icono, titulo, sub, monto } = EJEMPLOS[tipo]
  return (
    <div className="card" data-guia="fila" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="icon-tile" style={{ width: 38, height: 38 }}><Icono size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo} <span className="pill" style={{ background: 'var(--beige2)', color: 'var(--muted)', padding: '2px 8px', fontSize: 9, marginLeft: 4 }}>Ejemplo</span></div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{monto}</div>
    </div>
  )
}
