import { useState } from 'react'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { setUserDoc } from '../../lib/firestoreCollections'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { todayISO } from '../lib/budget'
import { SueldoForm } from '../pages/perfil/piezas'
import Campo from './Campo'
import LogoWhital from './LogoWhital'

const num = (v) => (v === '' || v == null ? 0 : Number(v))
const COLECCIONES = ['gastos', 'sueldosFijos', 'sueldosRapidos', 'pagosFijos', 'whimms', 'ajustesSaldo']

// Una cuenta es nueva si no tiene nada registrado ni terminó estos pasos.
const esNueva = (datos) => !datos.config?.bienvenidaHecha && !datos.config?.saldoInicial && COLECCIONES.every((c) => (datos[c] || []).length === 0)

const IDEAS = [
  ['Para gastar hoy', 'Cuánto puedes gastar hoy sin pasarte de tu presupuesto.'],
  ['Whimms', 'Lo que quieres comprar. Whital los pone en fila y te dice cuándo ya te alcanza.'],
  ['Vitalls', 'Tus pagos fijos y suscripciones, para que no te tomen por sorpresa.'],
]

// Primeros pasos para una cuenta nueva: bienvenida, saldo, presupuesto semanal y sueldo.
// Se decide una sola vez al abrir (para que no desaparezca a la mitad al guardar el saldo).
export default function PrimerosPasos() {
  const { user } = useAuth()
  const { datos, loading } = useWhitalDatos()
  const { message, show } = useToast()
  const [activo, setActivo] = useState(null)
  const [paso, setPaso] = useState(0)
  const [saldo, setSaldo] = useState('')
  const [presupuesto, setPresupuesto] = useState('')
  const [guardando, setGuardando] = useState(false)

  if (activo === null && !loading) setActivo(esNueva(datos))
  if (!activo) return null

  const hoy = todayISO()
  const nombre = (user?.displayName || '').split(' ')[0] || 'hola'

  const terminar = async () => {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { bienvenidaHecha: true })
    } catch {
      /* si no se pudo guardar, igual se cierra: la cuenta ya tiene sus datos */
    }
    setActivo(false)
  }

  const guardarYSeguir = async (campos) => {
    setGuardando(true)
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', campos)
      setPaso((p) => p + 1)
    } catch {
      show('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const boton = { width: '100%' }
  const puntos = (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 18 }}>
      {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: i === paso ? 22 : 7, height: 7, borderRadius: 4, background: i === paso ? 'var(--wine)' : 'var(--beige3)', transition: 'width .2s' }} />)}
    </div>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'var(--beige)', overflowY: 'auto', padding: '28px 22px 40px', display: 'flex', flexDirection: 'column' }}>
      {puntos}

      {paso === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <LogoWhital size={64} animado={false} />
            <h1 style={{ margin: 0, fontSize: 24 }}>Hola, {nombre}</h1>
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>Vamos a dejar Whital listo en un minuto.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {IDEAS.map(([titulo, texto]) => (
              <div key={titulo} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.45 }}>{texto}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn-primary" style={boton} onClick={() => setPaso(1)}>Empezar</button>
            <button style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }} onClick={terminar}>Ahora no</button>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>¿Cuánto tienes hoy en tu banco?</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>Es tu punto de partida. Después lo puedes ajustar cuando quieras desde Perfil.</div>
          <Campo label="Saldo actual"><input className="fld" type="number" inputMode="decimal" placeholder="0" value={saldo} onChange={(e) => setSaldo(e.target.value)} autoFocus /></Campo>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
            <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={() => setPaso(0)}>Atrás</button>
            <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff', opacity: saldo !== '' && !guardando ? 1 : 0.45 }} disabled={saldo === '' || guardando} onClick={() => guardarYSeguir({ saldoInicial: num(saldo) })}>Siguiente</button>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>¿Cuánto quieres gastar por semana?</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>Para tus gastos del día a día: comida, transporte, gustos. Lo que no gastes queda libre para tus Whimms.</div>
          <Campo label="Presupuesto semanal" nota={num(presupuesto) > 0 ? `Son unos $${Math.round(num(presupuesto) / 7)} al día.` : null}>
            <input className="fld" type="number" inputMode="decimal" placeholder="Ej. 700" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} autoFocus />
          </Campo>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
            <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={() => setPaso(1)}>Atrás</button>
            <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff', opacity: num(presupuesto) > 0 && !guardando ? 1 : 0.45 }} disabled={!(num(presupuesto) > 0) || guardando} onClick={() => guardarYSeguir({ presupuestoSemanal: num(presupuesto) })}>Siguiente</button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>¿Cuándo te pagan?</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>Con tu sueldo, Whital calcula cuándo te alcanzará cada compra. Puedes agregar más ingresos después en Perfil.</div>
          <SueldoForm hoy={hoy} user={user} show={show} onCerrar={terminar} />
          <button style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }} onClick={terminar}>Omitir por ahora</button>
        </div>
      )}
      <Toast message={message} />
    </div>
  )
}
