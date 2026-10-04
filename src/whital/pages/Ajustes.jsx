import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../../components/Toast'
import { IconChevronLeft, IconPlus } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, setUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import Campo, { Aviso } from '../components/Campo'
import Sheet from '../components/Sheet'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { PRESUPUESTO_SEMANAL_DEFAULT, generarFechasPago, ocurrenciasSueldo, todayISO } from '../lib/budget'
import { borrarDatos, hayDatosDePrueba, leerDatosDePrueba, sembrarDatos } from '../lib/seed'
import { fechaCorta, fmt } from '../lib/vista'

const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual']
const num = (v) => (v === '' || v == null ? 0 : Number(v))

function SueldoForm({ sueldo, hoy, user, show, onCerrar }) {
  const nuevo = !sueldo?.id
  const [name, setName] = useState(sueldo?.name || sueldo?.nombre || '')
  const [monto, setMonto] = useState(sueldo?.monto != null ? String(sueldo.monto) : '')
  const [frecuencia, setFrecuencia] = useState(sueldo?.frecuencia || 'Quincenal')
  const [fechaInicio, setFechaInicio] = useState(sueldo?.fechaInicio || hoy)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const detenido = !!sueldo?.fechaFin
  const puedeGuardar = name.trim() && num(monto) > 0 && !!fechaInicio

  const ejecutar = async (fn, mensaje) => {
    try {
      await fn()
      show(mensaje)
      onCerrar()
    } catch {
      show('No se pudo guardar')
    }
  }

  const guardar = () =>
    ejecutar(async () => {
      const base = { name: name.trim(), monto: num(monto), frecuencia, fechaInicio }
      const cambioCalendario = nuevo || frecuencia !== sueldo.frecuencia || fechaInicio !== sueldo.fechaInicio
      if (nuevo) {
        await addUserDoc(user.uid, 'sueldosFijos', { ...base, fechasPago: generarFechasPago({ frecuencia, fechaInicio }), excepciones: {}, notifFormal: false, notifMini: false })
      } else {
        await updateUserDoc(user.uid, 'sueldosFijos', sueldo.id, cambioCalendario ? { ...base, fechasPago: generarFechasPago({ frecuencia, fechaInicio }) } : base)
      }
    }, nuevo ? 'Sueldo agregado' : 'Sueldo actualizado')

  const detener = () => ejecutar(() => updateUserDoc(user.uid, 'sueldosFijos', sueldo.id, { fechaFin: hoy }), 'Detenido a partir de hoy (se conserva el historial)')
  const reanudar = () => ejecutar(() => updateUserDoc(user.uid, 'sueldosFijos', sueldo.id, { fechaFin: null }), 'Reanudado')
  const eliminar = () => ejecutar(() => deleteUserDoc(user.uid, 'sueldosFijos', sueldo.id), 'Sueldo eliminado')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Campo label="Nombre"><input className="fld" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sueldo, domingo de mi papá…" /></Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Monto"><input className="fld" type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}>
          <Campo label="Frecuencia">
            <select className="fld" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>{FRECUENCIAS.map((f) => <option key={f}>{f}</option>)}</select>
          </Campo>
        </div>
      </div>
      <Campo label="Cobra desde" nota={frecuencia === 'Quincenal' ? 'Quincenal = días 15 y último de cada mes, a partir de esta fecha.' : frecuencia === 'Semanal' ? 'Semanal = cada 7 días desde esta fecha (usa el primer día que cobraste).' : 'Mensual = el mismo día de cada mes.'}>
        <input className="fld" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
      </Campo>
      {!nuevo && (frecuencia !== sueldo.frecuencia || fechaInicio !== sueldo.fechaInicio) && (
        <Aviso tono="amber">Cambiar la frecuencia o la fecha de inicio vuelve a calcular todas las fechas de cobro. Las excepciones por fecha se conservan.</Aviso>
      )}
      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45 }} disabled={!puedeGuardar} onClick={guardar}>{nuevo ? 'Agregar sueldo' : 'Guardar cambios'}</button>
      {!nuevo && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Para omitir o cambiar un cobro de un día específico, ábrelo en Calendar.</div>
          {detenido
            ? <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={reanudar}>Reanudar (hoy dejó de cobrarse desde {fechaCorta(sueldo.fechaFin)})</button>
            : <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={detener}>Detener a partir de hoy (conserva el historial)</button>}
          <button style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmarEliminar ? eliminar() : setConfirmarEliminar(true))}>{confirmarEliminar ? 'Toca de nuevo para eliminar todo, incluido el historial' : 'Eliminar todo'}</button>
        </>
      )}
    </div>
  )
}

