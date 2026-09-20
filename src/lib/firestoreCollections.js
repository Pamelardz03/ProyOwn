import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db, firebaseReady } from './firebase'
import { useAuth } from './AuthContext'

// Lee en vivo (onSnapshot) una colección del usuario logueado:
// /users/{uid}/{name}. Sin Firebase configurado o sin sesión, regresa
// vacío en vez de tronar (modo local sigue funcionando sin datos).
export function useUserCollection(name) {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!firebaseReady || !user) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const q = query(collection(db, 'users', user.uid, name), orderBy('creadoEn', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error(`Error leyendo ${name}:`, err)
        setError(`No se pudo cargar${err?.code ? ` (${err.code})` : ''}. ${err?.message || ''}`)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user, name])

  return { data, loading, error }
}

export function addUserDoc(uid, name, data) {
  return addDoc(collection(db, 'users', uid, name), { ...data, creadoEn: serverTimestamp() })
}

export function updateUserDoc(uid, name, id, data) {
  return updateDoc(doc(db, 'users', uid, name, id), data)
}

export function deleteUserDoc(uid, name, id) {
  return deleteDoc(doc(db, 'users', uid, name, id))
}

// Lee en vivo un documento único (no una colección con lista) del usuario,
// p.ej. /users/{uid}/config/presupuesto — para configuración simple que no
// necesita ser una lista con `creadoEn`/orderBy. `data` es `null` mientras
// no exista todavía (antes de la primera vez que se guarda algo ahí).
export function useUserDoc(name, docId) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseReady || !user) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const ref = doc(db, 'users', user.uid, name, docId)
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? snap.data() : null)
        setLoading(false)
      },
      (err) => {
        console.error(`Error leyendo ${name}/${docId}:`, err)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user, name, docId])

  return { data, loading }
}

// Crea o actualiza (merge) ese mismo documento único.
export function setUserDoc(uid, name, docId, data) {
  return setDoc(doc(db, 'users', uid, name, docId), data, { merge: true })
}
