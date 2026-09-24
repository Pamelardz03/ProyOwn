import { Link, useNavigate } from 'react-router-dom'
import AddSheet from '../components/AddSheet'
import Onboarding from '../components/Onboarding'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconEdit } from '../components/Icons'
import { fmt, fmtSigned } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, useUserDoc } from '../lib/firestoreCollections'
import { daysUntil, formatShortDate, isThisMonth, todayISO, weekdayShort } from '../lib/date'
import { monthlyEqPagoFijo, gastoNeto, disponibleParaWhimms, construirFlujoFuturo, proyectarColaWhimms } from '../lib/budget'
import { computeWhimmScore } from '../lib/score'
import { deriveWhimmCats } from '../lib/categorias'
import { buildHistorialEvents } from '../lib/historial'

const ESTADO_LABEL = { espera: 'En espera', apartando: 'Apartando fondos' }

// Convierte el timestamp de Firestore (serverTimestamp resuelto) a milisegundos
// para poder ordenar por fecha real; mientras está pendiente de confirmar con
// el servidor puede venir como null, ahí cae al final del orden.
function toMillis(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

// Días transcurridos desde un timestamp de Firestore — usado como
// aproximación de "cuánto lleva acumulando" el Whimm top (no tenemos todavía
// un campo que marque cuándo pasó a estado "apartando" específicamente).
function daysSinceMillis(ms) {
  if (!ms) return null
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000))
}

