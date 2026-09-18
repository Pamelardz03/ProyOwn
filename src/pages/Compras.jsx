import { useState } from 'react'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import Toggle from '../components/Toggle'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconTrendDown, IconTrendUp, IconBell, IconClose, IconEdit, IconTrash } from '../components/Icons'
import { fmt } from '../lib/format'

// Datos de ejemplo — la Fase 4 (wishlist) y Fase 5 (servicios/reservas) del roadmap
// los reemplazan por datos y por el motor de presupuesto reales en Firestore.
const WHIMMS = [
  {
    id: 1, name: 'Sony WH-1000XM5', meta: 'Accesorios · Amazon MX', categoria: 'Accesorios',
    score: '5.8', precio: 7499, minimo: 6999, cambio: { text: 'Bajó $300', dir: 'down' },
    estado: 'apartando', progreso: 64, desbloquea: '27 sep 2026',
    desde: '2 sep 2026', checks: 14, ahorro: 4799,
    links: [
      { store: 'Amazon MX', price: '$7,499', url: 'https://www.amazon.com.mx/s?k=Sony+WH-1000XM5' },
      { store: 'Best Buy México', price: '$7,650', url: 'https://www.bestbuy.com.mx/' },
      { store: 'Liverpool', price: '$7,899', url: 'https://www.liverpool.com.mx/' },
    ],
  },
  {
    id: 2, name: 'Suero Vitamina C', meta: 'Skin care · The Ordinary', categoria: 'Skin care',
    score: '5.3', precio: 450, minimo: 399, cambio: { text: 'Subió $51', dir: 'up' },
    estado: 'espera_sin_fondos', desde: '28 ago 2026', checks: 9, ahorro: 0,
    links: [
      { store: 'The Ordinary MX', price: '$450', url: 'https://theordinary.com/' },
      { store: 'Sephora', price: '$489', url: 'https://www.sephora.com.mx/' },
    ],
  },
  { id: 3, name: 'Crema hidratante', meta: 'Skin care', categoria: 'Skin care', score: '4.1', precio: 320, estado: 'espera', desde: '5 sep 2026', checks: 5, ahorro: 0, links: [{ store: 'Farmacias del Ahorro', price: '$320', url: 'https://www.fahorro.com/' }, { store: 'Amazon MX', price: '$339', url: 'https://www.amazon.com.mx/s?k=Crema+hidratante' }] },
  { id: 4, name: 'Funda iPad', meta: 'Accesorios', categoria: 'Accesorios', score: '3.6', precio: 550, estado: 'espera', desde: '1 sep 2026', checks: 3, ahorro: 0, links: [{ store: 'Amazon MX', price: '$550', url: 'https://www.amazon.com.mx/s?k=Funda+iPad' }] },
  { id: 5, name: 'Set de brochas', meta: 'Maquillaje', categoria: 'Maquillaje', score: '3.2', precio: 680, estado: 'espera', desde: '29 ago 2026', checks: 2, ahorro: 0, links: [{ store: 'Sephora', price: '$680', url: 'https://www.sephora.com.mx/' }, { store: 'Amazon MX', price: '$699', url: 'https://www.amazon.com.mx/s?k=Set+de+brochas' }] },
]

const SERVICIOS = [
  { id: 'gym', name: 'Gym', frecuencia: 'Mensual', fecha: '18 sep', dias: 1, monto: 650, activo: false },
  { id: 'netflix', name: 'Netflix', frecuencia: 'Mensual', fecha: '20 sep', dias: 3, monto: 219, activo: false },
  { id: 'spotify', name: 'Spotify', frecuencia: 'Mensual', fecha: '25 sep', dias: 8, monto: 99, activo: false },
  { id: 'icloud', name: 'iCloud+', frecuencia: 'Mensual', fecha: null, dias: null, monto: 29, activo: true, proxCiclo: '5 oct' },
]

const CHANGE_STYLE = {
  down: { color: 'var(--green)', bg: 'var(--green-bg)' },
  up: { color: 'var(--red)', bg: 'var(--red-bg)' },
}

