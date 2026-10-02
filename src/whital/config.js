// Gate por cuenta (decisión final, 2 oct — ver organizador-gastos-reglas-
// actuales.md sección 10, punto 1): Pame no quiso ni repo nuevo ni rama
// nueva para probar Whital, así que todo vive en el mismo sitio de
// siempre, diferenciado por qué cuenta de Google inició sesión.
//
// Si `user.uid` está en esta lista, App.jsx renderiza el App Shell/motor
// nuevo de Whital (src/whital/) en vez de la app de producción de hoy.
// UID real de pamela.rodriguezd@udem.edu, leído el 2 oct con una
// diagnosis de solo lectura (IndexedDB -> firebaseLocalStorageDb) sobre
// una sesión que Pame inició a mano -- nunca se escribió nada para
// obtenerlo.
export const WHITAL_UIDS = ['mXsSrvUK61NuVct4EUa4sZ2YbTP2'] // pamela.rodriguezd@udem.edu

export function esCuentaWhital(uid) {
  return !!uid && WHITAL_UIDS.includes(uid)
}
