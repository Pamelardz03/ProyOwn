import { useState } from 'react'
import Toast from '../../../components/Toast'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/AuthContext'
import EncabezadoSub from '../../components/EncabezadoSub'
import Modal from '../../components/Modal'
import { eliminarMiCuenta, exportarMisDatos } from '../../lib/cuenta'

const fila = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', width: '100%', textAlign: 'left' }

// Privacidad y datos: qué guarda la app, descargar tus datos, políticas y eliminar la cuenta.
export default function Privacidad() {
  const { user } = useAuth()
  const { message, show } = useToast()
  const [exportando, setExportando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [texto, setTexto] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const exportar = async () => {
    setExportando(true)
    try {
      const n = await exportarMisDatos(user.uid)
      show(`Descargado: ${n.gastos} gastos, ${n.whimms} Whimms`)
    } catch {
      show('No se pudo descargar tus datos')
    } finally {
      setExportando(false)
    }
  }

  const eliminar = async () => {
    setTrabajando(true)
    try {
      await eliminarMiCuenta()
      // al borrarse el usuario la app vuelve sola a la pantalla de inicio de sesión
    } catch (e) {
      setTrabajando(false)
      show(e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request' ? 'No se confirmó tu cuenta de Google. No se borró nada.' : 'No se pudo eliminar. Intenta de nuevo.')
    }
  }

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <EncabezadoSub titulo="Privacidad y datos" />

          <div data-guia="priv-guarda" className="card" style={{ padding: 14, fontSize: 12, lineHeight: 1.55 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Qué guarda Whital</div>
            Tu nombre y correo de Google, lo que registras (gastos, sueldos, pagos fijos y Whimms, con sus fotos) y tu configuración. Está en tu cuenta de Firebase (Google Cloud), y solo tu sesión puede leerlo. No se vende ni se comparte, y no hay anuncios.
          </div>

          <div data-guia="priv-descargar" className="row-list">
            <button className="row-list-item" style={fila} onClick={exportar} disabled={exportando}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{exportando ? 'Preparando…' : 'Descargar mis datos'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Un archivo con todo lo que registraste</div>
              </div>
            </button>
          </div>

          <div className="card" style={{ padding: 14, fontSize: 12, lineHeight: 1.55 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Respaldos</div>
            Cada domingo de madrugada se guarda una copia de tus datos (se conservan las últimas 8). Se borran junto con tu cuenta.
          </div>

          <div data-guia="priv-peligro" style={{ marginTop: 6 }}>
            <div className="eyebrow" style={{ margin: '0 2px 8px', color: 'var(--red)' }}>Zona de peligro</div>
            <button className="segbtn" style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: 14, width: '100%' }} onClick={() => { setConfirmar(true); setTexto('') }}>
              Eliminar mi cuenta y mis datos
            </button>
          </div>
        </div>
      </div>

      {confirmar && (
        <Modal abierto onClose={() => !trabajando && setConfirmar(false)} nivel={2}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--red)' }}>Eliminar mi cuenta</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 12 }}>
            Se borra para siempre todo lo tuyo: gastos, sueldos, pagos fijos, Whimms, fotos, respaldos, el código del widget y tu usuario. No se puede deshacer. Antes de empezar, te pedirá confirmar tu cuenta de Google. Si quieres conservar algo, primero usa "Descargar mis datos".
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
            <span className="eyebrow">Escribe ELIMINAR para continuar</span>
            <input className="fld" value={texto} onChange={(e) => setTexto(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} disabled={trabajando} onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className="segbtn" style={{ background: 'var(--red)', color: '#fff', opacity: texto === 'ELIMINAR' && !trabajando ? 1 : 0.4 }} disabled={texto !== 'ELIMINAR' || trabajando} onClick={eliminar}>
              {trabajando ? 'Eliminando…' : 'Eliminar todo'}
            </button>
          </div>
        </Modal>
      )}
      <Toast message={message} />
    </>
  )
}
