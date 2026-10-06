// Marcar un cobro de sueldo fijo como llegado o pendiente.
// "Aún no llega" = esa fecha deja de contar en el saldo (y queda pendiente);
// "Ya llegó" = vuelve a contar. Usa la misma excepción por fecha que el resto.
import { updateUserDoc } from '../../lib/firestoreCollections'
import { todayISO } from './budget'

export function marcarCobro(uid, sueldo, fecha, llego) {
  const exc = sueldo?.excepciones?.[fecha] || {}
  return updateUserDoc(uid, 'sueldosFijos', sueldo.id, { [`excepciones.${fecha}`]: { ...exc, omitida: !llego, pendiente: !llego, ...(llego ? { marcadoEn: todayISO() } : {}) } })
}
