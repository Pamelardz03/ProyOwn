import { useState } from 'react'
import Toggle from '../../components/Toggle'
import { updateUserDoc } from '../../lib/firestoreCollections'
import { diaSemanaCorto, fechaCorta, fmt } from '../lib/vista'

const num = (v) => (v === '' || v == null ? 0 : Number(v))

// Una ocurrencia de una serie recurrente (Vitall o sueldo fijo) con sus dos
// excepciones puntuales: omitir esa fecha y cambiar el monto de esa fecha.
//   coleccion: 'pagosFijos' | 'sueldosFijos'      entidad: el documento de la serie
//   ocurrencia: { fecha, monto, omitida }         nombre: texto opcional a la izquierda
export default function FilaExcepcion({ coleccion, entidad, ocurrencia, hoy, user, show, nombre, verbo = 'esta fecha' }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const exc = entidad.excepciones?.[ocurrencia.fecha] || {}
  const tieneMonto = exc.montoReal != null || exc.monto != null

  const escribir = async (nueva, mensaje) => {
    try {
      await updateUserDoc(user.uid, coleccion, entidad.id, { [`excepciones.${ocurrencia.fecha}`]: nueva })
      show(mensaje)
      return true
    } catch {
      show('No se pudo guardar la excepción')
      return false
    }
  }

  return (
    <div style={{ padding: '9px 0', borderTop: '1px solid var(--beige2)', opacity: ocurrencia.omitida ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{diaSemanaCorto(ocurrencia.fecha)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fechaCorta(ocurrencia.fecha)}{ocurrencia.fecha < hoy ? ' · pasó' : ''}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {nombre && <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>}
          <div className="mono" style={{ fontSize: 13, textDecoration: ocurrencia.omitida ? 'line-through' : 'none' }}>{fmt(ocurrencia.monto)}</div>
          {tieneMonto && <div style={{ fontSize: 10, color: 'var(--amber)' }}>monto ajustado (base {fmt(entidad.monto)})</div>}
        </div>
        <button style={{ fontSize: 11, color: 'var(--wine)', fontWeight: 600 }} onClick={() => { setEditando(!editando); setValor(String(ocurrencia.monto)) }}>Cambiar monto</button>
        <Toggle
          on={ocurrencia.omitida}
          onClick={() => escribir({ ...exc, omitida: !ocurrencia.omitida }, ocurrencia.omitida ? 'Fecha restaurada' : 'Fecha omitida')}
          ariaLabel={ocurrencia.omitida ? `Restaurar ${verbo}` : `Omitir ${verbo}`}
        />
      </div>
      {editando && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="fld" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          <button className="segbtn" style={{ flex: 'none', padding: '0 14px', background: 'var(--wine)', color: '#fff' }} onClick={async () => { if (await escribir({ omitida: !!exc.omitida, montoReal: num(valor) }, 'Monto de esa fecha actualizado')) setEditando(false) }}>Guardar</button>
          {tieneMonto && <button className="segbtn" style={{ flex: 'none', padding: '0 12px', background: 'var(--beige2)' }} onClick={async () => { if (await escribir({ omitida: !!exc.omitida }, 'Monto restablecido')) setEditando(false) }}>Restablecer</button>}
        </div>
      )}
    </div>
  )
}
