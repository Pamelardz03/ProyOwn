import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Toggle from '../../components/Toggle'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/AuthContext'
import { addUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import { useWhitalDatos } from '../hooks/useWhitalDatos'
import { calcularAjusteSaldo, todayISO } from '../lib/budget'
import { calcularAvisos, calcularVistaInicio, diaSemanaCorto, fechaCorta, fmt, parametrosMotor, textoDias } from '../lib/vista'

const ETIQUETA_ESTATUS = {
  comprable_hoy: { texto: 'Comprable hoy', color: 'var(--green)', bg: 'var(--green-bg)' },
  en_fecha: { texto: 'En fecha', color: 'var(--green)', bg: 'var(--green-bg)' },
  tarde: { texto: 'Llegaría tarde', color: 'var(--red)', bg: 'var(--red-bg)' },
  sin_fecha_segura: { texto: 'Sin fecha segura', color: 'var(--red)', bg: 'var(--red-bg)' },
}

function Badge({ estatus, children }) {
  const e = ETIQUETA_ESTATUS[estatus] || ETIQUETA_ESTATUS.en_fecha
  return (
    <span className="pill" style={{ background: e.bg, color: e.color, padding: '4px 10px', fontSize: 11 }}>
      {children || e.texto}
    </span>
  )
}

// Avisos dentro de la app. Se pueden descartar (queda guardado en este
// dispositivo); los de Vitall dejan omitir esa ocurrencia desde el mismo aviso.
const CLAVE_DESCARTADOS = 'whital:avisos-descartados'

function leerDescartados() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DESCARTADOS) || '[]')
  } catch {
    return []
  }
}

function AvisosInicio({ avisos, user, show }) {
  const [descartados, setDescartados] = useState(leerDescartados)
  const visibles = avisos.filter((a) => !descartados.includes(a.id))
  if (visibles.length === 0) return null

  const descartar = (id) => {
    const nuevos = [...descartados, id].slice(-60)
    setDescartados(nuevos)
    try {
      localStorage.setItem(CLAVE_DESCARTADOS, JSON.stringify(nuevos))
    } catch {
      /* sin almacenamiento: el aviso solo se oculta en esta sesión */
    }
  }
  const omitir = async (a) => {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', a.vitall.pagoId, { [`excepciones.${a.vitall.fecha}`]: { omitida: true } })
      show('Ocurrencia omitida')
    } catch {
      show('No se pudo omitir')
    }
  }

  const color = { cierre: 'var(--wine)', cobro: 'var(--green)', vitall: 'var(--amber)', registro: 'var(--muted)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visibles.map((a) => (
        <div key={a.id} className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${color[a.tipo]}` }}>
          <div style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>{a.texto}</div>
          {a.tipo === 'vitall' && <button style={{ fontSize: 11, color: 'var(--wine)', fontWeight: 700 }} onClick={() => omitir(a)}>Omitir</button>}
          <button style={{ fontSize: 11, color: 'var(--muted)' }} onClick={() => descartar(a.id)} aria-label="Descartar aviso">Listo</button>
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
      <button onClick={() => setAbierto(true)} style={{ marginTop: 12, color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}>
        Ajustar saldo a mi banco
      </button>
    )
  }
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        className="fld"
        type="number"
        inputMode="decimal"
        placeholder="¿Cuánto hay hoy en tu banco?"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      {ajuste != null && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)' }}>
          {Math.abs(ajuste) < 0.005 ? 'Ya coincide con tu banco.' : `Diferencia a registrar: ${ajuste > 0 ? '+' : ''}${fmt(ajuste)}`}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="segbtn" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setAbierto(false)}>Cancelar</button>
        <button className="segbtn" style={{ background: '#fff', color: 'var(--wine)' }} onClick={guardar}>Guardar ajuste</button>
      </div>
    </div>
  )
}

function CardGastosSemana({ vista }) {
  const { bolsas, dias, presupuestoSemanal, analisis } = vista
  const max = Math.max(...dias.map((d) => d.gastado), presupuestoSemanal / 7, 1)
  const pasado = bolsas.disponibleSemana < 0
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="eyebrow">Gastos de la semana</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, color: pasado ? 'var(--red)' : 'var(--text)' }}>
        {pasado
          ? `Te pasaste ${fmt(-bolsas.disponibleSemana)} esta semana`
          : `Te quedan ${fmt(bolsas.disponibleSemana)} para los próximos ${textoDias(bolsas.diasRestantesSemana)}`}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
        Llevas {fmt(bolsas.gastadoSemanaActual)} de {fmt(presupuestoSemanal)}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, marginTop: 14 }}>
        {dias.map((d) => (
          <div key={d.fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: 44, display: 'flex', alignItems: 'flex-end' }}>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max((d.gastado / max) * 100, d.gastado > 0 ? 6 : 2)}%`,
                  borderRadius: 4,
                  background: d.futuro ? 'var(--beige2)' : d.esHoy ? 'var(--wine)' : 'var(--wine4)',
                }}
              />
            </div>
            <span style={{ fontSize: 9, color: d.esHoy ? 'var(--wine)' : 'var(--muted)', fontWeight: d.esHoy ? 700 : 500 }}>{d.label}</span>
          </div>
        ))}
      </div>
      {analisis.aviso && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--amber)', lineHeight: 1.4 }}>
          {analisis.recomendarCambio
            ? `Varias semanas seguidas te pasas de ${fmt(analisis.presupuesto)}. Lo que más has gastado por semana es ${fmt(analisis.sugerido)}; considera subir tu presupuesto semanal.`
            : analisis.aviso === 'recurrente'
              ? `Varias semanas seguidas te pasas de ${fmt(analisis.presupuesto)}.`
              : analisis.confiable
                ? 'Esta semana te pasaste del presupuesto; si pasa seguido, te sugeriré moverlo.'
                : 'Esta semana te pasaste del presupuesto. Con 3 semanas cerradas te podré sugerir un monto.'}
        </div>
      )}
    </div>
  )
}

