import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import InputConSugerencias from '../components/InputConSugerencias'
import PestanasCompras from '../components/PestanasCompras'
import Toast from '../../components/Toast'
import Toggle from '../../components/Toggle'
import { IconPlus } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import BotonEliminar from '../components/BotonEliminar'
import Campo, { Aviso } from '../components/Campo'
import FilaDeslizable from '../components/FilaDeslizable'
import SelectorRecordatorio from '../components/SelectorRecordatorio'
import { aNotif, deNotif } from '../lib/notificaciones'
import Sheet from '../components/Sheet'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { progresoPagoFijo, todayISO } from '../lib/budget'
import { enDias, fechaCorta, fmt } from '../lib/vista'

const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual']
const num = (v) => (v === '' || v == null ? 0 : Number(v))

const esMSI = (p) => p.tipo === 'MSI'
const esPlazos = (p) => !!p.finito || esMSI(p)

function VitallForm({ pago, datos, hoy, user, show, onCerrar, plazosInicial }) {
  const nuevo = !pago?.id
  const msi = pago && esMSI(pago)
  const [plazos, setPlazos] = useState(pago ? esPlazos(pago) : !!plazosInicial)
  const [name, setName] = useState(pago?.name || '')
  const [monto, setMonto] = useState(pago?.monto != null ? String(pago.monto) : '')
  const [frecuencia, setFrecuencia] = useState(pago?.frecuencia || 'Mensual')
  const [fecha, setFecha] = useState(pago?.fecha || hoy)
  const [numPagos, setNumPagos] = useState(pago?.numPagos != null ? String(pago.numPagos) : '3')
  const [notif, setNotif] = useState(deNotif(pago?.notifCadaMin))
  const [categoria, setCategoria] = useState(pago && pago.tipo !== 'Vitall' && !msi ? pago.tipo || '' : '')
  const activo = pago ? pago.activo !== false : true // pausar/reanudar se hace con el interruptor de la lista

  const categorias = useMemo(() => [...new Set(datos.pagosFijos.map((p) => p.tipo).filter((t) => t && t !== 'Vitall' && t !== 'MSI'))], [datos.pagosFijos])
  const prog = pago && plazos ? progresoPagoFijo(pago, hoy) : null
  const puedeGuardar = name.trim() && num(monto) > 0 && !!fecha && (!plazos || num(numPagos) >= 1)

  const ejecutar = async (fn, mensaje) => {
    try {
      await fn()
      show(mensaje)
      onCerrar()
    } catch {
      show('No se pudo guardar')
    }
  }

  const campos = () => ({
    name: name.trim(),
    monto: num(monto),
    frecuencia,
    fecha,
    activo,
    finito: plazos,
    numPagos: plazos ? Math.max(Math.round(num(numPagos)), 1) : null,
    tipo: msi ? 'MSI' : plazos ? categoria.trim() || 'Plazos' : 'Vitall',
    notifCadaMin: aNotif(notif),
  })

  const guardar = () =>
    ejecutar(async () => {
      if (nuevo) await addUserDoc(user.uid, 'pagosFijos', { ...campos(), excepciones: {}, notifFormal: false, notifMini: false })
      else await updateUserDoc(user.uid, 'pagosFijos', pago.id, campos())
    }, nuevo ? 'Vitall agregado' : 'Serie actualizada')

  const eliminar = () =>
    ejecutar(async () => {
      if (msi && pago.whimmId) await updateUserDoc(user.uid, 'whimms', pago.whimmId, { estado: 'espera', pagoFijoMsiId: null, precioComprado: null })
      await deleteUserDoc(user.uid, 'pagosFijos', pago.id)
    }, 'Eliminado')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {nuevo && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="segbtn" style={{ background: !plazos ? 'var(--wine)' : 'var(--beige2)', color: !plazos ? '#fff' : 'var(--muted)' }} onClick={() => setPlazos(false)}>Suscripción (sin fin)</button>
          <button className="segbtn" style={{ background: plazos ? 'var(--wine)' : 'var(--beige2)', color: plazos ? '#fff' : 'var(--muted)' }} onClick={() => setPlazos(true)}>A plazos (con fin)</button>
        </div>
      )}

      <Campo label="Nombre"><input className="fld" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spotify, Teléfono, Colegiatura…" /></Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Monto"><input className="fld" type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}>
          <Campo label="Frecuencia">
            <select className="fld" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>{FRECUENCIAS.map((f) => <option key={f}>{f}</option>)}</select>
          </Campo>
        </div>
      </div>
      <Campo label={nuevo ? 'Primer vencimiento' : 'Vencimiento base'}>
        <input className="fld" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Campo>
      {plazos && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Campo label="Número de pagos"><input className="fld" type="number" inputMode="numeric" value={numPagos} onChange={(e) => setNumPagos(e.target.value)} /></Campo></div>
          {!msi && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <Campo label="Categoría">
                <InputConSugerencias value={categoria} onChange={setCategoria} opciones={categorias} />
              </Campo>
            </div>
          )}
        </div>
      )}
      {prog && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Lleva {prog.pagados} de {prog.total} pagos{prog.siguiente ? ` · siguiente ${fechaCorta(prog.siguiente)}` : ' · liquidado'}.</div>}
      <SelectorRecordatorio valor={notif} onChange={setNotif} />
      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45 }} disabled={!puedeGuardar} onClick={guardar}>{nuevo ? 'Agregar' : 'Guardar serie'}</button>

      {!nuevo && (
        <div style={{ borderTop: '1px solid var(--beige3)', paddingTop: 12 }}>
          <BotonEliminar mensaje="¿Eliminar toda la serie? También se pierden sus pagos del historial." onConfirmar={eliminar} />
        </div>
      )}
    </div>
  )
}

