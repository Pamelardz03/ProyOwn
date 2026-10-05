// Última sección usada de Compras (Whimms o Vitalls): a ella lleva la pestaña de abajo.
export const CLAVE_COMPRAS = 'whital:compras'

export function ultimaCompras() {
  try {
    return localStorage.getItem(CLAVE_COMPRAS) === '/vitalls' ? '/vitalls' : '/whimms'
  } catch {
    return '/whimms'
  }
}
