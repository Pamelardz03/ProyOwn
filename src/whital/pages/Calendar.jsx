import { useMemo, useState } from 'react'
import Toast from '../../components/Toast'
import { IconChevronLeft, IconChevronRight } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, deleteUserDoc } from '../../lib/firestoreCollections'
import Campo, { Aviso } from '../components/Campo'
import FilaExcepcion from '../components/FilaExcepcion'
import Sheet from '../components/Sheet'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { parseISODate, proyectarColaWhimms, todayISO } from '../lib/budget'
import { MESES, casillasDelMes, eventosDelMes } from '../lib/calendario'
import { diaSemanaCorto, fmt, parametrosMotor } from '../lib/vista'

const ENCABEZADOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const num = (v) => (v === '' || v == null ? 0 : Number(v))

function titulo(iso) {
  const d = parseISODate(iso)
  return `${diaSemanaCorto(iso)} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

function IngresoRapido({ fecha, user, show, onListo }) {
  const [desc, setDesc] = useState('')
  const [monto, setMonto] = useState('')
  const guardar = async () => {
    if (!(num(monto) > 0)) return
    try {
      await addUserDoc(user.uid, 'sueldosRapidos', { desc: desc.trim() || 'Ingreso', monto: num(monto), fecha })
      show('Ingreso agregado')
      setDesc('')
      setMonto('')
      onListo()
    } catch {
      show('No se pudo guardar')
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Descripción"><input className="fld" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Uñas, venta…" /></Campo></div>
        <div style={{ flex: 1 }}><Campo label="Monto"><input className="fld" type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo></div>
      </div>
      <button className="btn-primary" style={{ opacity: num(monto) > 0 ? 1 : 0.45 }} disabled={!(num(monto) > 0)} onClick={guardar}>Agregar ingreso a este día</button>
    </div>
  )
}

function DiaSheet({ fecha, evento, hoy, user, show }) {
  const [agregando, setAgregando] = useState(false)
  const vacio = !evento || (evento.ingresos.length === 0 && evento.compromisos.length === 0 && evento.compras.length === 0)

  const borrarRapido = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'sueldosRapidos', id)
      show('Ingreso eliminado')
    } catch {
      show('No se pudo eliminar')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {vacio && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nada programado este día.</div>}

      {evento?.ingresos.length > 0 && (
        <div>
          <div className="eyebrow" style={{ color: 'var(--green)' }}>Ingresos</div>
          {evento.ingresos.map((i) =>
            i.tipo === 'fijo'
              ? <FilaExcepcion key={`${i.entidad.id}-${i.fecha}`} coleccion="sueldosFijos" entidad={i.entidad} ocurrencia={i} hoy={hoy} user={user} show={show} nombre={i.nombre} />
              : (
                <div key={i.entidad.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--beige2)' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{i.nombre}</div>
                  <div className="mono" style={{ fontSize: 13 }}>{fmt(i.monto)}</div>
                  <button style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }} onClick={() => borrarRapido(i.entidad.id)}>Eliminar</button>
                </div>
              )
          )}
        </div>
      )}

      {evento?.compromisos.length > 0 && (
        <div>
          <div className="eyebrow" style={{ color: 'var(--red)' }}>Compromisos</div>
          {evento.compromisos.map((c) => (
            <FilaExcepcion key={`${c.entidad.id}-${c.fecha}`} coleccion="pagosFijos" entidad={c.entidad} ocurrencia={c} hoy={hoy} user={user} show={show} nombre={`${c.nombre}${c.msi ? ' (a meses)' : ''}`} />
          ))}
        </div>
      )}

      {evento?.compras.length > 0 && (
        <div>
          <div className="eyebrow">🎁 Compras proyectadas</div>
          {evento.compras.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--beige2)' }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.nombre}</div>
              <div className="mono" style={{ fontSize: 13 }}>{fmt(c.faltante)}</div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>La fecha se mueve sola si cambian tus gastos, ingresos o Vitalls.</div>
        </div>
      )}

      {agregando
        ? <IngresoRapido fecha={fecha} user={user} show={show} onListo={() => setAgregando(false)} />
        : <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--wine)' }} onClick={() => setAgregando(true)}>+ Ingreso rápido en este día</button>}
    </div>
  )
}

export default function Calendar() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const hoyDate = parseISODate(hoy)
  const [vista, setVista] = useState({ anio: hoyDate.getFullYear(), mes: hoyDate.getMonth() })
  const [dia, setDia] = useState(null)

  const cola = useMemo(() => (loading ? [] : proyectarColaWhimms(parametrosMotor(datos, hoy))), [datos, loading, hoy])
  const { porDia, totales } = useMemo(() => eventosDelMes({ datos, cola, anio: vista.anio, mes: vista.mes }), [datos, cola, vista])
  const casillas = useMemo(() => casillasDelMes(vista.anio, vista.mes), [vista])

  const mover = (delta) => {
    const d = new Date(vista.anio, vista.mes + delta, 1)
    setVista({ anio: d.getFullYear(), mes: d.getMonth() })
  }

  return (
    <>
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow">Whital</div>
          <h1>Calendar</h1>
        </div>
        {error && <Aviso tono="red">{error}</Aviso>}
        {loading && !error && <div className="empty-state">Cargando…</div>}
        {!loading && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="back-btn" onClick={() => mover(-1)} aria-label="Mes anterior"><IconChevronLeft /></button>
              <div style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize' }}>{MESES[vista.mes]} {vista.anio}</div>
              <button className="back-btn" onClick={() => mover(1)} aria-label="Mes siguiente"><IconChevronRight /></button>
            </div>

            <div className="card" style={{ padding: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                {ENCABEZADOS.map((h, i) => <div key={i} className="eyebrow" style={{ textAlign: 'center' }}>{h}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {casillas.map((f, i) => {
                  if (!f) return <div key={`h${i}`} />
                  const ev = porDia.get(f)
                  const ingreso = ev?.ingresos.some((x) => !x.omitida)
                  const compromiso = ev?.compromisos.some((x) => !x.omitida)
                  const compra = ev?.compras.length > 0
                  const esHoy = f === hoy
                  return (
                    <button key={f} onClick={() => setDia(f)} style={{ aspectRatio: '1 / 1.05', borderRadius: 10, background: esHoy ? 'var(--wine)' : 'var(--beige2)', color: esHoy ? '#fff' : 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 12, fontWeight: esHoy ? 700 : 500 }}>
                      <span>{parseISODate(f).getDate()}</span>
                      <span style={{ display: 'flex', gap: 3, height: 8, alignItems: 'center', fontSize: 8, lineHeight: 1 }}>
                        {ingreso && <span style={{ width: 6, height: 6, borderRadius: 3, background: esHoy ? '#b7d6a8' : 'var(--green)' }} />}
                        {compromiso && <span style={{ width: 6, height: 6, borderRadius: 3, background: esHoy ? '#f0b3a8' : 'var(--red)' }} />}
                        {compra && <span>🎁</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10, color: 'var(--muted)', flexWrap: 'wrap' }}>
                <span><span style={{ color: 'var(--green)' }}>●</span> Ingresos</span>
                <span><span style={{ color: 'var(--red)' }}>●</span> Compromisos</span>
                <span>🎁 Compras proyectadas</span>
              </div>
            </div>

            <div className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="eyebrow">Entra en el mes</div>
                <div className="mono" style={{ fontSize: 15, color: 'var(--green)', marginTop: 3 }}>{fmt(totales.ingresos)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="eyebrow">Compromisos</div>
                <div className="mono" style={{ fontSize: 15, color: 'var(--red)', marginTop: 3 }}>{fmt(totales.compromisos)}</div>
              </div>
            </div>
          </>
        )}
      </div>

      <Sheet abierto={!!dia} onClose={() => setDia(null)} titulo={dia ? titulo(dia) : ''}>
        {dia && <DiaSheet key={dia} fecha={dia} evento={porDia.get(dia)} hoy={hoy} user={user} show={show} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
