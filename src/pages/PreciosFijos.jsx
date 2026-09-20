import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft, IconCard, IconTrash } from '../components/Icons'
import Toggle from '../components/Toggle'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { fmt } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useUserCollection, updateUserDoc, deleteUserDoc } from '../lib/firestoreCollections'
import { formatShortDate, daysUntil, todayISO } from '../lib/date'
import { proximoVencimientoPagoFijo } from '../lib/budget'

const TIPOS = ['Vitall', 'Vivienda', 'Transporte', 'Deuda']

const TIPO_COLORS = {
  Vitall: { color: '#7c8c5a', bg: '#dde3c8' },
  Vivienda: { color: 'var(--wine)', bg: 'var(--beige2)' },
  Transporte: { color: 'var(--amber)', bg: '#ecdfc7' },
  Deuda: { color: 'var(--red)', bg: 'var(--red-bg)' },
}

function monthlyEq(p) {
  const monto = Number(p.monto) || 0
  return p.frecuencia === 'Semanal' ? Math.round(monto * 4.33) : monto
}

export default function PreciosFijos() {
  const { user } = useAuth()
  const { data: items, loading, error } = useUserCollection('pagosFijos')
  const [tipo, setTipo] = useState('todos')
  const { message, show } = useToast()

  const confirmDelete = useRef(null)
  const [armedId, setArmedId] = useState(null)

  const totalMonthly = items.reduce((sum, p) => sum + monthlyEq(p), 0)
  const filtered = items.filter((p) => tipo === 'todos' || (p.tipo || '').toLowerCase() === tipo)

  async function setFecha(id, fecha) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', id, { fecha })
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  async function toggleActivo(id, activo) {
    try {
      await updateUserDoc(user.uid, 'pagosFijos', id, { activo: !activo })
    } catch (err) {
      console.error(err)
      show(`No se pudo actualizar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
    }
  }

  function askDelete(id) {
    if (armedId === id) {
      clearTimeout(confirmDelete.current)
      setArmedId(null)
      deleteUserDoc(user.uid, 'pagosFijos', id)
        .then(() => show('Pago fijo eliminado'))
        .catch((err) => {
          console.error(err)
          show(`No se pudo eliminar: ${err?.code ? `(${err.code}) ` : ''}${err?.message || ''}`)
        })
      return
    }
    clearTimeout(confirmDelete.current)
    setArmedId(id)
    confirmDelete.current = setTimeout(() => setArmedId(null), 3000)
  }

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/perfil" aria-label="Volver" className="back-btn">
            <IconChevronLeft />
          </Link>
          <div style={{ fontSize: 19, fontWeight: 600, flex: 1 }}>Precios fijos</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Total fijo mensual</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{fmt(totalMonthly)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Pagos activos</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{items.filter((p) => p.activo).length}</div>
          </div>
        </div>

        <div className="chiprow">
          <span onClick={() => setTipo('todos')} className="pill" style={{ background: tipo === 'todos' ? 'var(--wine)' : 'transparent', color: tipo === 'todos' ? '#fff' : 'var(--muted)' }}>Todos</span>
          {TIPOS.map((t) => (
            <span
              key={t}
              onClick={() => setTipo(t.toLowerCase())}
              className="pill"
              style={{ background: tipo === t.toLowerCase() ? 'var(--wine)' : 'transparent', color: tipo === t.toLowerCase() ? '#fff' : 'var(--muted)' }}
            >
              {t}
            </span>
          ))}
        </div>

        {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((p) => {
            const colors = TIPO_COLORS[p.tipo] || TIPO_COLORS.Vitall
            const armed = armedId === p.id
            const proximo = proximoVencimientoPagoFijo(p)
            const dias = daysUntil(proximo)
            return (
              <div key={p.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="icon-tile" style={{ width: 38, height: 38 }}>
                    <IconCard size={17} color="var(--wine4)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: colors.color, background: colors.bg, padding: '2px 7px', borderRadius: 6 }}>{p.tipo}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                      {p.frecuencia} · Próximo {proximo ? formatShortDate(proximo) : 'sin fecha'}{dias != null ? ` · en ${dias} día${dias === 1 ? '' : 's'}` : ''}
                      {p.finito && p.numPagos ? ` · ${p.numPagos} pagos` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(p.monto)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button aria-label={armed ? 'Confirmar eliminación' : 'Eliminar'} onClick={() => askDelete(p.id)} style={{ padding: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {armed && <span style={{ fontSize: 9, color: 'var(--red)', fontWeight: 600 }}>¿Seguro?</span>}
                        <IconTrash size={13} color={armed ? 'var(--red)' : 'var(--muted)'} />
                      </button>
                      <Toggle on={p.activo} onClick={() => toggleActivo(p.id, p.activo)} ariaLabel={`Activar ${p.name}`} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>Vencimiento:</span>
                  <input
                    className="fld"
                    style={{ flex: 1, padding: '7px 10px' }}
                    type="date"
                    value={p.fecha || todayISO()}
                    onChange={(e) => setFecha(p.id, e.target.value)}
                  />
                </div>
              </div>
            )
          })}
          {!loading && !error && filtered.length === 0 && <div className="empty-state">Sin pagos fijos de este tipo</div>}
        </div>
      </div>

      <Toast message={message} />
    </div>
  )
}