export default function Compras() {
  const { message, show } = useToast()
  const [tab, setTab] = useState('deseos')
  const [items, setItems] = useState(WHIMMS)
  const [servicios, setServicios] = useState(SERVICIOS)
  const [detailId, setDetailId] = useState(null)
  const [notifFor, setNotifFor] = useState(null)
  const [dismissed, setDismissed] = useState({})

  const detail = items.find((w) => w.id === detailId)

  function toggleServicio(id) {
    setServicios((prev) => prev.map((s) => (s.id === id ? { ...s, activo: !s.activo } : s)))
  }

  function deleteDetail() {
    setItems((prev) => prev.filter((w) => w.id !== detailId))
    setDetailId(null)
    show('Whimm eliminado')
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1>Compras</h1>

        <div style={{ display: 'flex', gap: 6, background: 'var(--beige2)', padding: 4, borderRadius: 12 }}>
          <button className="segbtn" onClick={() => setTab('deseos')} style={{ background: tab === 'deseos' ? 'var(--wine)' : 'transparent', color: tab === 'deseos' ? '#fff' : 'var(--muted)' }}>Whimm</button>
          <button className="segbtn" onClick={() => setTab('servicios')} style={{ background: tab === 'servicios' ? 'var(--wine)' : 'transparent', color: tab === 'servicios' ? '#fff' : 'var(--muted)' }}>Vitall</button>
        </div>

        {tab === 'deseos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="chiprow">
              <span className="pill" style={{ background: 'var(--wine)', color: '#fff' }}>Todos</span>
              <span className="pill" style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--beige3)' }}>En espera</span>
              <span className="pill" style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--beige3)' }}>Apartando fondos</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((w, i) => (
                <div key={w.id} onClick={() => setDetailId(w.id)} className="card" style={{ padding: 16, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div className="icon-tile" style={{ width: 76, height: 76, borderRadius: 16 }}>
                        <IconProduct size={30} />
                      </div>
                      <div>
                        <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--wine4)' }}>#{i + 1}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{w.meta}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '6px 11px', flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1 }}>{w.score}</div>
                      <div style={{ fontSize: 8, letterSpacing: '.04em', textTransform: 'uppercase', marginTop: 2, opacity: 0.8 }}>score</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{fmt(w.precio)}</div>
                      {w.minimo && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Mínimo histórico: {fmt(w.minimo)}</div>}
                    </div>
                    {w.cambio && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: CHANGE_STYLE[w.cambio.dir].bg, color: CHANGE_STYLE[w.cambio.dir].color, padding: '5px 9px', borderRadius: 8 }}>
                        {w.cambio.dir === 'down' ? <IconTrendDown /> : <IconTrendUp />}
                        <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{w.cambio.text}</span>
                      </div>
                    )}
                  </div>

                  {w.estado === 'apartando' ? (
                    <>
                      <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: 'var(--beige2)', overflow: 'hidden' }}>
                        <div style={{ width: `${w.progreso}%`, height: '100%', background: 'var(--wine)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Apartando fondos · {w.progreso}%</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)' }}>{w.desbloquea}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ marginTop: 14 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--beige2)', padding: '5px 10px', borderRadius: 8 }}>
                        {w.estado === 'espera_sin_fondos' ? 'En espera · sin fondos asignados' : 'En espera'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'servicios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="card" style={{ flex: 1, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Total mensual pendiente</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{fmt(servicios.reduce((s, x) => s + x.monto, 0))}</div>
              </div>
              <div className="card" style={{ flex: 1, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Vitall activos</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{servicios.length}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {servicios.map((s) => (
                <div key={s.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, opacity: s.activo ? 0.65 : 1 }}>
                  <div className="icon-tile" style={{ width: 38, height: 38 }}><IconProduct size={17} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {s.fecha ? `${s.frecuencia} · Vence ${s.fecha} · ${s.dias} día${s.dias === 1 ? '' : 's'}` : `${s.frecuencia} · Próx. ciclo ${s.proxCiclo}`}
                    </div>
                  </div>
                  <button aria-label="Notificaciones" onClick={() => setNotifFor(s.name)} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconBell />
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(s.monto)}</div>
                    <Toggle on={s.activo} onClick={() => toggleServicio(s.id)} ariaLabel={`Activar ${s.name}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {notifFor && (
        <>
          <div className="sheet-backdrop" onClick={() => setNotifFor(null)} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body">
              <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 14px' }}>Notificaciones — {notifFor}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <NotifRow label="Recordatorio formal" hint="2 días antes del vencimiento" />
                <NotifRow label="Recordatorio mini" hint="Diario, desde que se activa hasta el día de pago" />
              </div>
              <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => { setNotifFor(null); show('Notificaciones guardadas') }}>
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      {detail && (
        <>
          <div className="sheet-backdrop" style={{ zIndex: 40 }} onClick={() => setDetailId(null)} />
          <div className="card-solid" style={{ position: 'absolute', left: 16, right: 16, top: 40, bottom: 40, borderRadius: 20, boxShadow: '0 12px 32px rgba(0,0,0,.28)', zIndex: 41, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className="icon-tile" style={{ width: 60, height: 60, borderRadius: 14 }}><IconProduct size={26} /></div>
                  <div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--wine4)' }}>#{items.findIndex((w) => w.id === detail.id) + 1}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{detail.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{detail.meta}</div>
                  </div>
                </div>
                <button aria-label="Cerrar" onClick={() => setDetailId(null)} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconClose />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 500, flex: 1 }}>{fmt(detail.precio)}</div>
                <div style={{ textAlign: 'center', background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '6px 12px' }}>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1 }}>{detail.score}</div>
                  <div style={{ fontSize: 8, letterSpacing: '.04em', textTransform: 'uppercase', marginTop: 2, opacity: 0.8 }}>score</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Categoría</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{detail.categoria}</div>
                </div>
                {detail.cambio && (
                  <div style={{ flex: 1, background: CHANGE_STYLE[detail.cambio.dir].bg, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Cambio de precio</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3, color: CHANGE_STYLE[detail.cambio.dir].color }}>{detail.cambio.text}</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Lo quiero desde</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{detail.desde}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Veces revisado</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{detail.checks}</div>
                </div>
              </div>

              {detail.ahorro > 0 && (
                <div style={{ background: 'var(--green-bg)', borderRadius: 12, padding: 12, marginBottom: 18 }}>
                  <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>Ahorrado hasta ahora</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 3, color: 'var(--green)' }}>{fmt(detail.ahorro)}</div>
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Dónde comprarlo ahora</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.links.filter((l, i) => !dismissed[detail.id + '-' + i]).map((l, i) => (
                  <div key={i} style={{ background: 'var(--beige2)', borderRadius: 12, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{l.store}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{l.price}</div>
                    </div>
                    <a href={l.url} target="_blank" rel="noreferrer" style={{ background: 'var(--wine)', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>Comprar</a>
                    <button
                      aria-label="Quitar esta fuente"
                      onClick={() => setDismissed((prev) => ({ ...prev, [detail.id + '-' + i]: true }))}
                      style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <IconClose size={12} color="var(--muted)" />
                    </button>
                  </div>
                ))}
                {detail.links.every((l, i) => dismissed[detail.id + '-' + i]) && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: 10 }}>Sin fuentes por ahora</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--beige3)' }}>
              <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--beige2)', borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600, color: 'var(--wine)' }}>
                <IconEdit color="var(--wine)" /> Editar
              </button>
              <button onClick={deleteDetail} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--red-bg)', borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600, color: 'var(--red)' }}>
                <IconTrash size={13} color="var(--red)" /> Eliminar
              </button>
            </div>
          </div>
        </>
      )}

      <Toast message={message} />
      <AddSheet onToast={show} />
    </div>
  )
}

function NotifRow({ label, hint }) {
  const [on, setOn] = useState(true)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--beige2)', borderRadius: 10, padding: '11px 12px' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>
      </div>
      <Toggle on={on} onClick={() => setOn((v) => !v)} ariaLabel={label} />
    </div>
  )
}