function DonutChart({ items }) {
  const total = items.reduce((s, it) => s + it.monto, 0)
  const circumference = 2 * Math.PI * 15.5
  let offset = 0
  return (
    <svg width="104" height="104" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--beige2)" strokeWidth="5" />
      {items.map((it, i) => {
        const frac = total > 0 ? it.monto / total : 0
        const dash = frac * circumference
        const el = (
          <circle
            key={i}
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={it.color}
            strokeWidth="5"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

export default function Inicio() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { message, show } = useToast()

  const { data: gastos } = useUserCollection('gastos')
  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: whimms } = useUserCollection('whimms')
  const { data: configPresupuesto, loading: loadingConfig } = useUserDoc('config', 'presupuesto')
  // Mismos defaults que Compras.jsx/Calendario.jsx, para que la proyección
  // de "próxima compra" use exactamente la misma cuenta que esas pantallas.
  const whimmsSimultaneos = configPresupuesto?.whimmsSimultaneos || 3
  const saldoInicial = Number(configPresupuesto?.saldoInicial) || 0
  const porcentajeWhimms = configPresupuesto?.porcentajeWhimms != null ? configPresupuesto.porcentajeWhimms : 0.5

  const cats = deriveWhimmCats(whimms, gastos)

  const primerNombre = user?.displayName?.split(' ')[0] || 'Pame'

  // Igual que totalGastosHasta (src/lib/budget.js): un Gasto tipo Vitall
  // ya se resta del saldo real vía el calendario de vencimientos, así que
  // si alguna vez se registra uno (Pame decidió no hacerlo, pero un amigo
  // que use la app podría no saber esa convención) no debe sumarse también
  // aquí — antes sí se sumaba, lo que hubiera restado el mismo pago dos
  // veces de "Saldo del mes" (encontrado 21 sep, quinceava tanda).
  const gastosMes = gastos.filter((g) => isThisMonth(g.fecha) && !(g.categoria === 'Vitall' && g.vitallId))
  const gastoMensual = gastosMes.reduce((s, g) => s + gastoNeto(g), 0)

  const pagosActivos = pagosFijos.filter((p) => p.activo !== false)
  const vitallMensual = pagosActivos.filter((p) => p.tipo === 'Vitall').reduce((s, p) => s + monthlyEqPagoFijo(p), 0)
  const otrosFijosMensual = pagosActivos.filter((p) => p.tipo !== 'Vitall').reduce((s, p) => s + monthlyEqPagoFijo(p), 0)

  const hoy = todayISO()

  // Dinero real disponible para Whimms AHORA (mismo cálculo que Compras/
  // Gastos/Perfil) — se calcula aquí arriba porque "Saldo para compras"
  // (justo abajo) y "Próxima compra" (más abajo) lo comparten.
  const disponibleWhimmsInicio = disponibleParaWhimms({ sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms })

  // Saldo para compras (vigésima séptima tanda, corrección explícita de
  // Pame: la versión anterior, "ingreso del mes - gastado del mes", daba
  // un número muy por encima de lo que de verdad tenía en el banco (3677
  // contra 2400 reales) porque es un cálculo de calendario que no resta
  // los pagos fijos/Vitall reservados ni considera el saldo real
  // acumulado (saldoInicial, lo ya comprado, etc.) — solo compara ingreso
  // vs. gasto DENTRO del mes actual. Ahora usa exactamente el mismo
  // número real y ya validado que el resto de la app (`disponibleParaWhimms`,
  // calculado más abajo como `disponibleWhimmsInicio`): el dinero para
  // Whimms que de verdad se tiene disponible AHORA, sin proyectar nada
  // que todavía no haya llegado.
  const saldoParaCompras = disponibleWhimmsInicio

  // Racha de días sin ningún Gasto registrado (cualquier tipo) — la fecha
  // del Gasto más reciente hasta hoy, cero si hay uno hoy mismo.
  const fechaUltimoGasto = gastos.reduce((max, g) => (g.fecha && g.fecha > (max || '') ? g.fecha : max), null)
  const diasSinGastar = fechaUltimoGasto ? Math.max(-daysUntil(fechaUltimoGasto), 0) : null

  // Próxima compra de la fila de Whimms (23 sep, a pedido de Pame, en vez
  // del tile de "Próximo pago"): mismo motor real que Compras.jsx/
  // Calendario.jsx (`proyectarColaWhimms`, con el canal de cadencia mínima
  // de la tanda 24), así que puede ser un Whimm que no es el #1 por score
  // si ya le tocó "turno especial". Se toma el de fecha proyectada más
  // próxima entre TODOS los activos, no solo el primero de la fila.
  const activosParaProyeccion = whimms
    .filter((w) => w.estado !== 'comprado')
    .map((w) => ({ ...w, _score: computeWhimmScore(w) }))
    .sort((a, b) => b._score - a._score)
  const eventosFlujoInicio = construirFlujoFuturo({ sueldosFijos, pagosFijos })
  const ultimaCompraISOInicio = whimms
    .filter((w) => w.estado === 'comprado')
    .reduce((max, w) => (w.compradoEn && w.compradoEn > (max || '') ? w.compradoEn : max), null)
  const proximaCompra = proyectarColaWhimms(activosParaProyeccion, eventosFlujoInicio, porcentajeWhimms, disponibleWhimmsInicio, whimmsSimultaneos, ultimaCompraISOInicio)
    .filter((w) => w.fechaProyectada)
    .sort((a, b) => (a.fechaProyectada < b.fechaProyectada ? -1 : a.fechaProyectada > b.fechaProyectada ? 1 : 0))[0] || null
  const diasProximaCompra = proximaCompra ? daysUntil(proximaCompra.fechaProyectada) : null

  // Whimms comprados este mes — lo que realmente salió del banco (se resta
  // lo que ya estaba apartado en efectivo/otra cuenta, igual que en
  // totalWhimmsCompradosHasta). Van separados de "Gastos": esos son gasto
  // hormiga espontáneo, esto es wishlist planeada.
  const whimmsCompradosMes = whimms.filter((w) => w.estado === 'comprado' && isThisMonth(w.compradoEn))
  const whimmMensual = whimmsCompradosMes.reduce((s, w) => {
    const precioFinal = Number(w.precioComprado ?? w.precio) || 0
    const yaApartado = Number(w.montoApartado) || 0
    return s + Math.max(precioFinal - yaApartado, 0)
  }, 0)

  const distribucion = [
    { label: 'Gastos', color: 'var(--wine)', monto: gastoMensual },
    { label: 'Whimms', color: 'var(--green)', monto: whimmMensual },
    { label: 'Pagos fijos', color: 'var(--wine4)', monto: otrosFijosMensual },
    { label: 'Vitall', color: 'var(--amber)', monto: vitallMensual },
  ].filter((d) => d.monto > 0)
  const totalDistribucion = distribucion.reduce((s, d) => s + d.monto, 0)

  // Cola de Whimms ordenada por score (necesidad/deseo/precio) — el #1 es
  // el que está acumulando fondos activamente.
  const whimmsTop = whimms
    .filter((w) => w.estado !== 'comprado')
    .map((w) => ({ ...w, _score: computeWhimmScore(w) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)

  // Historial reciente: mismo feed sin filtro que Historial completo (a
  // pedido de Pame — antes Inicio solo mostraba gastos/sueldos rápidos/
  // Whimms comprados, no sueldos fijos depositados ni los eventos de
  // "Cambios" como crear un Whimm o un Vitall).
  const historial = buildHistorialEvents({ gastos, sueldosRapidos, sueldosFijos, pagosFijos, whimms, hoyISO: hoy })
    .sort((a, b) => (b.dateISO < a.dateISO ? -1 : b.dateISO > a.dateISO ? 1 : 0))
    .slice(0, 8)

  // Igual que en Historial completo (a pedido de Pame, vigésima séptima
  // tanda: "que se edite todos los registros de historial... también en
  // historial de la página de inicio") — cada tipo navega a donde ya
  // vive su edición real. La ocurrencia puntual de un pago fijo no tiene
  // editor propio aquí (vive en Historial completo), así que manda ahí.
  function handleHistorialEditClick(h) {
    if (h.editable === 'whimm') { navigate('/compras', { state: { openWhimmId: h.whimmId } }); return }
    if (h.editable === 'gasto') { navigate('/gastos', { state: { openGastoId: h.gastoId } }); return }
    if (h.editable === 'sueldoRapido') { navigate('/perfil/sueldos', { state: { openRapidoId: h.sueldoRapidoId } }); return }
    if (h.editable === 'pagoFijoDef') { navigate('/perfil/precios-fijos', { state: { openPagoId: h.pagoFijoId } }); return }
    if (h.editable === 'pagoFijoOcurrencia') { navigate('/perfil/historial'); return }
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div className="eyebrow">{weekdayShort(todayISO())} · {formatShortDate(todayISO())}</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>
            Hola, {primerNombre}
            {diasSinGastar != null && diasSinGastar > 0 && (
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>
                {' · '}{diasSinGastar} día{diasSinGastar === 1 ? '' : 's'} sin gastar
              </span>
            )}
          </div>
        </div>

        <div className="hero">
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>Saldo para compras</div>
          <div className="mono stat-display" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 6 }}>
            {fmt(saldoParaCompras)}
            <span style={{ fontSize: 16, opacity: 0.7 }}> MXN</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
              <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Acumulado</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>{fmt(gastoMensual)}</div>
            </div>
            {proximaCompra ? (
              <Link
                to="/compras"
                state={{ openWhimmId: proximaCompra.id }}
                style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px', color: 'inherit' }}
              >
                <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {proximaCompra.name}
                </div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>
                  {diasProximaCompra != null && diasProximaCompra <= 0 ? 'Hoy' : `${diasProximaCompra} días`}
                </div>
              </Link>
            ) : (
              <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '11px 12px' }}>
                <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>Próxima compra</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 3 }}>—</div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Presupuesto</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Distribución del mes</div>
          {totalDistribucion > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <DonutChart items={distribucion} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  {distribucion.map((d) => (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1 }}>{d.label}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{fmt(d.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--beige2)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Total</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(totalDistribucion)}</span>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '8px 0' }}>Sin movimientos este mes todavía</div>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Lista de espera</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Whimms</div>
            <Link to="/compras" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              Ver todos ›
            </Link>
          </div>
          {whimmsTop.length > 0 ? (
            <div className="row-list">
              {whimmsTop.map((w, i) => {
                const diasAcumulando = i === 0 && w.estado === 'apartando' ? daysSinceMillis(toMillis(w.creadoEn)) : null
                return (
                  <Link key={w.id} to="/compras" state={{ openWhimmId: w.id }} className="row-list-item">
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--wine4)', width: 16 }}>{i + 1}</div>
                    <div className="icon-tile" style={{ width: 36, height: 36 }}>
                      <IconProduct size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                        {ESTADO_LABEL[w.estado] || 'En espera'}
                        {diasAcumulando != null ? ` · ${diasAcumulando} día${diasAcumulando === 1 ? '' : 's'} acumulando` : ''}
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(w.precio)}</div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">Sin Whimms todavía</div>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Actividad</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Historial reciente</div>
            <Link to="/perfil/historial" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
              Ver todo ›
            </Link>
          </div>
          {historial.length > 0 ? (
            <div className="row-list">
              {historial.map((h) => (
                <div key={h.id} className="row-list-item">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: h.dotColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{h.title}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: h.amount == null ? 'var(--muted)' : h.amount > 0 ? 'var(--green)' : 'var(--text)' }}>
                    {h.amount == null ? '—' : fmtSigned(h.amount)}
                  </span>
                  {h.editable && (
                    <button aria-label="Editar" onClick={() => handleHistorialEditClick(h)} style={{ flexShrink: 0, padding: 2 }}>
                      <IconEdit size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Sin movimientos recientes</div>
          )}
        </div>
      </div>

      {!loadingConfig && <Onboarding config={configPresupuesto} />}
      <Toast message={message} />
      <AddSheet onToast={show} cats={cats} pagosFijos={pagosFijos} />
    </div>
  )
}
