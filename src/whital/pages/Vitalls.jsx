import { useMemo, useState } from 'react'
import Toast from '../../components/Toast'
import Toggle from '../../components/Toggle'
import { IconPlus } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import Campo, { Aviso } from '../components/Campo'
import Sheet from '../components/Sheet'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { addDaysISO, ocurrenciasPagoFijo, progresoPagoFijo, todayISO } from '../lib/budget'
import { diaSemanaCorto, fechaCorta, fmt } from '../lib/vista'

const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual']
const num = (v) => (v === '' || v == null ? 0 : Number(v))

const esMSI = (p) => p.tipo === 'MSI'
const esPlazos = (p) => !!p.finito || esMSI(p)

// Ocurrencias cercanas de una serie, con su excepción (omitir / monto real).
function OcurrenciasSerie({ pago, hoy, user, show }) {
  const [editando, setEditando] = useState(null) // fecha cuyo monto se edita
  const [valor, setValor] = useState('')

  const ocurrencias = useMemo(() => {
    const todas = ocurrenciasPagoFijo(pago, addDaysISO(hoy, 400), addDaysISO(hoy, -35))
    const pasadas = todas.filter((o) => o.fecha < hoy).slice(-2)
    const futuras = todas.filter((o) => o.fecha >= hoy).slice(0, 4)
    return [...pasadas, ...futuras]
  }, [pago, hoy])

  const escribir = async (fecha, exc, mensaje) => {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', pago.id, { [`excepciones.${fecha}`]: exc })
      show(mensaje)
    } catch {
      show('No se pudo guardar la excepción')
    }
  }

  const excDe = (fecha) => pago.excepciones?.[fecha] || {}

  if (ocurrencias.length === 0) return <div style={{ fontSize: 11, color: 'var(--muted)' }}>Esta serie no tiene fechas próximas.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {ocurrencias.map((o) => {
        const exc = excDe(o.fecha)
        const tieneMonto = exc.montoReal != null || exc.monto != null
        return (
          <div key={o.fecha} style={{ padding: '9px 0', borderTop: '1px solid var(--beige2)', opacity: o.omitida ? 0.55 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 52 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{diaSemanaCorto(o.fecha)}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fechaCorta(o.fecha)}{o.fecha < hoy ? ' · pasó' : ''}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 13, textDecoration: o.omitida ? 'line-through' : 'none' }}>{fmt(o.monto)}</div>
                {tieneMonto && <div style={{ fontSize: 10, color: 'var(--amber)' }}>monto ajustado (base {fmt(pago.monto)})</div>}
              </div>
              <button style={{ fontSize: 11, color: 'var(--wine)', fontWeight: 600 }} onClick={() => { setEditando(editando === o.fecha ? null : o.fecha); setValor(String(o.monto)) }}>Cambiar monto</button>
              <Toggle on={o.omitida} onClick={() => escribir(o.fecha, { ...exc, omitida: !o.omitida }, o.omitida ? 'Fecha restaurada' : 'Fecha omitida')} ariaLabel={o.omitida ? 'Restaurar esta fecha' : 'Omitir esta fecha'} />
            </div>
            {editando === o.fecha && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="fld" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
                <button className="segbtn" style={{ flex: 'none', padding: '0 14px', background: 'var(--wine)', color: '#fff' }} onClick={async () => { await escribir(o.fecha, { omitida: !!exc.omitida, montoReal: num(valor) }, 'Monto de esa fecha actualizado'); setEditando(null) }}>Guardar</button>
                {tieneMonto && <button className="segbtn" style={{ flex: 'none', padding: '0 12px', background: 'var(--beige2)' }} onClick={async () => { await escribir(o.fecha, { omitida: !!exc.omitida }, 'Monto restablecido'); setEditando(null) }}>Restablecer</button>}
              </div>
            )}
          </div>
        )
      })}
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>El interruptor omite solo esa fecha; la serie sigue igual.</div>
    </div>
  )
}

