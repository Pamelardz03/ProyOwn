import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db, firebaseReady } from './firebase'
import { useAuth } from './AuthContext'

// Lee en vivo (onSnapshot) una colección del usuario logueado:
// /users/{uid}/{name}. Sin Firebase configurado o sin sesión, regresa
// vacío en vez de tronar (modo local sigue funcionando sin datos).
export function useUserCollection(name) {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseReady || !user) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'users', user.uid, name), orderBy('creadoEn', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error(`Error leyendo ${name}:`, err)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user, name])

  return { data, loading }
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
