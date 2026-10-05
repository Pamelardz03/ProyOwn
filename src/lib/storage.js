import { getStorage } from 'firebase/storage'
import { app } from './firebase'

// Cloud Storage de Firebase (fotos). Aparte de firebase.js para que la app de siempre
// no cargue este código si no lo usa.
export const storage = app ? getStorage(app) : null
