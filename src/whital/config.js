// Gate por cuenta (decisión final, 2 oct — ver organizador-gastos-reglas-
// actuales.md sección 10, punto 1): Pame no quiso ni repo nuevo ni rama
// nueva para probar Whital, así que todo vive en el mismo sitio de
// siempre, diferenciado por qué cuenta de Google inició sesión.
//
// Si `user.uid` está en esta lista, App.jsx renderiza el App Shell/motor
// nuevo de Whital (src/whital/) en vez de la app de producción de hoy.
// UID real de pamela.rodriguezd@udem.edu: mXsSrvUK61NuVct4EUa4sZ2YbTP2
// (leído el 2 oct con una diagnosis de solo lectura sobre una sesión que
// Pame inició a mano -- nunca se escribió nada para obtenerlo).
//
// TEMPORALMENTE VACÍO (2 oct) mientras se puebla la cuenta de prueba: la
// carga de datos tiene que hacerse vía la UI real de la app (nunca
// escritura directa a Firestore), y esa UI real es justo la que este
// gate esconde detrás del placeholder. En cuanto termine de copiar los
// datos reales a la cuenta UDEM, este array vuelve a tener ese UID.
//
// Para VER Whital en tu máquina sin cambiar esta lista (y sin que se despliegue),
// agrega a .env.local (no se sube a git):  VITE_WHITAL_UIDS=mXsSrvUK61NuVct4EUa4sZ2YbTP2
// En producción esa variable no existe, así que solo cuenta la lista de abajo.
const UIDS_LOCALES = String(import.meta.env.VITE_WHITAL_UIDS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)

export const WHITAL_UIDS = [...UIDS_LOCALES]

export function esCuentaWhital(uid) {
  return !!uid && WHITAL_UIDS.includes(uid)
}