function VitallForm({ pago, datos, hoy, user, show, onCerrar }) {
  const nuevo = !pago?.id
  const msi = pago && esMSI(pago)
  const [plazos, setPlazos] = useState(pago ? esPlazos(pago) : false)
  const [name, setName] = useState(pago?.name || '')
  const [monto, setMonto] = useState(pago?.monto != null ? String(pago.monto) : '')
  const [frecuencia, setFrecuencia] = useState(pago?.frecuencia || 'Mensual')
  const [fecha, setFecha] = useState(pago?.fecha || hoy)
  const [numPagos, setNumPagos] = useState(pago?.numPagos != null ? String(pago.numPagos) : '3')
  const [categoria, setCategoria] = useState(pago && pago.tipo !== 'Vitall' && !msi ? pago.tipo || '' : '')
  const [activo, setActivo] = useState(pago ? pago.activo !== false : true)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)

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
      {msi && <Aviso tono="amber">Este pago nació de un Whimm a meses. Cambiar su monto o fechas afecta cuándo se compra lo demás de tu fila.</Aviso>}

      <Campo label="Nombre"><input className="fld" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spotify, Teléfono, Colegiatura…" /></Campo>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Monto"><input className="fld" type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}>
          <Campo label="Frecuencia">
            <select className="fld" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>{FRECUENCIAS.map((f) => <option key={f}>{f}</option>)}</select>
          </Campo>
        </div>
      </div>
      <Campo label={nuevo ? 'Primer vencimiento' : 'Vencimiento base de la serie'} nota={!nuevo ? 'Las demás fechas se calculan a partir de esta.' : undefined}>
        <input className="fld" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Campo>
      {plazos && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Campo label="Número de pagos"><input className="fld" type="number" inputMode="numeric" value={numPagos} onChange={(e) => setNumPagos(e.target.value)} /></Campo></div>
          {!msi && (
            <div style={{ flex: 1 }}>
              <Campo label="Categoría">
                <input className="fld" list="cats-plazos" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
                <datalist id="cats-plazos">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
              </Campo>
            </div>
          )}
        </div>
      )}
      {prog && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Lleva {prog.pagados} de {prog.total} pagos{prog.siguiente ? ` · siguiente ${fechaCorta(prog.siguiente)}` : ' · liquidado'}.</div>}
      {!nuevo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Activo</span>
          <Toggle on={activo} onClick={() => setActivo(!activo)} ariaLabel="Activo" />
        </div>
      )}

      <button className="btn-primary" style={{ opacity: puedeGuardar ? 1 : 0.45 }} disabled={!puedeGuardar} onClick={guardar}>{nuevo ? 'Agregar' : 'Guardar serie'}</button>

      {!nuevo && (
        <div style={{ borderTop: '1px solid var(--beige3)', paddingTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Fechas de esta serie</div>
          <OcurrenciasSerie pago={pago} hoy={hoy} user={user} show={show} />
          <div style={{ marginTop: 14 }}>
            <button style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600 }} onClick={() => (confirmarEliminar ? eliminar() : setConfirmarEliminar(true))}>
              {confirmarEliminar ? 'Toca de nuevo para eliminar toda la serie' : 'Eliminar serie'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Fila({ p, hoy, onClick }) {
  const prog = progresoPagoFijo(p, hoy)
  const inactivo = p.activo === false
  return (
    <button className="row-list-item" style={{ textAlign: 'left', width: '100%', opacity: inactivo ? 0.5 : 1 }} onClick={onClick}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
          {p.frecuencia}
          {esPlazos(p) && prog.total ? ` · ${Math.min(prog.pagados, prog.total)} de ${prog.total} pagos` : ''}
          {inactivo ? ' · pausado' : prog.siguiente ? ` · siguiente ${fechaCorta(prog.siguiente)}` : esPlazos(p) ? ' · liquidado' : ''}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.monto)}</div>
    </button>
  )
}

export default function Vitalls() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const [sheet, setSheet] = useState(null)

  const suscripciones = datos.pagosFijos.filter((p) => !esPlazos(p))
  const plazos = datos.pagosFijos.filter(esPlazos)

  return (
    <>
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow">Whital</div>
          <h1>Vitalls</h1>
        </div>
        {error && <Aviso tono="red">{error}</Aviso>}
        {loading && !error && <div className="empty-state">Cargando…</div>}
        {!loading && (
          <>
            <div>
              <div className="eyebrow" style={{ margin: '0 2px 8px' }}>Suscripciones y recurrentes</div>
              {suscripciones.length === 0
                ? <div className="empty-state">Sin suscripciones. Agrega Spotify, estacionamiento, etc. con el botón +.</div>
                : <div className="row-list">{suscripciones.map((p) => <Fila key={p.id} p={p} hoy={hoy} onClick={() => setSheet({ pago: p })} />)}</div>}
            </div>
            <div>
              <div className="eyebrow" style={{ margin: '0 2px 8px' }}>Pagos a plazos</div>
              {plazos.length === 0
                ? <div className="empty-state">Sin pagos a plazos. Los de MSI aparecen aquí cuando pasas un Whimm a meses.</div>
                : <div className="row-list">{plazos.map((p) => <Fila key={p.id} p={p} hoy={hoy} onClick={() => setSheet({ pago: p })} />)}</div>}
            </div>
          </>
        )}
      </div>

      <button className="fab" onClick={() => setSheet({})} aria-label="Agregar Vitall"><IconPlus /></button>
      <Sheet abierto={!!sheet} onClose={() => setSheet(null)} titulo={sheet?.pago ? sheet.pago.name : 'Nuevo Vitall'}>
        {sheet && <VitallForm key={sheet.pago?.id || 'nuevo'} pago={sheet.pago} datos={datos} hoy={hoy} user={user} show={show} onCerrar={() => setSheet(null)} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