// Solo aparece en la cuenta de prueba (uid del archivo local de datos). Borra lo
// que haya y escribe los datos de prueba con la sesión actual.
function DatosDePrueba({ datos, user, show }) {
  const [seed, setSeed] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // 'recargar' | 'borrar'

  useEffect(() => {
    if (hayDatosDePrueba()) leerDatosDePrueba().then(setSeed)
  }, [])
  if (!seed || seed.uid !== user?.uid) return null

  const correr = async (cargar) => {
    setTrabajando(true)
    try {
      const borrados = await borrarDatos(user.uid, datos)
      const escritos = cargar ? await sembrarDatos(user.uid, seed) : 0
      show(cargar ? `Listo: ${borrados} borrados, ${escritos} cargados` : `${borrados} documentos borrados`)
    } catch {
      show('Algo falló a la mitad; revisa y vuelve a intentar')
    }
    setTrabajando(false)
    setConfirmar(null)
  }

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="eyebrow">Datos de prueba · solo esta cuenta</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
        Borra TODOS tus gastos, Whimms, Vitalls, sueldos y ajustes de esta cuenta y carga el escenario de prueba (tu historial real + el plan de Gemini).
      </div>
      <button className="btn-primary" disabled={trabajando} style={{ opacity: trabajando ? 0.5 : 1, background: confirmar === 'recargar' ? 'var(--red)' : 'var(--wine)' }} onClick={() => (confirmar === 'recargar' ? correr(true) : setConfirmar('recargar'))}>
        {trabajando ? 'Trabajando…' : confirmar === 'recargar' ? 'Toca de nuevo: borrar y cargar' : 'Borrar todo y cargar datos de prueba'}
      </button>
      <button disabled={trabajando} style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmar === 'borrar' ? correr(false) : setConfirmar('borrar'))}>
        {confirmar === 'borrar' ? 'Toca de nuevo para borrar todo' : 'Solo borrar todo (dejar la cuenta en blanco)'}
      </button>
    </div>
  )
}

