import { useMemo, useState } from 'react'
import Toast from '../../components/Toast'
import { IconChevronLeft, IconChevronRight, IconEdit } from '../../components/Icons'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { useGuia } from '../hooks/useGuia'
import { addUserDoc, deleteUserDoc } from '../../lib/firestoreCollections'
import Campo, { Aviso } from '../components/Campo'
import DetalleEliminable from '../components/DetalleEliminable'
import FilaExcepcion from '../components/FilaExcepcion'
import Sheet from '../components/Sheet'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { parseISODate, proyectarColaWhimms, todayISO } from '../lib/budget'
import { MESES, casillasDelMes, eventosDelMes, proximosEventos } from '../lib/calendario'
import { diaSemanaCorto, fechaCorta, fmt, parametrosMotor } from '../lib/vista'

const DIAS = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA']
const COLOR = { nomina: 'var(--acento)', servicio: 'var(--wine4)', compra: 'var(--amber)' }
const FILTROS = [['todos', 'Todos'], ['servicio', 'Pagos fijos'], ['compra', 'Whimm'], ['nomina', 'Sueldos']]
const num = (v) => (v === '' || v == null ? 0 : Number(v))

// Borde del día: un color por categoría; con 2 o más, el borde se reparte en partes
// iguales SIN perder las esquinas redondeadas (degradado en el borde, relleno aparte).
function estiloDia(cats, esHoy) {
  const unicas = [...new Set(cats)]
  const relleno = esHoy ? 'var(--red)' : 'var(--card-solid)'
  const base = esHoy ? { color: '#fff', fontWeight: 700 } : unicas.length ? { fontWeight: 600 } : {}
  if (unicas.length === 0) return esHoy ? { ...base, background: 'var(--red)' } : base
  if (unicas.length === 1) {
    return { ...base, border: `2px solid ${COLOR[unicas[0]]}`, ...(esHoy ? { background: 'var(--red)' } : { color: COLOR[unicas[0]] }) }
  }
  const paso = 360 / unicas.length
  const stops = unicas.map((c, i) => `${COLOR[c]} ${i * paso}deg ${(i + 1) * paso}deg`).join(', ')
  return { ...base, border: '2px solid transparent', background: `linear-gradient(${relleno}, ${relleno}) padding-box, conic-gradient(${stops}) border-box` }
}

function Leyenda({ color, solido, texto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, ...(solido ? { background: color } : { border: `2px solid ${color}`, boxSizing: 'border-box' }) }} />
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{texto}</span>
    </div>
  )
}

function IngresoRapido({ fecha, user, show, onListo }) {
  const [desc, setDesc] = useState('')
  const [monto, setMonto] = useState('')
  const guardar = async () => {
    if (!(num(monto) > 0)) return
    try {
      await addUserDoc(user.uid, 'sueldosRapidos', { desc: desc.trim() || 'Ingreso', monto: num(monto), fecha })
      show('Ingreso agregado')
      onListo()
    } catch {
      show('No se pudo guardar')
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Descripción"><input className="fld" value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}><Campo label="Monto"><input className="fld" type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo></div>
      </div>
      <button className="btn-primary" style={{ opacity: num(monto) > 0 ? 1 : 0.45 }} disabled={!(num(monto) > 0)} onClick={guardar}>Agregar ingreso</button>
    </div>
  )
}

function DiaSheet({ fecha, evento, hoy, user, show }) {
  const [agregando, setAgregando] = useState(false)
  const [rapido, setRapido] = useState(null)
  const vacio = !evento || (evento.ingresos.length === 0 && evento.compromisos.length === 0 && evento.compras.length === 0)

  const borrarRapido = async (id) => {
    try {
      await deleteUserDoc(user.uid, 'sueldosRapidos', id)
      show('Ingreso eliminado')
      setRapido(null)
    } catch {
      show('No se pudo eliminar')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {vacio && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nada programado este día.</div>}

      {evento?.ingresos.length > 0 && (
        <div>
          <div className="eyebrow" style={{ color: COLOR.nomina }}>Sueldos</div>
          {evento.ingresos.map((i) =>
            i.tipo === 'fijo' ? (
              <FilaExcepcion key={`${i.entidad.id}-${i.fecha}`} coleccion="sueldosFijos" entidad={i.entidad} ocurrencia={i} hoy={hoy} user={user} show={show} nombre={i.nombre} />
            ) : (
              <div key={i.entidad.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--beige2)' }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{i.nombre}</div>
                <div className="mono" style={{ fontSize: 13 }}>{fmt(i.monto)}</div>
                <button aria-label="Editar" onClick={() => setRapido(i)}><IconEdit /></button>
              </div>
            )
          )}
        </div>
      )}

      {evento?.compromisos.length > 0 && (
        <div>
          <div className="eyebrow" style={{ color: COLOR.servicio }}>Pagos fijos</div>
          {evento.compromisos.map((c) => (
            <FilaExcepcion key={`${c.entidad.id}-${c.fecha}`} coleccion="pagosFijos" entidad={c.entidad} ocurrencia={c} hoy={hoy} user={user} show={show} nombre={`${c.nombre}${c.msi ? ' (a meses)' : ''}`} />
          ))}
        </div>
      )}

      {evento?.compras.length > 0 && (
        <div>
          <div className="eyebrow" style={{ color: COLOR.compra }}>Whimm</div>
          {evento.compras.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--beige2)' }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.nombre} — estimado disponible</div>
              <div className="mono" style={{ fontSize: 13 }}>{fmt(c.faltante)}</div>
            </div>
          ))}
        </div>
      )}

      {rapido && <DetalleEliminable titulo={rapido.nombre} sub={fechaCorta(rapido.fecha)} monto={rapido.monto} mensaje="¿Eliminar este ingreso? No se puede deshacer." onEliminar={() => borrarRapido(rapido.entidad.id)} onCerrar={() => setRapido(null)} />}

      {agregando ? (
        <IngresoRapido fecha={fecha} user={user} show={show} onListo={() => setAgregando(false)} />
      ) : (
        <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => setAgregando(true)}>+ Ingreso rápido</button>
      )}
    </div>
  )
}

