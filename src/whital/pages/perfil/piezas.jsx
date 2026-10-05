// Piezas compartidas por las pantallas de Perfil (sueldos, configuración).
import { useEffect, useState } from 'react'
import { addUserDoc, deleteUserDoc, updateUserDoc } from '../../../lib/firestoreCollections'
import BotonEliminar from '../../components/BotonEliminar'
import Campo, { Aviso } from '../../components/Campo'
import SelectorRecordatorio from '../../components/SelectorRecordatorio'
import { aNotif, deNotif } from '../../lib/notificaciones'
import { generarFechasPago } from '../../lib/budget'
import { borrarDatos, completarImagenes, hayDatosDePrueba, leerDatosDePrueba, sembrarDatos } from '../../lib/seed'
import { fechaCorta, fmt } from '../../lib/vista'

const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual']
const num = (v) => (v === '' || v == null ? 0 : Number(v))

export function SueldoForm({ sueldo, hoy, user, show, onCerrar }) {
  const nuevo = !sueldo?.id
  const [name, setName] = useState(sueldo?.name || sueldo?.nombre || '')
  const [monto, setMonto] = useState(sueldo?.monto != null ? String(sueldo.monto) : '')
  const [frecuencia, setFrecuencia] = useState(sueldo?.frecuencia || 'Quincenal')
  const [fechaInicio, setFechaInicio] = useState(sueldo?.fechaInicio || hoy)
  const [notif, setNotif] = useState(deNotif(sueldo?.notifCadaMin))
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
      const base = { name: name.trim(), monto: num(monto), frecuencia, fechaInicio, notifCadaMin: aNotif(notif) }
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
      <SelectorRecordatorio valor={notif} onChange={setNotif} />
      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45 }} disabled={!puedeGuardar} onClick={guardar}>{nuevo ? 'Agregar sueldo' : 'Guardar cambios'}</button>
      {!nuevo && (
        <>
          {detenido
            ? <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={reanudar}>Reanudar (detenido desde {fechaCorta(sueldo.fechaFin)})</button>
            : <button style={{ color: 'var(--wine)', fontSize: 12, fontWeight: 600 }} onClick={detener}>Detener a partir de hoy</button>}
          <BotonEliminar mensaje="¿Eliminar este sueldo? También se pierde su historial de cobros." onConfirmar={eliminar} />
        </>
      )}
    </div>
  )
}

// Cada cuánto recordar que registres gastos. Suena mientras la app esté abierta o
// que haya y escribe los datos de prueba con la sesión actual.
export function DatosDePrueba({ datos, user, show }) {
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

  const imagenes = async () => {
    setTrabajando(true)
    try {
      const n = await completarImagenes(user.uid, datos.whimms, seed)
      show(n ? `Imágenes agregadas a ${n} Whimms` : 'Todos los Whimms ya tienen imagen')
    } catch {
      show('No se pudieron agregar las imágenes')
    }
    setTrabajando(false)
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
      <button className="segbtn" disabled={trabajando} style={{ background: 'var(--beige2)', color: 'var(--wine)' }} onClick={imagenes}>Solo agregar imágenes faltantes</button>
      <BotonEliminar texto="Eliminar todo" mensaje="Se borran todos los gastos, Whimms, Vitalls y sueldos de esta cuenta." deshabilitado={trabajando} onConfirmar={() => correr(false)} />
    </div>
  )
}

export function IngresoRapidoForm({ hoy, user, show, onCerrar }) {
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
export function LineaEditable({ etiqueta, valorActual, editando, onAbrir, onCerrar, onGuardar }) {
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
