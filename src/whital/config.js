// Quién ve Whital. Antes solo la cuenta de pruebas de la UDEM; ahora la ve cualquier cuenta
// de Google, excepto las de esta lista, que siguen con la app de siempre.
// (Es solo qué pantalla se muestra: la seguridad de los datos está en las reglas de Firestore y
// Storage, que dejan a cada cuenta leer y escribir únicamente lo suyo.)
//
// ntYhuOLRRZgUsp1cZUTq0ad1zZf2 = pamelardelar@gmail.com (cuenta personal, con la app original).
export const CUENTAS_CLASICAS = ['ntYhuOLRRZgUsp1cZUTq0ad1zZf2']

export function esCuentaWhital(uid) {
  return !!uid && !CUENTAS_CLASICAS.includes(uid)
}
