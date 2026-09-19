import { useState } from 'react'
import AddSheet from '../components/AddSheet'
import Toast from '../components/Toast'
import Toggle from '../components/Toggle'
import { useToast } from '../hooks/useToast'
import { IconProduct, IconBell, IconClose, IconEdit, IconTrash } from '../components/Icons'
import { fmt } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, deleteUserDoc, updateUserDoc } from '../lib/firestoreCollections'
import { formatShortDate, daysUntil } from '../lib/date'

const ESTADO_LABEL = {
  espera: 'En espera',
  espera_sin_fondos: 'En espera · sin fondos asignados',
  apartando: 'Apartando fondos',
}

export default function Compras() {
  const { user } = useAuth()
  const { message, show } = useToast()
  const [tab, setTab] = useState('deseos')
  const [detailId, setDetailId] = useState(null)
  const [notifFor, setNotifFor] = useState(null)
  const [dismissed, setDismissed] = useState({})

  const { data: whimms, loading: loadingWhimms, error: errorWhimms } = useUserCollection('whimms')
  const { data: pagosFijos, loading: loadingPagos, error: errorPagos } = useUserCollection('pagosFijos')
  const servicios = pagosFijos.filter((p) => p.tipo === 'Vitall')

  const cats = [...new Set(whimms.map((w) => w.categoria).filter(Boolean))]
  const detail = whimms.find((w) => w.id === detailId)

  async function toggleServicio(id, activo) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', id, { activo: !activo })
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  async function deleteDetail() {
    try {
      await deleteUserDoc(user.uid, 'whimms', detailId)
      setDetailId(null)
      show('Whimm eliminado')
    } catch (err) {
      console.error(err)
      show(`No se pudo eliminar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
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
            {errorWhimms && <div style={{ fontSize: 11, color: 'var(--red)' }}>{errorWhimms}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {whimms.map((w, i) => (
                <div key={w.id} onClick={() => setDetailId(w.id)} className="card" style={{ padding: 16, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div className="icon-tile" style={{ width: 76, height: 76, borderRadius: 16 }}>
                        <IconProduct size={30} />
                      </div>
                      <div>
                        <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--wine4)' }}>#{i + 1}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{w.categoria}{w.lugar ? ` · ${w.lugar}` : ''}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{fmt(w.precio)}</div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--beige2)', padding: '5px 10px', borderRadius: 8 }}>
                      {ESTADO_LABEL[w.estado] || 'En espera'}
                    </span>
                  </div>
                </div>
              ))}
              {!loadingWhimms && !errorWhimms && whimms.length === 0 && <div className="empty-state">Sin Whimms todavía</div>}
            </div>
          </div>
        )}

        {tab === 'servicios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {errorPagos && <div style={{ fontSize: 11, color: 'var(--red)' }}>{errorPagos}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="card" style={{ flex: 1, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Total mensual pendiente</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{fmt(servicios.reduce((s, x) => s + (Number(x.monto) || 0), 0))}</div>
              </div>
              <div className="card" style={{ flex: 1, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Vitall activos</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{servicios.filter((s) => s.activo).length}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {servicios.map((s) => {
                const dias = daysUntil(s.fecha)
                return (
                  <div key={s.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, opacity: s.activo ? 1 : 0.65 }}>
                    <div className="icon-tile" style={{ width: 38, height: 38 }}><IconProduct size={17} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {s.frecuencia} · Próximo {formatShortDate(s.fecha)}{dias != null ? ` · ${dias} día${dias === 1 ? '' : 's'}` : ''}
                      </div>
                    </div>
                    <button aria-label="Notificaciones" onClick={() => setNotifFor(s.name)} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconBell />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(s.monto)}</div>
                      <Toggle on={s.activo} onClick={() => toggleServicio(s.id, s.activo)} ariaLabel={`Activar ${s.name}`} />
                    </div>
                  </div>
                )
              })}
              {!loadingPagos && !errorPagos && servicios.length === 0 && <div className="empty-state">Sin Vitall todavía</div>}
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
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--wine4)' }}>#{whimms.findIndex((w) => w.id === detail.id) + 1}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{detail.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{detail.categoria}{detail.lugar ? ` · ${detail.lugar}` : ''}</div>
                  </div>
                </div>
                <button aria-label="Cerrar" onClick={() => setDetailId(null)} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconClose />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 500, flex: 1 }}>{fmt(detail.precio)}</div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Categoría</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{detail.categoria}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--beige2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Estado</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{ESTADO_LABEL[detail.estado] || 'En espera'}</div>
                </div>
              </div>

              {detail.link && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Dónde lo encontré</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {!dismissed[detail.id] && (
                      <div style={{ background: 'var(--beige2)', borderRadius: 12, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{detail.lugar || 'Link guardado'}</div>
                        </div>
                        <a href={detail.link} target="_blank" rel="noreferrer" style={{ background: 'var(--wine)', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>Ver</a>
                        <button
                          aria-label="Quitar esta fuente"
                          onClick={() => setDismissed((prev) => ({ ...prev, [detail.id]: true }))}
                          style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                          <IconClose size={12} color="var(--muted)" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
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
      <AddSheet onToast={show} cats={cats} />
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