function Fila({ p, hoy, onPausar }) {
  const prog = progresoPagoFijo(p, hoy)
  const activo = p.activo !== false
  return (
    <div className="row-list-item" style={{ cursor: 'pointer', opacity: activo ? 1 : 0.5 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
          {p.frecuencia}
          {esPlazos(p) && prog.total ? ` · ${Math.min(prog.pagados, prog.total)} de ${prog.total} pagos` : ''}
          {!activo ? ' · pausado' : prog.siguiente ? ` · siguiente ${fechaCorta(prog.siguiente)} · ${enDias(prog.siguiente, hoy)}` : esPlazos(p) ? ' · liquidado' : ''}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.monto)}</div>
      <span onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <Toggle on={activo} onClick={() => onPausar(p)} ariaLabel={activo ? 'Pausar' : 'Reanudar'} />
      </span>
    </div>
  )
}

export default function Vitalls() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const location = useLocation()
  // Desde Perfil > "¿Qué quieres agregar?": abre el formulario ya en el tipo elegido.
  const [sheet, setSheet] = useState(() => (location.state?.nuevo ? { plazos: location.state.nuevo === 'plazos' } : null))

  const [pendienteId, setPendienteId] = useState(location.state?.openPagoId || null)
  const cerrar = () => { setSheet(null); setPendienteId(null) }

  const pausar = async (p) => {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', p.id, { activo: p.activo === false })
      show(p.activo === false ? 'Reanudado' : 'Pausado')
    } catch {
      show('No se pudo actualizar')
    }
  }

  // Serie que llegó por navegación (lápiz de Calendario o Historial): se abre su edición.
  const pagoEnlazado = !sheet && pendienteId ? datos.pagosFijos.find((p) => p.id === pendienteId) : null
  const hoja = sheet || (pagoEnlazado ? { pago: pagoEnlazado } : null)

  const eliminarPago = async (p) => {
    try {
      // Un pago a meses liga a su Whimm: al borrarlo el Whimm regresa a la fila.
      if (p.tipo === 'MSI' && p.whimmId) await updateUserDoc(user.uid, 'whimms', p.whimmId, { estado: 'espera', pagoFijoMsiId: null, precioComprado: null })
      await deleteUserDoc(user.uid, 'pagosFijos', p.id)
      show('Serie eliminada')
    } catch {
      show('No se pudo eliminar')
    }
  }
  const renderFila = (p) => (
    <FilaDeslizable key={p.id} titulo={`Eliminar ${p.name}`} mensaje="¿Eliminar toda la serie? También se pierden sus pagos del historial." onEliminar={() => eliminarPago(p)} onTap={() => setSheet({ pago: p })}>
      <Fila p={p} hoy={hoy} onPausar={pausar} />
    </FilaDeslizable>
  )

  const suscripciones = datos.pagosFijos.filter((p) => !esPlazos(p))
  const plazos = datos.pagosFijos.filter(esPlazos)

  return (
    <>
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PestanasCompras activa="vitalls" />
        {error && <Aviso tono="red">{error}</Aviso>}
        {loading && !error && <div className="empty-state">Cargando…</div>}
        {!loading && (
          <>
            <div>
              <div className="eyebrow" style={{ margin: '0 2px 8px' }}>Suscripciones y recurrentes</div>
              {suscripciones.length === 0
                ? <div className="empty-state">Sin suscripciones</div>
                : <div className="row-list">{suscripciones.map(renderFila)}</div>}
            </div>
            <div>
              <div className="eyebrow" style={{ margin: '0 2px 8px' }}>Pagos a plazos</div>
              {plazos.length === 0
                ? <div className="empty-state">Sin pagos a plazos</div>
                : <div className="row-list">{plazos.map(renderFila)}</div>}
            </div>
          </>
        )}
      </div>

      <button className="fab" onClick={() => setSheet({})} aria-label="Agregar Vitall"><IconPlus /></button>
      <Sheet abierto={!!hoja} onClose={cerrar} titulo={hoja?.pago ? hoja.pago.name : 'Nuevo Vitall'}>
        {hoja && <VitallForm key={hoja.pago?.id || 'nuevo'} plazosInicial={hoja.plazos} pago={hoja.pago} datos={datos} hoy={hoy} user={user} show={show} onCerrar={cerrar} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
