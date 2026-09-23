import { useState } from 'react'
import { Link } from 'react-router-dom'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { IconWarning, IconClock, IconCard, IconSalary, IconBars, IconChevronRight } from '../components/Icons'
import { fmt, fmtSigned } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, useUserDoc, setUserDoc } from '../lib/firestoreCollections'
import { daysUntil, formatShortDate, isThisMonth, todayISO } from '../lib/date'
import { proximaFechaSueldo, fechasPagoVivas, detectarRiesgosPagosFijos, saldoLibreAcumuladoReal, disponibleParaWhimms, reservaInmediataPagosFijos, bufferGastoHormiga, diasHastaProximoIngreso, presupuestoDiarioTotal, promedioGastoHormigaDiario } from '../lib/budget'
import { deriveWhimmCats } from '../lib/categorias'

const LINKS = [
  { to: '/perfil/historial', Icon: IconClock, title: 'Historial completo', hint: 'Todo el desglose, filtrable' },
  { to: '/perfil/precios-fijos', Icon: IconCard, title: 'Precios fijos', hint: 'Todos tus pagos recurrentes' },
  { to: '/perfil/sueldos', Icon: IconSalary, title: 'Sueldos', hint: 'Sueldos fijos y sueldos rápidos' },
  { to: '/perfil/metricas', Icon: IconBars, title: 'Métricas', hint: 'Promedios, cantidades y gastos' },
]

