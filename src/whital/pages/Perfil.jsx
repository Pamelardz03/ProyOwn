import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Toast from '../../components/Toast'
import { IconCard, IconChevronRight, IconClock, IconHeart, IconPlus, IconReceipt, IconSalary, IconVitall } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, setUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import Campo, { Aviso } from '../components/Campo'
import Sheet from '../components/Sheet'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { gastoNeto, generarFechasPago, ocurrenciasSueldo, todayISO } from '../lib/budget'
import { calcularMetricas } from '../lib/metricas'
import { CADENCIA_DEFAULT_MIN, OPCIONES_RECORDATORIO } from '../lib/recordatorio'
import { borrarDatos, hayDatosDePrueba, leerDatosDePrueba, sembrarDatos } from '../lib/seed'
import { calcularVistaInicio, fechaCorta, fmt, parametrosMotor } from '../lib/vista'

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
      <Campo label="Cobra desde">
        <input className="fld" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
      </Campo>
      {!nuevo && (frecuencia !== sueldo.frecuencia || fechaInicio !== sueldo.fechaInicio) && (
        <Aviso tono="amber">Se recalcularán las fechas de cobro (las excepciones se conservan).</Aviso>
      )}
      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45 }} disabled={!puedeGuardar} onClick={guardar}>{nuevo ? 'Agregar sueldo' : 'Guardar cambios'}</button>
      {!nuevo && (
        <>
          {detenido
            ? <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={reanudar}>Reanudar (detenido desde {fechaCorta(sueldo.fechaFin)})</button>
            : <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={detener}>Detener a partir de hoy</button>}
          <button style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmarEliminar ? eliminar() : setConfirmarEliminar(true))}>{confirmarEliminar ? 'Toca de nuevo para eliminar todo, incluido el historial' : 'Eliminar todo'}</button>
        </>
      )}
    </div>
  )
}

// Cada cuánto recordar que registres gastos. Suena mientras la app esté abierta o
// en segundo plano; con la app cerrada del todo haría falta push (FCM).
function Recordatorios({ config, user, show }) {
  const actual = config?.recordatorioCadaMin ?? CADENCIA_DEFAULT_MIN
  const [permiso, setPermiso] = useState(typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission)

  const cambiar = async (min) => {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { recordatorioCadaMin: min })
      show(min > 0 ? 'Recordatorio guardado' : 'Recordatorio apagado')
    } catch {
      show('No se pudo guardar')
    }
  }
  const pedirPermiso = async () => {
    if (typeof Notification === 'undefined') return
    setPermiso(await Notification.requestPermission())
  }

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="eyebrow">Recordatorios</div>
      <Campo label="Recordarme registrar mis gastos">
        <select className="fld" value={actual} onChange={(e) => cambiar(Number(e.target.value))}>
          {OPCIONES_RECORDATORIO.map((o) => <option key={o.min} value={o.min}>{o.label}</option>)}
        </select>
      </Campo>
      {permiso === 'granted' && <Aviso tono="green">Notificaciones activadas.</Aviso>}
      {permiso === 'default' && <button className="btn-primary" onClick={pedirPermiso}>Permitir notificaciones</button>}
      {permiso === 'denied' && <Aviso tono="amber">Notificaciones bloqueadas en el navegador.</Aviso>}
      {permiso === 'no-soportado' && <Aviso tono="amber">Este navegador no admite notificaciones.</Aviso>}
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>Con la app cerrada del todo no avisa (falta push).</div>
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
      <div className="eyebrow">Datos de prueba</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
        Borra todo lo de esta cuenta y carga el escenario de prueba.
      </div>
      <button className="btn-primary" disabled={trabajando} style={{ opacity: trabajando ? 0.5 : 1, background: confirmar === 'recargar' ? 'var(--red)' : 'var(--wine)' }} onClick={() => (confirmar === 'recargar' ? correr(true) : setConfirmar('recargar'))}>
        {trabajando ? 'Trabajando…' : confirmar === 'recargar' ? 'Toca de nuevo: borrar y cargar' : 'Borrar todo y cargar datos de prueba'}
      </button>
      <button disabled={trabajando} style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmar === 'borrar' ? correr(false) : setConfirmar('borrar'))}>
        {confirmar === 'borrar' ? 'Toca de nuevo para borrar todo' : 'Solo borrar todo'}
      </button>
    </div>
  )
}

