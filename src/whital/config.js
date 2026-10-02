// Gate por cuenta (decisión final, 2 oct — ver organizador-gastos-reglas-
// actuales.md sección 10, punto 1): Pame no quiso ni repo nuevo ni rama
// nueva para probar Whital, así que todo vive en el mismo sitio de
// siempre, diferenciado por qué cuenta de Google inició sesión.
//
// Si `user.uid` está en esta lista, App.jsx renderiza el App Shell/motor
// nuevo de Whital (src/whital/) en vez de la app de producción de hoy.
// Vacío por ahora -- se llena con el UID real de la cuenta
// pamela.rodriguezd@udem.edu la primera vez que Pame inicie sesión con
// ella (se lee con una diagnosis de solo lectura, nunca escribiendo nada).
export const WHITAL_UIDS = []

export function esCuentaWhital(uid) {
  return !!uid && WHITAL_UIDS.includes(uid)
}
