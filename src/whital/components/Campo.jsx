// Campo de formulario con etiqueta pequeña encima.
export default function Campo({ label, children, nota }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="eyebrow">{label}</span>
      {children}
      {nota && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{nota}</span>}
    </label>
  )
}

// Aviso con color (rojo = advertencia, ámbar = aviso, verde = info buena).
export function Aviso({ tono = 'amber', children }) {
  const colores = {
    red: { color: 'var(--red)', bg: 'var(--red-bg)' },
    amber: { color: 'var(--amber)', bg: 'var(--beige2)' },
    green: { color: 'var(--green)', bg: 'var(--green-bg)' },
  }[tono]
  return (
    <div style={{ background: colores.bg, color: colores.color, borderRadius: 10, padding: '10px 12px', fontSize: 12, lineHeight: 1.45 }}>
      {children}
    </div>
  )
}
