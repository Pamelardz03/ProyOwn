// Compara un payload de edición contra el documento original para saber
// si de verdad hay algo que guardar (a pedido de Pame, vigésima séptima
// tanda: "valida que algo cambió... si no se cambió nada y como quiera
// le dio a guardar, este no hace nada ni registra nada") — evita
// escribir en Firestore, mostrar el toast de "actualizado" y generar
// ruido en Historial cuando el usuario abre editar y guarda sin tocar
// nada, o deja los mismos valores de siempre.
//
// `payload` ya viene con los valores normalizados (Number(), trim(), …)
// tal como se van a guardar. Cada campo se compara contra el mismo campo
// en `original`, usando el propio valor de `payload` como default cuando
// el documento original nunca tuvo ese campo (ej. `reembolso` en gastos
// viejos) — así un campo que "aparece" con su valor por default no
// cuenta como cambio. Los arreglos (ej. `links` de un Whimm) se comparan
// por contenido, no por referencia — uno reconstruido desde el form con
// los mismos valores no debe verse como "cambiado".
export function hayCambios(original, payload) {
  if (!original) return true
  return Object.keys(payload).some((key) => {
    const antes = original[key] !== undefined ? original[key] : payload[key]
    const ahora = payload[key]
    if (Array.isArray(antes) || Array.isArray(ahora)) {
      return JSON.stringify(antes || []) !== JSON.stringify(ahora || [])
    }
    return antes !== ahora
  })
}
