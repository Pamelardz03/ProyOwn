import { IconClose } from '../../components/Icons'

// Hoja inferior reutilizable (usa las clases .sheet de index.css).
export default function Sheet({ abierto, onClose, titulo, children }) {
  if (!abierto) return null
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" style={{ maxHeight: '88%' }}>
        <div className="sheet-grabber"><span /></div>
        <div className="sheet-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{titulo}</div>
            <button className="back-btn" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
          </div>
          {children}
        </div>
      </div>
    </>
  )
}