function CardProximoWhimm({ vista }) {
  const { proximoWhimm: p, whimmsEnRiesgo, comprablesHoy } = vista
  if (!p) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="eyebrow">Próximo Whimm</div>
        <div className="empty-state">Aún no tienes Whimms en la fila.</div>
      </div>
    )
  }
  const w = p.whimm || {}
  const apartado = Number(w.montoApartado) || 0
  const precio = Number(w.precio) || 0
  const pct = precio > 0 ? Math.min(Math.round((apartado / precio) * 100), 100) : 0
  const fecha = p.estatus === 'comprable_hoy' ? 'Hoy' : p.fechaProyectada ? fechaCorta(p.fechaProyectada) : null
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="eyebrow">Próximo Whimm</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
        {w.imagenUrl ? (
          <img src={w.imagenUrl} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', background: 'var(--beige2)' }} />
        ) : (
          <div className="icon-tile" style={{ width: 56, height: 56, fontSize: 22, fontWeight: 600 }}>{(w.name || '?').trim().charAt(0).toUpperCase()}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name || 'Whimm'}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{fmt(precio)}</div>
          <div style={{ marginTop: 6 }}>
            <Badge estatus={p.estatus}>
              {p.estatus === 'tarde' || p.estatus === 'sin_fecha_segura'
                ? `Llegaría tarde (límite ${fechaCorta(p.fechaLimite)})`
                : fecha ? `${p.estatus === 'comprable_hoy' ? 'Comprable hoy' : 'Se compra el'}${p.estatus === 'comprable_hoy' ? '' : ` ${fecha}`}` : 'Sin fecha'}
            </Badge>
          </div>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--beige2)', marginTop: 12, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--wine4)' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        {apartado > 0 ? `${fmt(apartado)} apartados (${pct}%)` : 'Sin fondos apartados todavía'}
        {comprablesHoy > 0 ? ` · ${comprablesHoy} comprable${comprablesHoy > 1 ? 's' : ''} hoy` : ''}
      </div>
      {vista.whimmsIntercambiados.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--amber)', lineHeight: 1.4 }}>
          Por pasarte del presupuesto esta semana, esperan hasta el lunes: {vista.whimmsIntercambiados.map((r) => r.whimm?.name || r.id).join(', ')}.
        </div>
      )}
      {whimmsEnRiesgo.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--red)', lineHeight: 1.4 }}>
          Fechas en riesgo: {whimmsEnRiesgo.map((r) => `${r.whimm?.name || r.id} (límite ${fechaCorta(r.fechaLimite)})`).join(', ')}
        </div>
      )}
    </div>
  )
}

