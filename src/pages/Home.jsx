import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'

export default function Home() {
  const { user, loading, loginWithGoogle, logout } = useAuth()
  const [testValue, setTestValue] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'meta', 'helloWorld')
    getDoc(ref).then((snap) => {
      if (snap.exists()) setTestValue(snap.data())
    })
  }, [user])

  async function handleWriteTest() {
    if (!user) return
    setStatus('Guardando...')
    const ref = doc(db, 'users', user.uid, 'meta', 'helloWorld')
    await setDoc(ref, {
      message: 'Hola desde Organizador de Gastos',
      updatedAt: serverTimestamp(),
    })
    const snap = await getDoc(ref)
    setTestValue(snap.data())
    setStatus('Listo — se guardó y se leyó de Firestore correctamente.')
  }

  if (loading) return <p>Cargando...</p>

  if (!user) {
    return (
      <div className="card">
        <h2>Fase 0 — prueba de conexión</h2>
        <p>Inicia sesión con Google para probar que la app ya habla con Firebase.</p>
        <button onClick={loginWithGoogle}>Iniciar sesión con Google</button>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Fase 0 — prueba de conexión</h2>
      <p>
        Sesión iniciada como <strong>{user.displayName}</strong> ({user.email})
      </p>
      <button onClick={handleWriteTest}>Escribir dato de prueba en Firestore</button>
      <button onClick={logout} className="secondary">
        Cerrar sesión
      </button>
      {status && <p>{status}</p>}
      {testValue && <pre>{JSON.stringify(testValue, null, 2)}</pre>}
    </div>
  )
}
