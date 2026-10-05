import { FRECUENCIAS } from '../lib/notificaciones'
import Campo from './Campo'

// Frecuencia propia de un producto (Whimm, Vitall o sueldo): vacío = usar la general,
// "No avisar" = silenciarlo, o una frecuencia concreta que manda sobre la general.
export default function SelectorRecordatorio({ valor, onChange }) {
  return (
    <Campo label="Recordarme">
      <select className="fld" value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">General</option>
        {FRECUENCIAS.map((f) => <option key={f.min} value={String(f.min)}>{f.label}</option>)}
      </select>
    </Campo>
  )
}
