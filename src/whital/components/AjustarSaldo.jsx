import { useState } from 'react'
import { addUserDoc } from '../../lib/firestoreCollections'
import { calcularAjusteSaldo } from '../lib/budget'
import { fmt, parametrosMotor } from '../lib/vista'
import Campo from './Campo'

const signo = (n) => (n >= 0 ? '+' : '-') + fmt(Math.abs(n))

// Cuadra el saldo de la app con el que ves en tu banco: guarda la diferencia como un
// ajuste (queda en la lista de ajustes de Configuración y se puede eliminar).
export default function AjustarSaldo({ datos, hoy, user, show, saldoReal }) {
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState('')
  const numero = valor === '' ? null : Number(valor)
  const ajuste = numero != null && Number.isFinite(numero) ? calcularAjusteSaldo({ saldoBancoReal: numero, ...parametrosMotor(datos, hoy) }) : null

  const guardar = async () => {
    if (ajuste == null || Math.abs(ajuste) < 0.005) return
    try {
      await addUserDoc(user.uid, 'ajustesSaldo', { fecha: hoy, monto: ajuste, saldoBanco: numero, nota: 'Ajuste a mi banco' })
      show('Saldo ajustado')
      setAbierto(false)
      setValor('')
    } catch {
      show('No se pudo guardar el ajuste')
    }
  }

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div className="eyebrow">Saldo real en la app</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>{fmt(saldoReal)}</div>
        </div>
        {!abierto && <button className="pill" style={{ background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => setAbierto(true)}>Ajustar a mi banco</button>}
      </div>
      {abierto && (
        <>
          <Campo label="Saldo real en tu banco">
            <input className="fld" type="number" inputMode="decimal" placeholder="0" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Campo>
          {ajuste != null && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{Math.abs(ajuste) < 0.005 ? 'Ya coincide.' : `Diferencia: ${signo(ajuste)}`}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={() => { setAbierto(false); setValor('') }}>Cancelar</button>
            <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff', opacity: ajuste == null || Math.abs(ajuste) < 0.005 ? 0.45 : 1 }} disabled={ajuste == null || Math.abs(ajuste) < 0.005} onClick={guardar}>Guardar</button>
          </div>
        </>
      )}
    </div>
  )
}
