// Ventana en medio de la pantalla (como el detalle de Whimm de la app original).
// `pie` son los botones fijos de abajo (Editar / Eliminar).
export default function Modal({ abierto, onClose, children, pie, nivel = 0 }) {
  if (!abierto) return null
  return (
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
    </>
  )
}
