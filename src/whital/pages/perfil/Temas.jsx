import Toast from '../../../components/Toast'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/AuthContext'
import { setUserDoc } from '../../../lib/firestoreCollections'
import EncabezadoSub from '../../components/EncabezadoSub'
import { guardarTemaLocal, useTema } from '../../hooks/useTema'
import { FONDOS, PALETAS } from '../../lib/temas'

const opcion = (activa) => ({
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 14,
  background: 'var(--card)', border: `2px solid ${activa ? 'var(--acento)' : 'transparent'}`,
})

// Paleta de acento y color de fondo. Se aplica al instante y se guarda en tu cuenta.
export default function Temas() {
  const { user } = useAuth()
  const tema = useTema()
  const { message, show } = useToast()

  const elegir = async (cambio) => {
    const nuevo = { ...tema, ...cambio }
    guardarTemaLocal(nuevo)
    try {
      await setUserDoc(user.uid, 'config', 'presupuesto', { tema: nuevo })
    } catch {
      show('No se pudo guardar el tema')
    }
  }

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <EncabezadoSub titulo="Temas" />

          <div data-guia="paleta">
            <div className="eyebrow" style={{ margin: '0 2px 8px' }}>Paleta</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PALETAS.map((p) => (
                <button key={p.id} style={opcion(tema.paleta === p.id)} onClick={() => elegir({ paleta: p.id })} aria-pressed={tema.paleta === p.id}>
                  <div style={{ display: 'flex' }}>
                    {p.muestra.map((c, i) => <span key={c} style={{ width: 24, height: 24, borderRadius: 12, background: c, marginLeft: i ? -8 : 0, border: '2px solid var(--card-solid)' }} />)}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
                  {tema.paleta === p.id && <span style={{ fontSize: 11, color: 'var(--acento)', fontWeight: 700 }}>Activa</span>}
                </button>
              ))}
            </div>
          </div>

          <div data-guia="fondo">
            <div className="eyebrow" style={{ margin: '0 2px 8px' }}>Fondo</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {FONDOS.map((f) => (
                <button key={f.id} style={{ ...opcion(tema.fondo === f.id), flexDirection: 'column', gap: 8, flex: 1, padding: 10, alignItems: 'center' }} onClick={() => elegir({ fondo: f.id })} aria-pressed={tema.fondo === f.id}>
                  <div style={{ width: '100%', height: 54, borderRadius: 10, background: f.fondo, border: '1px solid rgba(128,128,128,.35)', padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ height: 8, width: '70%', borderRadius: 4, background: f.tarjeta, border: '1px solid rgba(128,128,128,.25)' }} />
                    <span style={{ height: 8, width: '45%', borderRadius: 4, background: f.texto, opacity: 0.55 }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{f.nombre}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Toast message={message} />
    </>
  )
}
