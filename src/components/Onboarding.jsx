import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { setUserDoc } from '../lib/firestoreCollections'

// Bienvenida de primera vez (treceava tanda, a pedido de Pame — pensando
// en que ahora comparte la app con amigos que no conocen la terminología
// propia del proyecto): un carrusel corto de cards que explica lo esencial
// una sola vez. Se marca visto en config/presupuesto (`onboardingVisto`),
// mismo documento que whimmsSimultaneos/porcentajeWhimms — así no vuelve a
// aparecer en otro dispositivo con la misma cuenta.
const CARDS = [
  { title: 'Tu sueldo, tu presupuesto', body: 'Registra tus sueldos (fijos o rápidos) y la app calcula cuánto puedes gastar por día sin quedarte en números rojos.' },
  { title: 'Gasto: Whimm o Vitall', body: 'Whimm es una compra del día a día (tu gasto hormiga). Vitall es una suscripción que se cobra sola — no hace falta registrarla como Gasto.' },
  { title: 'Whimms: tu lista de espera', body: 'Lo que quieres comprar, en orden de prioridad. Tu dinero libre se va acumulando solo hacia los primeros de la fila.' },
  { title: 'Reparto: wishlist vs. gastos', body: 'Ese dinero libre se divide entre tu wishlist y un colchón para gasto espontáneo — ajustable desde Compras.' },
  { title: 'Todo en un lugar', body: 'Calendario para fechas, Perfil para tu ahorro real y riesgos detectados.' },
]

export default function Onboarding({ config }) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [dismissedLocal, setDismissedLocal] = useState(false)

  if (dismissedLocal || config?.onboardingVisto) return null

  const isLast = step === CARDS.length - 1
  const card = CARDS[step]

  async function finish() {
    setDismissedLocal(true)
    try {
      if (user) await setUserDoc(user.uid, 'config', 'presupuesto', { onboardingVisto: true })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <>
      <div className="sheet-backdrop" style={{ zIndex: 60 }} />
      <div className="card-solid" style={{ position: 'absolute', left: 16, right: 16, top: '16%', borderRadius: 20, boxShadow: '0 12px 32px rgba(0,0,0,.28)', zIndex: 61, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--wine4)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {step + 1} de {CARDS.length}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{card.title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{card.body}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CARDS.map((_, i) => (
            <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--wine)' : 'var(--beige2)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {step > 0 && (
            <button className="pill" style={{ flex: 1, textAlign: 'center' }} onClick={() => setStep((s) => s - 1)}>Atrás</button>
          )}
          <button className="btn-primary" style={{ flex: 2 }} onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
            {isLast ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
        {!isLast && (
          <button onClick={finish} style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>
            Saltar
          </button>
        )}
      </div>
    </>
  )
}