export default function Calendar() {
  const { user } = useAuth()
  const guia = useGuia()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const hoyDate = parseISODate(hoy)
  const [vista, setVista] = useState({ anio: hoyDate.getFullYear(), mes: hoyDate.getMonth() })
  const [dia, setDia] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [visibles, setVisibles] = useState(20)

  const cola = useMemo(() => (loading ? [] : proyectarColaWhimms(parametrosMotor(datos, hoy))), [datos, loading, hoy])
  const { porDia } = useMemo(() => eventosDelMes({ datos, cola, anio: vista.anio, mes: vista.mes }), [datos, cola, vista])
  const casillas = useMemo(() => casillasDelMes(vista.anio, vista.mes), [vista])
  const proximos = useMemo(() => proximosEventos({ datos, cola, hoyISO: hoy }), [datos, cola, hoy])

  const filtrados = proximos.filter((e) => filtro === 'todos' || e.cat === filtro)
  const mostrados = filtrados.slice(0, visibles)

  const mover = (delta) => {
    const d = new Date(vista.anio, vista.mes + delta, 1)
    setVista({ anio: d.getFullYear(), mes: d.getMonth() })
  }
  const flecha = { width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h1>Calendario</h1>
          {error && <Aviso tono="red">{error}</Aviso>}
          {loading && !error && <div className="empty-state">Cargando…</div>}
          {!loading && (
            <>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button aria-label="Mes anterior" onClick={() => mover(-1)} style={flecha}><IconChevronLeft size={14} /></button>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{MESES[vista.mes][0].toUpperCase() + MESES[vista.mes].slice(1)} {vista.anio}</div>
                  <button aria-label="Mes siguiente" onClick={() => mover(1)} style={flecha}><IconChevronRight size={14} color="var(--acento)" /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, fontSize: 10, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>
                  {DIAS.map((d) => <div key={d}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                  {casillas.map((f, i) => {
                    if (!f) return <div key={`h${i}`} style={{ height: 32 }} />
                    const ev = porDia.get(f)
                    const cats = []
                    if (ev?.ingresos.some((x) => !x.omitida)) cats.push('nomina')
                    if (ev?.compromisos.some((x) => !x.omitida)) cats.push('servicio')
                    if (ev?.compras.length > 0) cats.push('compra')
                    return (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                        <button
                          className="mono"
                          onClick={() => setDia(f)}
                          aria-label={`Día ${parseISODate(f).getDate()}`}
                          style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontSize: 12, ...estiloDia(cats, f === hoy) }}
                        >
                          {parseISODate(f).getDate()}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--beige2)' }}>
                  <Leyenda color="var(--red)" solido texto="Hoy" />
                  <Leyenda color={COLOR.nomina} texto="Sueldos" />
                  <Leyenda color={COLOR.servicio} texto="Pagos fijos" />
                  <Leyenda color={COLOR.compra} texto="Whimm" />
                </div>
              </div>

              <div data-guia="proximos">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Próximos eventos</div>
                <div className="chiprow" style={{ marginBottom: 12 }}>
                  {FILTROS.map(([k, t]) => (
                    <span key={k} onClick={() => { setFiltro(k); setVisibles(20) }} className="pill" style={{ background: filtro === k ? 'var(--wine)' : 'transparent', color: filtro === k ? '#fff' : 'var(--muted)' }}>{t}</span>
                  ))}
                </div>
                <div className="row-list">
                  {mostrados.map((e) => (
                    <div key={e.id} className="row-list-item">
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[e.cat], flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{e.titulo}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{fechaCorta(e.fecha)}</span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: e.monto > 0 ? 'var(--green)' : 'var(--text)' }}>{e.monto > 0 ? '+' : ''}{fmt(Math.abs(e.monto))}</span>
                    </div>
                  ))}
                  {mostrados.length === 0 && <div className="empty-state">Sin eventos próximos para este filtro</div>}
                  {mostrados.length === 0 && guia.activa && (
                    <div className="row-list-item">
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR.nomina, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13 }}>Sueldo <span className="pill" style={{ background: 'var(--beige2)', color: 'var(--muted)', padding: '2px 8px', fontSize: 9, marginLeft: 4 }}>Ejemplo</span></span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>15 oct</span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>+$4,000</span>
                    </div>
                  )}
                </div>
                {filtrados.length > mostrados.length && (
                  <button onClick={() => setVisibles((n) => n + 20)} style={{ display: 'block', margin: '10px auto 0', fontSize: 12, fontWeight: 600, color: 'var(--acento)' }}>Ver más</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet abierto={!!dia} onClose={() => setDia(null)} titulo={dia ? `${diaSemanaCorto(dia)} ${parseISODate(dia).getDate()} de ${MESES[parseISODate(dia).getMonth()]}` : ''}>
        {dia && <DiaSheet key={dia} fecha={dia} evento={porDia.get(dia)} hoy={hoy} user={user} show={show} />}
      </Sheet>
      <Toast message={message} />
    </>
  )
}
