import { useEffect, useState } from 'react'
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
const PASOS = 6

// Cuenta nueva = sin terminar estos pasos y sin nada registrado.
const esNueva = (datos) => !datos.config?.bienvenidaHecha && COLECCIONES.every((c) => (datos[c] || []).length === 0)

const CANTIDADES = [1, 2, 3, 4]
const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual']
const PAGOS_POR_MES = { Semanal: 4.33, Quincenal: 2, Mensual: 1 }
// Qué le importa más a la persona. Se guarda en config.perfil.prioridad (por ahora solo para conocer a los usuarios).
const PRIORIDADES = [
  ['gastar', 'Gastar sin culpa', 'Mi día a día'],
  ['whimms', 'Comprar mis Whimms', 'Lo que quiero'],
  ['pagos', 'Pagar mis deudas a tiempo', 'Sin atrasos'],
  ['ahorrar', 'Ahorrar', 'Guardar para después'],
]

const contenedor = { display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }
const titulo = { margin: 0, fontSize: 22 }
const chip = (activo) => ({ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, textAlign: 'center', background: activo ? 'var(--wine)' : 'var(--beige2)', color: activo ? '#fff' : 'var(--muted)' })

// Primeros pasos de una cuenta nueva: saldo, gasto semanal, qué le importa, ingresos y sueldo.
// Se decide una sola vez al abrir (para que no desaparezca a la mitad al guardar).
export default function PrimerosPasos() {
  const { user } = useAuth()
  const { datos, loading } = useWhitalDatos()
  const { message, show } = useToast()
  const [activo, setActivo] = useState(null)
  const [paso, setPaso] = useState(0)
  const [saldo, setSaldo] = useState('')
  const [presupuesto, setPresupuesto] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [mensual, setMensual] = useState('')
  const [frecuencia, setFrecuencia] = useState('Quincenal')
  const [guardando, setGuardando] = useState(false)

  // Cada paso es una entrada del historial: el botón o gesto de "atrás" del teléfono regresa al paso anterior
  // y nunca saca de los primeros pasos (en el primero se queda ahí).
  useEffect(() => {
    if (!activo) return undefined
    window.history.pushState({ onb: 0 }, '')
    const alRegresar = (e) => {
      if (typeof e.state?.onb === 'number') setPaso(e.state.onb)
      else {
        setPaso(0)
        window.history.pushState({ onb: 0 }, '')
      }
    }
    window.addEventListener('popstate', alRegresar)
    return () => window.removeEventListener('popstate', alRegresar)
  }, [activo])

  if (activo === null && !loading) setActivo(esNueva(datos))
  if (!activo) return null

  const hoy = todayISO()
  const nombre = (user?.displayName || '').split(' ')[0] || 'hola'

  const terminar = async () => {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { bienvenidaHecha: true, inicioFecha: datos.config?.inicioFecha || hoy })
    } catch {
      /* si no se pudo guardar, igual se cierra */
    }
    setActivo(false)
  }

  const irA = (n) => {
    window.history.pushState({ onb: n }, '')
    setPaso(n)
  }
  const atras = () => window.history.back()

  const guardarYSeguir = async (campos) => {
    setGuardando(true)
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', campos)
      irA(paso + 1)
    } catch {
      show('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const navegacion = (siguiente, habilitado) => (
    <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
      <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={atras}>Atrás</button>
      <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff', opacity: habilitado && !guardando ? 1 : 0.45 }} disabled={!habilitado || guardando} onClick={siguiente}>Siguiente</button>
    </div>
  )

  // Monto por cobro estimado para adelantar el formulario del sueldo (se puede cambiar ahí).
  const montoSugerido = num(mensual) > 0 ? Math.round(num(mensual) / cantidad / PAGOS_POR_MES[frecuencia]) : ''

  return (
    <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', zIndex: 70, background: 'var(--beige)', overflowY: 'auto', padding: '28px 22px calc(40px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 18 }}>
        {Array.from({ length: PASOS }, (_, i) => <span key={i} style={{ width: i === paso ? 22 : 7, height: 7, borderRadius: 4, background: i === paso ? 'var(--wine)' : 'var(--beige3)', transition: 'width .2s' }} />)}
      </div>

      {paso === 0 && (
        <div style={{ ...contenedor, alignItems: 'center', textAlign: 'center', justifyContent: 'center' }}>
          <LogoWhital size={72} animado={false} />
          <h1 style={{ margin: 0, fontSize: 26 }}>Hola, {nombre}</h1>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>5 preguntas y listo.</div>
          <div style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn-primary" onClick={() => irA(1)}>Empezar</button>
            <button style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }} onClick={terminar}>Ahora no</button>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div style={contenedor}>
          <h1 style={titulo}>¿Cuánto tienes hoy en tu banco?</h1>
          <Campo label="Saldo actual"><input className="fld" type="number" inputMode="decimal" placeholder="0" value={saldo} onChange={(e) => setSaldo(e.target.value)} autoFocus /></Campo>
          {navegacion(() => guardarYSeguir({ saldoInicial: num(saldo), inicioFecha: datos.config?.inicioFecha || hoy }), saldo !== '')}
        </div>
      )}

      {paso === 2 && (
        <div style={contenedor}>
          <h1 style={titulo}>¿Cuánto gastas por semana?</h1>
          <Campo label="Gasto semanal" nota={num(presupuesto) > 0 ? `Unos $${Math.round(num(presupuesto) / 7)} al día.` : 'Comida, transporte, gustos.'}>
            <input className="fld" type="number" inputMode="decimal" placeholder="Ej. 700" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} autoFocus />
          </Campo>
          {navegacion(() => guardarYSeguir({ presupuestoSemanal: num(presupuesto) }), num(presupuesto) > 0)}
        </div>
      )}

      {paso === 3 && (
        <div style={contenedor}>
          <h1 style={titulo}>¿Qué te importa más?</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PRIORIDADES.map(([id, texto, sub]) => (
              <button key={id} className="card" disabled={guardando} style={{ padding: 14, textAlign: 'left' }} onClick={() => guardarYSeguir({ perfil: { prioridad: id } })}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{texto}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
              </button>
            ))}
          </div>
          <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)', flex: 'none', marginTop: 'auto' }} onClick={atras}>Atrás</button>
        </div>
      )}

      {paso === 4 && (
        <div style={contenedor}>
          <h1 style={titulo}>Tus ingresos</h1>
          <Campo label="¿Cuántos sueldos o ingresos fijos tienes?">
            <div style={{ display: 'flex', gap: 8 }}>
              {CANTIDADES.map((n) => <button key={n} style={chip(cantidad === n)} onClick={() => setCantidad(n)}>{n === 4 ? '4 o más' : n}</button>)}
            </div>
          </Campo>
          <Campo label="¿Cuánto entra al mes, aproximado?">
            <input className="fld" type="number" inputMode="decimal" placeholder="Ej. 8000" value={mensual} onChange={(e) => setMensual(e.target.value)} />
          </Campo>
          <Campo label="¿Cada cuánto cobras?">
            <div style={{ display: 'flex', gap: 8 }}>
              {FRECUENCIAS.map((f) => <button key={f} style={chip(frecuencia === f)} onClick={() => setFrecuencia(f)}>{f}</button>)}
            </div>
          </Campo>
          {navegacion(() => guardarYSeguir({ perfil: { ingresosCantidad: cantidad, ingresoMensualAprox: num(mensual), frecuenciaPago: frecuencia } }), num(mensual) > 0)}
        </div>
      )}

      {paso === 5 && (
        <div style={contenedor}>
          <h1 style={titulo}>Registra tu sueldo</h1>
          <SueldoForm sueldo={{ monto: montoSugerido, frecuencia }} hoy={hoy} user={user} show={show} onCerrar={terminar} />
          <button style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }} onClick={terminar}>Omitir por ahora</button>
        </div>
      )}
      <Toast message={message} />
    </div>
  )
}