function IngresoRapidoForm({ hoy, user, show, onCerrar }) {
  const [desc, setDesc] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const puede = num(monto) > 0 && !!fecha
  const guardar = async () => {
    try {
      await addUserDoc(user.uid, 'sueldosRapidos', { desc: desc.trim() || 'Ingreso', monto: num(monto), fecha })
      show('Ingreso agregado')
      onCerrar()
    } catch {
      show('No se pudo guardar')
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Campo label="Descripción"><input className="fld" value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Monto"><input className="fld" type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}><Campo label="Fecha"><input className="fld" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo></div>
      </div>
      <button className="btn-primary" style={{ opacity: puede ? 1 : 0.45 }} disabled={!puede} onClick={guardar}>Agregar ingreso</button>
    </div>
  )
}

// Línea editable "Saldo inicial: $33 · Editar" (como en la app original).
function LineaEditable({ etiqueta, valorActual, editando, onAbrir, onCerrar, onGuardar }) {
  const [valor, setValor] = useState(String(valorActual))
  if (!editando) {
    return (
      <div onClick={onAbrir} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', padding: '2px 2px', cursor: 'pointer' }}>
        <span>{etiqueta}: <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt(valorActual)}</span></span>
        <span style={{ fontWeight: 600, color: 'var(--wine4)' }}>Editar</span>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{etiqueta}</div>
      <input className="fld" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={() => onGuardar(num(valor))}>Guardar</button>
        <button className="pill" style={{ flex: 1, textAlign: 'center' }} onClick={onCerrar}>Cancelar</button>
      </div>
    </div>
  )
}

const OPCIONES_AGREGAR = [
  { clave: 'gasto', texto: 'Gasto', Icono: IconReceipt },
  { clave: 'whimm', texto: 'Whimm', Icono: IconHeart },
  { clave: 'vitall', texto: 'Vitall', Icono: IconVitall },
  { clave: 'plazos', texto: 'Pago a plazos', Icono: IconCard },
  { clave: 'sueldo', texto: 'Sueldo fijo', Icono: IconSalary },
  { clave: 'rapido', texto: 'Ingreso rápido', Icono: IconPlus },
]

export default function Perfil() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [sueldoManual, setSueldoSheet] = useState(null) // null | {} | { sueldo }
  const [pendienteSueldoId, setPendienteSueldoId] = useState(location.state?.openSueldoId || null)
  // Sueldo que llegó por navegación (lápiz de Calendario o Historial): se abre su edición.
  const sueldoEnlazado = !sueldoManual && pendienteSueldoId ? datos.sueldosFijos.find((s) => s.id === pendienteSueldoId) : null
  const sueldoSheet = sueldoManual || (sueldoEnlazado ? { sueldo: sueldoEnlazado } : null)
  const cerrarSueldo = () => { setSueldoSheet(null); setPendienteSueldoId(null) }
  const [rapidoAbierto, setRapidoAbierto] = useState(false)
  const [editando, setEditando] = useState(null) // 'saldo' | 'presupuesto'

  const base = useMemo(() => (loading ? null : parametrosMotor(datos, hoy)), [datos, loading, hoy])
  const vista = useMemo(() => (loading ? null : calcularVistaInicio(datos, hoy)), [datos, loading, hoy])
  const metricas = useMemo(() => (base ? calcularMetricas(datos, hoy, base.presupuestoSemanal) : null), [base, datos, hoy])

  const guardarConfig = async (campos, mensaje) => {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', campos)
      show(mensaje)
      setEditando(null)
    } catch {
      show('No se pudo guardar')
    }
  }

  const agregar = (clave) => {
    if (clave === 'gasto') navigate('/gastos', { state: { nuevo: true } })
    else if (clave === 'whimm') navigate('/whimms', { state: { nuevo: true } })
    else if (clave === 'vitall') navigate('/vitalls', { state: { nuevo: 'suscripcion' } })
    else if (clave === 'plazos') navigate('/vitalls', { state: { nuevo: 'plazos' } })
    else if (clave === 'sueldo') setSueldoSheet({})
    else setRapidoAbierto(true)
  }

  const proximoCobro = (s) => ocurrenciasSueldo(s, `${new Date().getFullYear() + 3}-12-31`, hoy).find((o) => !o.omitida && o.fecha >= hoy)?.fecha
  const ajustes = useMemo(() => [...datos.ajustesSaldo].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')), [datos.ajustesSaldo])
  const nombre = user?.displayName || 'Pame'

  const borrarAjuste = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'ajustesSaldo', id)
      show('Ajuste eliminado')
    } catch {
      show('No se pudo eliminar')
    }
  }

  const grid = [
    ['Promedio diario', fmt(metricas?.promedioDiario), 'últimos 30 días'],
    ['Promedio semanal', fmt(metricas?.promedioSemanal), metricas?.semanasAnalizadas ? `últimas ${metricas.semanasAnalizadas} semanas` : 'sin semanas cerradas'],
    ['Mayor gasto · mes', metricas?.mayorMes ? `${fechaCorta(metricas.mayorMes.fecha)} · ${fmt(gastoNeto(metricas.mayorMes))}` : 'Sin datos', metricas?.mayorMes?.concepto],
    ['Mayor gasto · semana', metricas?.mayorSemana ? `${fechaCorta(metricas.mayorSemana.fecha)} · ${fmt(gastoNeto(metricas.mayorSemana))}` : 'Sin datos', metricas?.mayorSemana?.concepto],
    ['Whimms en fila', String(metricas?.enFilaN ?? 0), metricas?.pagandoN ? `${metricas.pagandoN} pagando a meses` : null],
    ['Comprados', String(metricas?.compradosN ?? 0), `${fmt(metricas?.gastadoCompras)} en compras`],
    ['Categoría top', metricas?.categoriaTop || 'Sin datos', 'la más deseada'],
    ['Vitalls activos', String(metricas?.vitallsActivos ?? 0), null],
  ]

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <h1>Perfil</h1>
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          {loading && !error && <div className="empty-state">Cargando…</div>}

          {vista && base && metricas && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Saldo real</div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{fmt(vista.saldoReal)}</div>
                </div>
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Libre para Whimms</div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: 'var(--wine4)' }}>{fmt(vista.bolsas.bolsaWhimms)}</div>
                </div>
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Reservado para Vitalls</div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: 'var(--wine3)' }}>{fmt(vista.cajitas.cajitaVitalls)}</div>
                </div>
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{vista.bolsas.disponibleSemana < 0 ? 'Te pasaste esta semana' : 'Disponible esta semana'}</div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: vista.bolsas.disponibleSemana < 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(Math.abs(vista.bolsas.disponibleSemana))}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <LineaEditable key={`saldo-${editando === 'saldo'}`} etiqueta="Saldo inicial" valorActual={Number(datos.config?.saldoInicial) || 0} editando={editando === 'saldo'} onAbrir={() => setEditando('saldo')} onCerrar={() => setEditando(null)} onGuardar={(n) => guardarConfig({ saldoInicial: n }, 'Saldo inicial guardado')} />
                <LineaEditable key={`pres-${editando === 'presupuesto'}`} etiqueta="Presupuesto semanal" valorActual={base.presupuestoSemanal} editando={editando === 'presupuesto'} onAbrir={() => setEditando('presupuesto')} onCerrar={() => setEditando(null)} onGuardar={(n) => (n > 0 ? guardarConfig({ presupuestoSemanal: n }, 'Presupuesto guardado') : show('Debe ser mayor a 0'))} />
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>¿Qué quieres agregar?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {OPCIONES_AGREGAR.map(({ clave, texto, Icono }) => (
                    <button key={clave} className="pick-option" onClick={() => agregar(clave)}>
                      <span className="icon"><Icono color="#fff" /></span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{texto}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Sueldos</div>
                {datos.sueldosFijos.length === 0 ? (
                  <div className="empty-state">Sin sueldos</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {datos.sueldosFijos.map((s) => (
                      <div key={s.id} onClick={() => setSueldoSheet({ sueldo: s })} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', opacity: s.fechaFin ? 0.55 : 1 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name || s.nombre}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {s.frecuencia}{s.fechaFin ? ` · detenido ${fechaCorta(s.fechaFin)}` : proximoCobro(s) ? ` · próximo ${fechaCorta(proximoCobro(s))}` : ''}
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>+{fmt(s.monto)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Métricas principales</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {grid.map(([etiqueta, valor, pista]) => (
                    <div key={etiqueta} className="card" style={{ padding: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{etiqueta}</div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{valor}</div>
                      {pista && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{pista}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="row-list">
                <Link to="/perfil/historial" className="row-list-item">
                  <div className="icon-tile" style={{ width: 36, height: 36 }}><IconClock size={17} color="var(--wine)" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Historial completo</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Todo lo registrado, filtrable</div>
                  </div>
                  <IconChevronRight />
                </Link>
              </div>

              <Recordatorios config={datos.config} user={user} show={show} />

              {ajustes.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Ajustes de saldo a mi banco</div>
                  <div className="row-list">
                    {ajustes.map((a) => (
                      <div key={a.id} className="row-list-item">
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{fechaCorta(a.fecha)}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{a.saldoBanco != null ? `banco ${fmt(a.saldoBanco)}` : 'Ajuste'}</div>
                        </div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: a.monto < 0 ? 'var(--red)' : 'var(--green)' }}>{a.monto > 0 ? '+' : ''}{fmt(a.monto)}</div>
                        <button style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }} onClick={() => borrarAjuste(a.id)}>Quitar</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DatosDePrueba datos={datos} user={user} show={show} />

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Cuenta</div>
                <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" style={{ width: 52, height: 52, borderRadius: 26, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, flexShrink: 0 }}>{nombre.charAt(0).toUpperCase()}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{nombre}</div>
                    {user?.email && <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>}
                  </div>
                  <button onClick={() => logout()} style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Cerrar sesión</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet abierto={!!sueldoSheet} onClose={cerrarSueldo} titulo={sueldoSheet?.sueldo ? sueldoSheet.sueldo.name || 'Sueldo' : 'Nuevo sueldo fijo'}>
        {sueldoSheet && <SueldoForm key={sueldoSheet.sueldo?.id || 'nuevo'} sueldo={sueldoSheet.sueldo} hoy={hoy} user={user} show={show} onCerrar={cerrarSueldo} />}
      </Sheet>
      <Sheet abierto={rapidoAbierto} onClose={() => setRapidoAbierto(false)} titulo="Ingreso rápido">
        {rapidoAbierto && <IngresoRapidoForm hoy={hoy} user={user} show={show} onCerrar={() => setRapidoAbierto(false)} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