export default function Ajustes() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [sheet, setSheet] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [saldoInicial, setSaldoInicial] = useState(null)

  const cfgPresupuesto = Number(datos.config?.presupuestoSemanal) > 0 ? Number(datos.config.presupuestoSemanal) : PRESUPUESTO_SEMANAL_DEFAULT
  const cfgSaldo = Number(datos.config?.saldoInicial) || 0
  const valorPresupuesto = presupuesto ?? String(cfgPresupuesto)
  const valorSaldo = saldoInicial ?? String(cfgSaldo)
  const cambioConfig = !loading && (num(valorPresupuesto) !== cfgPresupuesto || num(valorSaldo) !== cfgSaldo)

  const proximoCobro = (s) => ocurrenciasSueldo(s, `${new Date().getFullYear() + 3}-12-31`, hoy).find((o) => !o.omitida && o.fecha >= hoy)?.fecha

  const ajustes = useMemo(() => [...datos.ajustesSaldo].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')), [datos.ajustesSaldo])

  const guardarConfig = async () => {
    if (!(num(valorPresupuesto) > 0)) return show('El presupuesto debe ser mayor a 0')
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { presupuestoSemanal: num(valorPresupuesto), saldoInicial: num(valorSaldo) })
      setPresupuesto(null)
      setSaldoInicial(null)
      show('Configuración guardada')
    } catch {
      show('No se pudo guardar')
    }
  }

  const borrarAjuste = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'ajustesSaldo', id)
      show('Ajuste eliminado')
    } catch {
      show('No se pudo eliminar')
    }
  }

  return (
    <>
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => navigate('/')} aria-label="Volver"><IconChevronLeft /></button>
          <div>
            <div className="eyebrow">Whital</div>
            <h1>Ajustes</h1>
          </div>
        </div>
        {error && <Aviso tono="red">{error}</Aviso>}
        {loading && !error && <div className="empty-state">Cargando…</div>}

        {!loading && (
          <>
            <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="eyebrow">Dinero</div>
              <Campo label="Presupuesto semanal fijo" nota="Lo que te das para gastar de lunes a domingo. Lo demás queda libre para Whimms.">
                <input className="fld" type="number" inputMode="decimal" value={valorPresupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
              </Campo>
              <Campo label="Saldo inicial" nota="Lo que tenías en el banco el día que empezaste a registrar. Si no cuadra con tu banco hoy, usa 'Ajustar saldo a mi banco' en Inicio.">
                <input className="fld" type="number" inputMode="decimal" value={valorSaldo} onChange={(e) => setSaldoInicial(e.target.value)} />
              </Campo>
              <button className="btn-primary" style={{ opacity: cambioConfig ? 1 : 0.45 }} disabled={!cambioConfig} onClick={guardarConfig}>Guardar</button>
            </div>

            <div>
              <div className="eyebrow" style={{ margin: '0 2px 8px' }}>Sueldos fijos</div>
              {datos.sueldosFijos.length === 0
                ? <div className="empty-state">Sin sueldos todavía. Agrega el primero con el botón +.</div>
                : (
                  <div className="row-list">
                    {datos.sueldosFijos.map((s) => (
                      <button key={s.id} className="row-list-item" style={{ textAlign: 'left', width: '100%', opacity: s.fechaFin ? 0.55 : 1 }} onClick={() => setSheet({ sueldo: s })}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name || s.nombre}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {s.frecuencia}{s.fechaFin ? ` · detenido ${fechaCorta(s.fechaFin)}` : proximoCobro(s) ? ` · próximo ${fechaCorta(proximoCobro(s))}` : ''}
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(s.monto)}</div>
                      </button>
                    ))}
                  </div>
                )}
            </div>

            <div>
              <div className="eyebrow" style={{ margin: '0 2px 8px' }}>Ajustes de saldo a mi banco</div>
              {ajustes.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ninguno. Aparecen aquí cuando uses "Ajustar saldo a mi banco" en Inicio.</div>
                : (
                  <div className="row-list">
                    {ajustes.map((a) => (
                      <div key={a.id} className="row-list-item">
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{fechaCorta(a.fecha)}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{a.nota || 'Ajuste'}{a.saldoBanco != null ? ` · banco ${fmt(a.saldoBanco)}` : ''}</div>
                        </div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: a.monto < 0 ? 'var(--red)' : 'var(--green)' }}>{a.monto > 0 ? '+' : ''}{fmt(a.monto)}</div>
                        <button style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }} onClick={() => borrarAjuste(a.id)}>Quitar</button>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <DatosDePrueba datos={datos} user={user} show={show} />

            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="eyebrow">Cuenta</div>
                <div style={{ fontSize: 13, marginTop: 3 }}>{user?.email || 'Cuenta de prueba'}</div>
              </div>
              <button className="pill" style={{ background: 'var(--beige2)', color: 'var(--wine)' }} onClick={logout}>Cerrar sesión</button>
            </div>
          </>
        )}
      </div>

      <button className="fab" onClick={() => setSheet({})} aria-label="Agregar sueldo"><IconPlus /></button>
      <Sheet abierto={!!sheet} onClose={() => setSheet(null)} titulo={sheet?.sueldo ? sheet.sueldo.name || 'Sueldo' : 'Nuevo sueldo fijo'}>
        {sheet && <SueldoForm key={sheet.sueldo?.id || 'nuevo'} sueldo={sheet.sueldo} hoy={hoy} user={user} show={show} onCerrar={() => setSheet(null)} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
