import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore'
import { auth, db, googleProvider, firebaseReady } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(firebaseReady)

  useEffect(() => {
    if (!firebaseReady) return
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const loginWithGoogle = () => {
    if (!firebaseReady) {
      return Promise.reject(new Error('Firebase no está configurado todavía (falta .env.local, ver README)'))
    }
    return signInWithPopup(auth, googleProvider)
  }
  const logout = async () => {
    if (!firebaseReady) return
    await signOut(auth)
    // Los datos guardados en el teléfono son de esa cuenta: se borran y se recarga limpio.
    try {
      await terminate(db)
      await clearIndexedDbPersistence(db)
    } catch {
      /* sin caché que borrar */
    }
    window.location.reload()
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, firebaseReady }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
