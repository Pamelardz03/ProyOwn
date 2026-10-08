import { getStorage } from 'firebase/storage'
import { app } from './firebase'

// Cloud Storage de Firebase (fotos). Aparte de firebase.js para no cargar este código si no se usa.
export const storage = app ? getStorage(app) : null
