import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { IconClose } from '../../components/Icons'
import { useAuth } from '../../lib/AuthContext'
import { setUserDoc } from '../../lib/firestoreCollections'
import { marcarCobro } from '../lib/cobros'
import Modal from '../components/Modal'
import TileImagen from '../components/TileImagen'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { gastoNeto, todayISO } from '../lib/budget'
import { calcularAvisos, calcularVistaInicio, diaSemanaCorto, fechaCorta, fmt, textoDias } from '../lib/vista'

const signo = (n) => (n >= 0 ? '+' : '-') + fmt(Math.abs(n))

// Avisos que se pueden descartar (queda guardado en este dispositivo).
const CLAVE_DESCARTADOS = 'whital:avisos-descartados'

function leerDescartados() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DESCARTADOS) || '[]')
  } catch {
    return []
  }
}

function Avisos({ avisos }) {
  const [descartados, setDescartados] = useState(leerDescartados)
  const visibles = avisos.filter((a) => !descartados.includes(a.id))
  if (visibles.length === 0) return null

  const descartar = (id) => {
    const nuevos = [...descartados, id].slice(-60)
    setDescartados(nuevos)
    try {
      localStorage.setItem(CLAVE_DESCARTADOS, JSON.stringify(nuevos))
    } catch {
      /* sin almacenamiento: solo se oculta en esta sesión */
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visibles.map((a) => (
        <div key={a.id} className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>{a.texto}</div>
          <button style={{ fontSize: 11, color: 'var(--muted)' }} onClick={() => descartar(a.id)}>Listo</button>
        </div>
      ))}
    </div>
  )
}