export default function Perfil() {
  const { message, show } = useToast()
  const { user, logout } = useAuth()

  const { data: sueldosFijos } = useUserCollection('sueldosFijos')
  const { data: sueldosRapidos } = useUserCollection('sueldosRapidos')
  const { data: pagosFijos } = useUserCollection('pagosFijos')
  const { data: whimms } = useUserCollection('whimms')
  const { data: gastos } = useUserCollection('gastos')
  const { data: configPresupuesto } = useUserDoc('config', 'presupuesto')

  const cats = deriveWhimmCats(whimms, gastos)

  // Saldo inicial (20 sep, onceava tanda): lo que Pame ya tenía en el
  // banco antes de empezar a registrar nada en la app — se captura una
  // sola vez aquí y se suma dentro de saldoLibreAcumuladoReal (ver
  // src/lib/budget.js) para que la cifra pueda cuadrar exacto contra el
  // banco desde el día uno, no solo desde que empezó el registro.
  const saldoInicial = Number(configPresupuesto?.saldoInicial) || 0
  const [editingSaldoInicial, setEditingSaldoInicial] = useState(false)
  const [saldoInicialValue, setSaldoInicialValue] = useState('')
  function openEditSaldoInicial() {
    setSaldoInicialValue(saldoInicial ? String(saldoInicial) : '')
    setEditingSaldoInicial(true)
  }
  async function saveSaldoInicial() {
    await setUserDoc(user.uid, 'config', 'presupuesto', { saldoInicial: Number(saldoInicialValue) || 0 })
    setEditingSaldoInicial(false)
  }

  const displayName = user?.displayName || 'Pame'
  const initial = displayName.charAt(0).toUpperCase()

  // Próximo pago real de cada sueldo fijo, calculado en vivo — los
  // sueldos fijos no tienen fecha de fin, así que se extiende la serie
  // hacia adelante en vez de depender solo de lo que ya se generó. Nunca
  // debe mostrar "en 0 días": si la fecha más próxima es justo hoy (ya es
  // el día de pago), se muestra la siguiente ocurrencia en su lugar —
  // mismo criterio que el "Próximo pago" de Inicio.jsx.
  const hoy = todayISO()
  const proximaFechaSueldoNoHoy = (s) => {
    const fecha = proximaFechaSueldo(s, hoy)
    return fecha === hoy ? (fechasPagoVivas(s).find((f) => f > hoy) || null) : fecha
  }
  const proximosSueldos = sueldosFijos
    .map((s) => {
      const proxima = proximaFechaSueldoNoHoy(s)
      return proxima ? { id: s.id, name: s.name, fecha: proxima, monto: s.monto } : null
    })
    .filter(Boolean)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .slice(0, 4)

  const sueldosRapidosMes = sueldosRapidos.filter((r) => isThisMonth(r.fecha)).reduce((s, r) => s + (Number(r.monto) || 0), 0)

  // Riesgo real de flujo (novena tanda): compara el presupuesto diario
  // bruto contra lo que hay que reservar CADA día para llegar completo a
  // cada vencimiento — no un aviso genérico, sino cuánto exactamente
  // faltaría por día si nada cambia. Reemplaza el aviso genérico de "ya no
  // deja presupuesto diario libre" por uno con el pago, la fecha y el
  // monto exactos.
  const riesgosFlujo = detectarRiesgosPagosFijos({ sueldosFijos, sueldosRapidosMes, pagosFijos })

  // Saldo libre acumulado real y cuánto de eso está de verdad disponible
  // para financiar Whimms sin tocar lo reservado para pagos fijos próximos
  // — mismo cálculo que usa Compras.jsx para las barras de progreso.
  // Reparto Whimms/colchón de gasto hormiga (doceava tanda, a pedido de
  // Pame) — mismo criterio que Compras/Calendario, default 50/50.
  const porcentajeWhimms = configPresupuesto?.porcentajeWhimms != null ? configPresupuesto.porcentajeWhimms : 0.5
  const saldoAcumuladoReal = saldoLibreAcumuladoReal({ sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial })
  const disponibleWhimms = disponibleParaWhimms({ sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms })
  const colchonGastoHormiga = bufferGastoHormiga({ sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms })
  const diasProximoIngreso = diasHastaProximoIngreso(sueldosFijos)
  // Presupuesto diario TOTAL (23 sep) — ver nota completa en Compras.jsx /
  // src/lib/budget.js: whimms + gasto libre juntos, calculado ANTES de
  // aplicar el % de reparto, así que editar el % en Compras nunca cambia
  // este total, solo cómo se reparte. Sigue usando la duración fija del
  // periodo de pago (22 sep) como divisor.
  const presupuestoTotal = presupuestoDiarioTotal({ sueldosFijos, sueldosRapidos, gastos, pagosFijos, whimms, saldoInicial, porcentajeWhimms })
  const colchonPorDia = presupuestoTotal != null ? presupuestoTotal * (1 - porcentajeWhimms) : null
  const gastoHormigaPromedioDiario = promedioGastoHormigaDiario(gastos)
  const colchonBajo = colchonPorDia != null && colchonPorDia < gastoHormigaPromedioDiario
  // Reserva completa para pagos fijos/Vitall (20 sep, onceava tanda, a
  // pedido de Pame): tercer recuadro para poder confirmar de un vistazo
  // que sí está considerando el próximo vencimiento de TODOS sus pagos
  // fijos/Vitall activos (no solo Vitall) — mismo cálculo que ya resta
  // "Disponible para Whimms" de "Ahorro acumulado real".
  const reservaPagosFijos = reservaInmediataPagosFijos(pagosFijos)

  // Antes también había un aviso genérico de "pago fijo vence en los
  // próximos 8 días" — se quitó (treceava tanda, a pedido de Pame): un
  // vencimiento próximo NO es un riesgo por sí solo, ya que su monto
  // completo ya está reservado (ver "Para pagos fijos/Vitall" arriba); el
  // texto además siempre decía "8 días" sin importar cuántos días faltaban
  // de verdad. `riesgosFlujo` (abajo) es el único riesgo real: cuando el
  // ritmo de ahorro actual no alcanza para juntar a tiempo lo reservado.
  const riesgos = []
  riesgosFlujo.forEach((r) => {
    riesgos.push(`${r.nombre}: necesitas juntar ${fmt(Math.round(r.reservaDiaria))}/día en los próximos ${r.dias} día${r.dias === 1 ? '' : 's'} para los ${fmt(r.monto)} de ${formatShortDate(r.vencimiento)} — a tu ritmo actual te faltarían ~${fmt(r.faltante)}.`)
  })

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <h1>Perfil</h1>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, padding: 14, minWidth: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Ahorro acumulado real</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{fmt(saldoAcumuladoReal)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 14, minWidth: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Disponible para Whimms</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: 'var(--wine4)' }}>{fmt(disponibleWhimms)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 14, minWidth: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Para pagos fijos/Vitall</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: 'var(--wine3)' }}>{fmt(reservaPagosFijos)}</div>
            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>Solo tu próximo cobro de cada uno</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 14, minWidth: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Disponible para gastos</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 4, color: colchonBajo ? 'var(--red)' : 'var(--green)' }}>{fmt(colchonGastoHormiga)}</div>
            {colchonPorDia != null && (
              <div style={{ fontSize: 9, color: colchonBajo ? 'var(--red)' : 'var(--muted)', marginTop: 2 }}>
                {fmt(colchonPorDia)}/día fijo (de {fmt(presupuestoTotal)} totales){diasProximoIngreso ? ` · próximo pago en ${diasProximoIngreso}d` : ''}
              </div>
            )}
          </div>
        </div>

        {editingSaldoInicial ? (
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Lo que ya tenías antes de usar la app
            </div>
            <input
              className="fld"
              placeholder="Saldo inicial"
              inputMode="decimal"
              value={saldoInicialValue}
              onChange={(e) => setSaldoInicialValue(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={saveSaldoInicial}>Guardar</button>
              <button className="pill" style={{ flex: 1, textAlign: 'center' }} onClick={() => setEditingSaldoInicial(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div
            onClick={openEditSaldoInicial}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', padding: '0 2px' }}
          >
            <span>Saldo inicial (antes de registrar aquí): {fmt(saldoInicial)}</span>
            <span style={{ fontWeight: 600, color: 'var(--wine4)' }}>Editar</span>
          </div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Próximos sueldos</div>
            <Link to="/perfil/sueldos" style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Ver todos</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proximosSueldos.map((s) => {
              const dias = daysUntil(s.fecha)
              return (
                <div key={s.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {formatShortDate(s.fecha)}{dias != null ? ` · en ${dias} día${dias === 1 ? '' : 's'}` : ''}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>{fmtSigned(s.monto)}</div>
                </div>
              )
            })}
            {proximosSueldos.length === 0 && <div className="empty-state">Sin sueldos fijos todavía</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600 }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{displayName}</div>
            {user?.email && <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{user.email}</div>}
          </div>
          <button onClick={() => logout()} style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Cerrar sesión</button>
        </div>

        {riesgos.length > 0 && (
          <div style={{ background: 'var(--red-bg)', borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <IconWarning />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Riesgos detectados</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {riesgos.map((r) => (
                <div key={r} style={{ fontSize: 12, color: 'var(--text)' }}>{r}</div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Más métricas</div>
          <div className="row-list">
            {LINKS.map(({ to, Icon, title, hint }) => (
              <Link key={to} to={to} className="row-list-item">
                <div className="icon-tile" style={{ width: 36, height: 36 }}>
                  <Icon size={17} color="var(--wine)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{hint}</div>
                </div>
                <IconChevronRight />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Toast message={message} />
      <AddSheet onToast={show} cats={cats} pagosFijos={pagosFijos} />
    </div>
  )
}
