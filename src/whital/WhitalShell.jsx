import { useAuth } from '../lib/AuthContext'

// Placeholder temporal del App Shell de Whital -- la navegación/páginas
// reales (Inicio, Gastos, Whimms, Vitalls, Calendar) llegan en el siguiente
// paso (tarea de restructurar páginas). Esto solo confirma que el gate por
// cuenta (src/whital/config.js) funciona: SOLO la cuenta UDEM ve esto, la
// cuenta personal real sigue viendo la app de hoy sin ningún cambio.
export default function WhitalShell() {
  const { user, logout } = useAuth()
  return (
    <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
      <div className="eyebrow">Whital</div>
      <h1 style={{ margin: 0 }}>En construcción</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
        Conectada como {user?.email || 'cuenta de prueba'}. El motor nuevo ya está listo;
        las páginas van llegando.
      </p>
      <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={logout}>Cerrar sesión</button>
    </div>
  )
}