// Detalle de un día de la semana: lo que se gastó ese día.
function DetalleDia({ dia, gastos, presupuestoDia, onCerrar }) {
  return (
    <Modal abierto onClose={onCerrar}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{dia.label} {fechaCorta(dia.fecha)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Presupuesto por día: {fmt(presupuestoDia)}</div>
        </div>
        <button aria-label="Cerrar" onClick={onCerrar} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconClose /></button>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500, marginBottom: 14, color: dia.gastado > presupuestoDia ? 'var(--red)' : 'var(--text)' }}>{fmt(dia.gastado)}</div>
      {gastos.length === 0 ? (
        <div className="empty-state" style={{ padding: '8px 0' }}>{dia.futuro ? 'Todavía no llega este día' : 'Sin gastos este día'}</div>
      ) : (
        <div className="row-list">
          {gastos.map((g) => (
            <div key={g.id} className="row-list-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{g.concepto}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{g.etiqueta || g.categoriaWhimm || 'General'}</div>
              </div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(gastoNeto(g))}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function Encabezado({ eyebrow, titulo, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 2px 10px' }}>
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 2 }}>{eyebrow}</div>}
        <div style={{ fontSize: 13, fontWeight: 600 }}>{titulo}</div>
      </div>
      {children}
    </div>
  )
}

// Cierre de la semana pasada: no se quita hasta que elijas a dónde va lo que sobró.
function CierreSemana({ cierre, user, show }) {
  const [guardando, setGuardando] = useState(false)
  const elegir = async (decision, mensaje) => {
    setGuardando(true)
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { cierresSemana: { [cierre.semanaInicio]: decision } })
      show(mensaje)
    } catch {
      show('No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }
  const sobro = cierre.sobra > 0
  const fila = { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }
  const boton = { flex: 1, borderRadius: 10, padding: '10px 8px', fontSize: 12, fontWeight: 600, textAlign: 'center' }
  return (
    <div className="card" style={{ padding: 16, border: '1.5px solid var(--wine)' }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Semana del {fechaCorta(cierre.semanaInicio)} al {fechaCorta(cierre.semanaFin)}</div>
      {sobro ? (
        <>
          {cierre.sobroEstaSemana > 0 && <div style={fila}><span>Te sobró</span><span className="mono">{fmt(cierre.sobroEstaSemana)}</span></div>}
          {cierre.guardadoAntes > 0 && <div style={fila}><span>Ya llevabas guardado</span><span className="mono">{fmt(cierre.guardadoAntes)}</span></div>}
          <div style={{ ...fila, fontWeight: 600 }}><span>Juntas</span><span className="mono">{fmt(cierre.sobra)}</span></div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
            Mantener: {fmt(cierre.siMantiene.total)} esta semana ({fmt(cierre.siMantiene.porDia)} por día)<br />
            A Whimms: {fmt(cierre.siWhimms.total)} ({fmt(cierre.siWhimms.porDia)} por día)
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button disabled={guardando} style={{ ...boton, background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => elegir('whimms', 'Fue a Whimms')}>A Whimms</button>
            <button disabled={guardando} style={{ ...boton, background: 'var(--wine)', color: '#fff' }} onClick={() => elegir('mantener', 'Se mantiene esta semana')}>Mantener</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Te pasaste {fmt(cierre.pasado)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Lo cubrió Whimms. Esta semana empiezas con {fmt(cierre.siWhimms.total)}.</div>
          <button disabled={guardando} style={{ ...boton, width: '100%', marginTop: 12, background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => elegir('whimms', 'Listo')}>Listo</button>
        </>
      )}
    </div>
  )
}

export default function Inicio() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const vista = useMemo(() => (loading ? null : calcularVistaInicio(datos, hoy)), [datos, loading, hoy])
  const avisos = useMemo(() => (vista ? calcularAvisos(datos, hoy) : []), [datos, hoy, vista])
  const nombre = user?.displayName?.split(' ')[0] || 'Pame'
  const [diaAbierto, setDiaAbierto] = useState(null)

  // Un sueldo cuenta en tu saldo desde su día de cobro. Si todavía no te depositan,
  // "Aún no llega" lo resta hasta que le des "Ya llegó".
  const marcarSueldo = async (a) => {
    const sueldo = datos.sueldosFijos.find((x) => x.id === a.sueldoId)
    try {
      await marcarCobro(user.uid, sueldo, a.fecha, a.pendiente)
      show(a.pendiente ? 'Sueldo sumado a tu saldo' : 'Se sumará cuando llegue')
    } catch {
      show('No se pudo actualizar')
    }
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/perfil" aria-label="Mi perfil" data-guia="avatar" style={{ width: 48, height: 48, borderRadius: 24, flexShrink: 0, overflow: 'hidden', background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 600 }}>
            {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : nombre.charAt(0).toUpperCase()}
          </Link>
          <div>
            <div className="eyebrow">{diaSemanaCorto(hoy)} · {fechaCorta(hoy)}</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>Hola, {nombre}</div>
          </div>
        </div>

        {error && <div className="card" style={{ padding: 12, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
        {!vista && !error && <div className="empty-state">Cargando…</div>}

        {vista && (
          <>
            {vista.cierrePendiente && <CierreSemana cierre={vista.cierrePendiente} user={user} show={show} />}
            <Avisos avisos={avisos} />

            <div className="hero hero-vivo">
              <div className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>Saldo real en banco</div>
              <div className="mono stat-display" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 6 }}>
                {fmt(vista.saldoReal)}
                <span style={{ fontSize: 16, opacity: 0.7 }}> MXN</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <div className="tile-hoy" style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
                  <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}><span className="punto-vivo" />Para gastar hoy</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3, color: vista.paraHoy < 0 ? '#ffb4b4' : 'inherit' }}>
                    {fmt(vista.paraHoy)}
                  </div>
                </div>
                {vista.proximaCompra ? (
                  <Link to="/whimms" state={{ openWhimmId: vista.proximaCompra.id }} style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px', color: 'inherit' }}>
                    <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vista.proximaCompra.whimm?.name}</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>{vista.proximaCompra.dias <= 0 ? 'Hoy' : textoDias(vista.proximaCompra.dias)}</div>
                  </Link>
                ) : (
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
                    <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Próxima compra</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>—</div>
                  </div>
                )}
              </div>
            </div>

            <div className="card" data-guia="semana" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Esta semana · gasto por día</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: vista.caja.restante < 0 ? 'var(--red)' : 'var(--text)' }}>
                {vista.caja.restante < 0 ? `Te pasaste ${fmt(-vista.caja.restante)} de la semana` : `Te quedan ${fmt(vista.caja.restante)} de ${fmt(vista.caja.total)}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {fmt(vista.asignadoHoy)} por día · {textoDias(vista.caja.diasRestantes)}{vista.caja.arrastre > 0 ? ` · incluye ${fmt(vista.caja.arrastre)} guardados` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, marginTop: 14 }}>
                {(() => {
                  const max = Math.max(...vista.dias.map((d) => d.gastado), vista.presupuestoSemanal / 7, 1)
                  return vista.dias.map((d, i) => (
                    <button key={d.fecha} onClick={() => setDiaAbierto(d)} aria-label={`Gastos del ${d.label}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '100%', height: 44, display: 'flex', alignItems: 'flex-end' }}>
                        <div className={d.esHoy ? 'barra-dia barra-hoy' : d.futuro ? '' : 'barra-dia'} style={{ width: '100%', height: `${Math.max((d.gastado / max) * 100, d.gastado > 0 ? 6 : 2)}%`, borderRadius: 4, background: d.futuro ? 'var(--beige2)' : d.esHoy ? 'var(--verde-vivo)' : 'var(--wine4)', animationDelay: `${i * 70}ms` }} />
                      </div>
                      <span style={{ fontSize: 9, color: d.esHoy ? 'var(--acento)' : 'var(--muted)', fontWeight: d.esHoy ? 700 : 500 }}>{d.label}</span>
                    </button>
                  ))
                })()}
              </div>
            </div>

            <div className="card" data-guia="acciones" style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Acciones del día de hoy</div>
              {vista.accionesHoy.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {vista.accionesHoy.map((a) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{a.titulo}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{a.sub}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: a.pendiente ? 'var(--muted)' : a.monto > 0 ? 'var(--green)' : 'var(--text)', textDecoration: a.pendiente ? 'line-through' : 'none' }}>{signo(a.monto)}</span>
                        {a.sueldoId && <button className="pill" style={{ background: 'var(--beige2)', color: 'var(--acento)', padding: '5px 10px', fontSize: 11 }} onClick={() => marcarSueldo(a)}>{a.pendiente ? 'Ya llegó' : 'Aún no llega'}</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '8px 0' }}>Nada pendiente para hoy</div>
              )}
            </div>

            <div>
              <Encabezado eyebrow="Lista de espera" titulo="Whimms">
                <Link to="/whimms" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acento)' }}>Ver todos ›</Link>
              </Encabezado>
              {vista.colaDetallada.length > 0 ? (
                <div className="row-list">
                  {vista.colaDetallada.slice(0, 5).map((r, i) => (
                    <Link key={r.id} to="/whimms" state={{ openWhimmId: r.id }} className="row-list-item">
                      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--wine4)', width: 16 }}>{i + 1}</div>
                      <TileImagen url={r.whimm?.imagenUrl} size={36} radius={10} icono={16} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.whimm?.name}</div>
                        <div style={{ fontSize: 10, marginTop: 1, color: r.estatus === 'tarde' || r.estatus === 'sin_fecha_segura' ? 'var(--red)' : 'var(--muted)' }}>
                          {r.estatus === 'tarde' ? 'Llegaría tarde' : r.estatus === 'sin_fecha_segura' ? 'Sin fecha segura' : r.estatus === 'comprable_hoy' ? 'Comprable hoy' : r.intercambiado ? 'Espera al lunes' : 'En espera'}
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(r.whimm?.precio)}</div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Sin Whimms todavía</div>
              )}
            </div>

            <div>
              <Encabezado eyebrow="Próximos" titulo="Vitalls · 7 días">
                <Link to="/vitalls" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acento)' }}>Ver todos ›</Link>
              </Encabezado>
              {vista.vitalls.length > 0 ? (
                <div className="row-list">
                  {vista.vitalls.map((v) => (
                    <div key={`${v.pagoId}-${v.fecha}`} className="row-list-item" style={{ opacity: v.omitida ? 0.5 : 1 }}>
                      <div style={{ width: 44 }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{diaSemanaCorto(v.fecha)}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fechaCorta(v.fecha)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, textDecoration: v.omitida ? 'line-through' : 'none' }}>{v.name}</div>
                      <div className="mono" style={{ fontSize: 13 }}>{fmt(v.monto)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Nada vence esta semana</div>
              )}
            </div>

            <div data-guia="cajitas">
              <Encabezado eyebrow="Cajitas" titulo={`Próximo cobro: ${fechaCorta(vista.cajitas.proximoCobro)}`} />
              <div className="row-list">
                {[['Saldo principal', vista.cajitas.saldoPrincipal], ['Cajita Vitalls', vista.cajitas.cajitaVitalls], ['Cajita Whimms', vista.cajitas.cajitaWhimms]].map(([nombreCaja, monto]) => (
                  <div key={nombreCaja} className="row-list-item">
                    <span style={{ flex: 1, fontSize: 13 }}>{nombreCaja}</span>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: monto < 0 ? 'var(--red)' : 'var(--text)' }}>{fmt(monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {diaAbierto && <DetalleDia dia={diaAbierto} gastos={datos.gastos.filter((g) => g.categoria !== 'Vitall' && g.fecha === diaAbierto.fecha)} presupuestoDia={(vista?.presupuestoSemanal || 0) / 7} onCerrar={() => setDiaAbierto(null)} />}
      <Toast message={message} />
    </div>
  )
}