function CardVitalls({ vista, user, show }) {
  const alternar = async (v) => {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', v.pagoId, { [`excepciones.${v.fecha}`]: { omitida: !v.omitida } })
      show(v.omitida ? 'Ocurrencia restaurada' : 'Ocurrencia omitida')
    } catch {
      show('No se pudo actualizar')
    }
  }
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="eyebrow">Próximos Vitalls · 7 días</div>
      {vista.vitalls.length === 0 ? (
        <div className="empty-state">Nada vence en los próximos 7 días.</div>
      ) : (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
          {vista.vitalls.map((v) => (
            <div key={`${v.pagoId}-${v.fecha}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--beige2)', opacity: v.omitida ? 0.5 : 1 }}>
              <div style={{ width: 44 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{diaSemanaCorto(v.fecha)}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fechaCorta(v.fecha)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, textDecoration: v.omitida ? 'line-through' : 'none' }}>{v.name}</div>
              <div className="mono" style={{ fontSize: 12 }}>{fmt(v.monto)}</div>
              <Toggle on={v.omitida} onClick={() => alternar(v)} ariaLabel={v.omitida ? 'Restaurar ocurrencia' : 'Omitir ocurrencia'} />
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Activa el interruptor para omitir esa fecha.</div>
        </div>
      )}
    </div>
  )
}

function CardCajitas({ cajitas }) {
  const filas = [
    { nombre: 'Saldo Principal', nota: 'Débito · gastos de la semana', monto: cajitas.saldoPrincipal },
    { nombre: 'Cajita Vitalls', nota: `Reserva hasta el cobro del ${fechaCorta(cajitas.proximoCobro)}`, monto: cajitas.cajitaVitalls },
    { nombre: 'Cajita Whimms', nota: 'Libre para tu fila + MSI próximos', monto: cajitas.cajitaWhimms },
  ]
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="eyebrow">Cajitas Nu · guía</div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
        {filas.map((f) => (
          <div key={f.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--beige2)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{f.nombre}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{f.nota}</div>
            </div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: f.monto < 0 ? 'var(--red)' : 'var(--text)' }}>{fmt(f.monto)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
        Solo orientativo: no se conecta a tu banco. Es un indicador, no una cuenta.
      </div>
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

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow">Whital</div>
          <h1>Inicio</h1>
        </div>
        <Link to="/ajustes" style={{ fontSize: 12, color: 'var(--wine)', fontWeight: 600 }}>Ajustes</Link>
      </div>

      {error && <div className="card" style={{ padding: 12, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
      {!vista && !error && <div className="empty-state">Cargando…</div>}

      {vista && (
        <>
          <AvisosInicio avisos={avisos} user={user} show={show} />
          <div className="hero">
            <div className="eyebrow" style={{ color: 'rgba(255,255,255,.65)' }}>Saldo real en banco</div>
            <div className="stat-display mono" style={{ fontSize: 40, marginTop: 6 }}>{fmt(vista.saldoReal)}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>
              Libre para Whimms: {fmt(vista.bolsas.bolsaWhimms)}
            </div>
            <AjustarSaldo datos={datos} hoy={hoy} user={user} show={show} />
          </div>
          <CardGastosSemana vista={vista} />
          <CardProximoWhimm vista={vista} />
          <CardVitalls vista={vista} user={user} show={show} />
          <CardCajitas cajitas={vista.cajitas} />
        </>
      )}
      <Toast message={message} />
    </div>
  )
}
