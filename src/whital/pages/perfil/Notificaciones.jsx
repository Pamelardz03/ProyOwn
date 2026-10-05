import { useState } from 'react'
import Toast from '../../../components/Toast'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/AuthContext'
import { setUserDoc } from '../../../lib/firestoreCollections'
import { Aviso } from '../../components/Campo'
import EncabezadoSub from '../../components/EncabezadoSub'
import { useWhitalDatos } from '../../hooks/useWhitalDatos'
import { FRECUENCIAS, GRUPOS, TIPOS, cadenciaEfectiva } from '../../lib/notificaciones'

// Qué avisar y cada cuánto. La frecuencia de aquí es la GENERAL de cada tipo; un
// Whimm, Vitall o sueldo puede tener la suya en su ficha y esa manda sobre esta.
export default function Notificaciones() {
  const { user } = useAuth()
  const { datos, loading, error } = useWhitalDatos()
  const { message, show } = useToast()
  const [permiso, setPermiso] = useState(typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission)

  const general = { ...(datos.config?.recordatorioCadaMin != null ? { registro: datos.config.recordatorioCadaMin } : {}), ...(datos.config?.notificaciones || {}) }

  const cambiar = async (clave, min) => {
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { notificaciones: { [clave]: min } })
      show('Guardado')
    } catch {
      show('No se pudo guardar')
    }
  }
  const pedirPermiso = async () => {
    if (typeof Notification === 'undefined') return
    setPermiso(await Notification.requestPermission())
  }

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <EncabezadoSub titulo="Notificaciones" />
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          {loading && !error && <div className="empty-state">Cargando…</div>}
          {!loading && (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>
                Frecuencia general de cada aviso. Cada Whimm, Vitall o sueldo puede tener la suya en su ficha (Recordarme) y esa manda.
              </div>

              {permiso === 'default' && <button className="btn-primary" onClick={pedirPermiso}>Permitir notificaciones del sistema</button>}
              {permiso === 'granted' && <Aviso tono="green">Notificaciones del sistema activadas.</Aviso>}
              {permiso === 'denied' && <Aviso tono="amber">Notificaciones bloqueadas en el navegador.</Aviso>}
              {permiso === 'no-soportado' && <Aviso tono="amber">Este navegador no admite notificaciones.</Aviso>}

              {GRUPOS.map((grupo) => (
                <div key={grupo}>
                  <div className="eyebrow" style={{ margin: '0 2px 8px' }}>{grupo}</div>
                  <div className="row-list">
                    {TIPOS.filter((t) => t.grupo === grupo).map((t) => (
                      <div key={t.clave} className="row-list-item" style={{ gap: 12 }}>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{t.titulo}</div>
                        <select className="fld" style={{ width: 138, flexShrink: 0, padding: '9px 10px' }} aria-label={t.titulo} value={cadenciaEfectiva({ tipo: t.clave, general })} onChange={(e) => cambiar(t.clave, Number(e.target.value))}>
                          {FRECUENCIAS.map((f) => <option key={f.min} value={f.min}>{f.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Con la app cerrada del todo no avisa (falta push).</div>
            </>
          )}
        </div>
      </div>
      <Toast message={message} />
    </>
  )
}
