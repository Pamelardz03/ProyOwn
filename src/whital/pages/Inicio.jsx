import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc } from '../../lib/firestoreCollections'
import TileImagen from '../components/TileImagen'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { calcularAjusteSaldo, todayISO } from '../lib/budget'
import { calcularAvisos, calcularVistaInicio, diaSemanaCorto, fechaCorta, fmt, parametrosMotor, textoDias } from '../lib/vista'

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

function AjustarSaldo({ datos, hoy, user, show }) {
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState('')
  const numero = valor === '' ? null : Number(valor)
  const ajuste = numero != null && Number.isFinite(numero) ? calcularAjusteSaldo({ saldoBancoReal: numero, ...parametrosMotor(datos, hoy) }) : null

  const guardar = async () => {
    if (ajuste == null || Math.abs(ajuste) < 0.005) return
    try {
      await addUserDoc(user.uid, 'ajustesSaldo', { fecha: hoy, monto: ajuste, saldoBanco: numero, nota: 'Ajuste a mi banco' })
      show('Saldo ajustado')
      setAbierto(false)
      setValor('')
    } catch {
      show('No se pudo guardar el ajuste')
    }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={{ marginTop: 12, color: 'rgba(255,255,255,.75)', fontSize: 11, fontWeight: 500, textDecoration: 'underline' }}>
        Ajustar a mi banco
      </button>
    )
  }
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input className="fld" type="number" inputMode="decimal" placeholder="Saldo real en tu banco" value={valor} onChange={(e) => setValor(e.target.value)} />
      {ajuste != null && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)' }}>
          {Math.abs(ajuste) < 0.005 ? 'Ya coincide.' : `Diferencia: ${signo(ajuste)}`}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="segbtn" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setAbierto(false)}>Cancelar</button>
        <button className="segbtn" style={{ background: '#fff', color: 'var(--wine)' }} onClick={guardar}>Guardar</button>
      </div>
    </div>
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

export default function Inicio() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const hoy = todayISO()
  const vista = useMemo(() => (loading ? null : calcularVistaInicio(datos, hoy)), [datos, loading, hoy])
  const avisos = useMemo(() => (vista ? calcularAvisos(datos, hoy, vista.bolsas) : []), [datos, hoy, vista])
  const nombre = user?.displayName?.split(' ')[0] || 'Pame'

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div className="eyebrow">{diaSemanaCorto(hoy)} · {fechaCorta(hoy)}</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>Hola, {nombre}</div>
        </div>

        {error && <div className="card" style={{ padding: 12, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
        {!vista && !error && <div className="empty-state">Cargando…</div>}

        {vista && (
          <>
            <Avisos avisos={avisos} />

            <div className="hero">
              <div className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>Saldo real en banco</div>
              <div className="mono stat-display" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 6 }}>
                {fmt(vista.saldoReal)}
                <span style={{ fontSize: 16, opacity: 0.7 }}> MXN</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
                  <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Para gastar hoy</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3, color: vista.bolsas.promedioDiarioRestante < 0 ? '#ffb4b4' : 'inherit' }}>
                    {fmt(vista.bolsas.promedioDiarioRestante)}
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
              <AjustarSaldo datos={datos} hoy={hoy} user={user} show={show} />
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Esta semana</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: vista.bolsas.disponibleSemana < 0 ? 'var(--red)' : 'var(--text)' }}>
                {vista.bolsas.disponibleSemana < 0
                  ? `Te pasaste ${fmt(-vista.bolsas.disponibleSemana)}`
                  : `Te quedan ${fmt(vista.bolsas.disponibleSemana)} para ${textoDias(vista.bolsas.diasRestantesSemana)}`}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{fmt(vista.bolsas.gastadoSemanaActual)} de {fmt(vista.presupuestoSemanal)}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, marginTop: 14 }}>
                {(() => {
                  const max = Math.max(...vista.dias.map((d) => d.gastado), vista.presupuestoSemanal / 7, 1)
                  return vista.dias.map((d) => (
                    <div key={d.fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '100%', height: 44, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${Math.max((d.gastado / max) * 100, d.gastado > 0 ? 6 : 2)}%`, borderRadius: 4, background: d.futuro ? 'var(--beige2)' : d.esHoy ? 'var(--wine)' : 'var(--wine4)' }} />
                      </div>
                      <span style={{ fontSize: 9, color: d.esHoy ? 'var(--wine)' : 'var(--muted)', fontWeight: d.esHoy ? 700 : 500 }}>{d.label}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Acciones del día de hoy</div>
              {vista.accionesHoy.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {vista.accionesHoy.map((a) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{a.titulo}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{a.sub}</div>
                      </div>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: a.monto > 0 ? 'var(--green)' : 'var(--text)' }}>{signo(a.monto)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '8px 0' }}>Nada pendiente para hoy</div>
              )}
            </div>

            <div>
              <Encabezado eyebrow="Lista de espera" titulo="Whimms">
                <Link to="/whimms" style={{ fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>Ver todos ›</Link>
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
                <Link to="/vitalls" style={{ fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>Ver todos ›</Link>
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

            <div>
              <Encabezado eyebrow="Cajitas Nu" titulo={`Próximo cobro: ${fechaCorta(vista.cajitas.proximoCobro)}`} />
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
      <Toast message={message} />
    </div>
  )
}
