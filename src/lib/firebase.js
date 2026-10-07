import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Mientras no exista .env.local con las llaves reales de Firebase (ver README),
// la app sigue funcionando en "modo local" para poder revisar el diseño sin
// tronar — no hay login ni guardado real todavía, solo datos de ejemplo.
export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const app = firebaseReady ? initializeApp(firebaseConfig) : null
export const auth = firebaseReady ? getAuth(app) : null
// Caché local en el teléfono: la app abre con tus últimos datos aunque la conexión esté caída o lenta,
// y lo que registres sin conexión se sube solo al volver. Se borra al cerrar sesión.
export const db = firebaseReady ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) : null
export const googleProvider = new GoogleAuthProvider()
