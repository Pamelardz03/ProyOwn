import { createPortal } from 'react-dom'

// Ventana en medio de la pantalla.
// `pie` son los botones fijos de abajo (Editar / Eliminar).
export default function Modal({ abierto, onClose, children, pie, nivel = 0 }) {
  if (!abierto) return null
  // Se dibuja directo en el contenedor de la app (no dentro de la hoja o ventana que la abrió)
  // para que no la recorte ninguna otra capa.
  const destino = typeof document !== 'undefined' ? document.querySelector('.app-shell') || document.body : null
  return createPortal(
    <>
      <div className="sheet-backdrop" style={{ zIndex: 40 + nivel * 10 }} onClick={onClose} />
      <div
        className="card-solid"
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          maxHeight: 'calc(100% - 80px)',
          borderRadius: 20,
          boxShadow: '0 12px 32px rgba(0,0,0,.28)',
          zIndex: 41 + nivel * 10,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
        {pie && <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--beige3)' }}>{pie}</div>}
      </div>
    </>,
    destino
  )
}
