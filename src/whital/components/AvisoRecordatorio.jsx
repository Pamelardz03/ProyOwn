import { useNavigate } from 'react-router-dom'
import { useRecordatorioRegistro } from '../hooks/useRecordatorioRegistro'

// Aviso flotante (visible en cualquier pantalla) cuando toca registrar gastos.
export default function AvisoRecordatorio() {
  const { aviso, descartar } = useRecordatorioRegistro()
  const navigate = useNavigate()
  if (!aviso) return null
  return (
    <div className="card card-solid" style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 45, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: '3px solid var(--wine)', boxShadow: '0 6px 16px rgba(0,0,0,.18)' }}>
      <div style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>{aviso}</div>
      <button style={{ fontSize: 12, color: 'var(--wine)', fontWeight: 700 }} onClick={() => { descartar(); navigate('/gastos', { state: { nuevo: true } }) }}>Registrar</button>
      <button style={{ fontSize: 11, color: 'var(--muted)' }} onClick={descartar}>Después</button>
    </div>
  )
}
