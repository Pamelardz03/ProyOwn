import { useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import Toast from '../../../components/Toast'
import { useToast } from '../../../hooks/useToast'
import { app } from '../../../lib/firebase'
import { useUserDoc } from '../../../lib/firestoreCollections'
import EncabezadoSub from '../../components/EncabezadoSub'

const pedirCodigo = (renovar) => httpsCallable(getFunctions(app, 'us-central1'), 'crearTokenWidget')({ renovar }).then((r) => r.data.token)

// Código personal para el widget de la app Android. El widget no inicia sesión: pide sus
// números con este código, que solo muestra tu resumen del día.
export default function Widget() {
  const { data } = useUserDoc('config', 'widget')
  const { message, show } = useToast()
  const [trabajando, setTrabajando] = useState(false)
  const [confirmarRenovar, setConfirmarRenovar] = useState(false)
  const token = data?.token

  const generar = async (renovar) => {
    setTrabajando(true)
    try {
      await pedirCodigo(renovar)
      setConfirmarRenovar(false)
      show(renovar ? 'Código renovado' : 'Código listo')
    } catch {
      show('No se pudo generar el código')
    } finally {
      setTrabajando(false)
    }
  }
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(token)
      show('Código copiado')
    } catch {
      show('No se pudo copiar. Mantén presionado el código')
    }
  }

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <EncabezadoSub titulo="Widget" />
          <div data-guia="widget-info" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            El widget de la app de Android muestra cuánto puedes gastar hoy y tu próxima compra. Pega este código en la app una sola vez.
          </div>

          {!token ? (
            <button data-guia="widget-codigo" className="btn-primary" disabled={trabajando} style={{ opacity: trabajando ? 0.6 : 1 }} onClick={() => generar(false)}>{trabajando ? 'Generando…' : 'Generar mi código'}</button>
          ) : (
            <>
              <div data-guia="widget-codigo" className="card" style={{ padding: 14 }}>
                <div className="eyebrow">Tu código</div>
                <div className="mono" style={{ fontSize: 13, marginTop: 8, wordBreak: 'break-all', userSelect: 'text', WebkitUserSelect: 'text', lineHeight: 1.5 }}>{token}</div>
              </div>
              <button data-guia="widget-copiar" className="btn-primary" onClick={copiar}>Copiar código</button>
              {!confirmarRenovar ? (
                <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={() => setConfirmarRenovar(true)}>Renovar código</button>
              ) : (
                <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.45 }}>El código actual dejará de funcionar y tendrás que pegar el nuevo en la app.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={() => setConfirmarRenovar(false)}>Cancelar</button>
                    <button className="segbtn" disabled={trabajando} style={{ background: 'var(--red)', color: '#fff' }} onClick={() => generar(true)}>Sí, renovar</button>
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>No lo compartas: quien tenga el código puede ver ese resumen.</div>
            </>
          )}
        </div>
      </div>
      <Toast message={message} />
    </>
  )
}
