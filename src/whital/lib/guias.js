// Guías animadas por pantalla (se ven la primera vez que se toca el "?" de esa pantalla).
// Cada paso apunta a un elemento con `selector` (CSS). Los pasos nunca se saltan: si una pantalla puede
// estar vacía (cuenta nueva), debe mostrar un ejemplo falso mientras dura la guía (`EjemploGuia`, `useGuia`).
//   gesto: 'tocar' | 'deslizar' | 'mirar'  -> animación que se muestra sobre el elemento.
// Reglas: máx. ~6 pasos por pantalla, título de 1-3 palabras, texto de una o dos líneas cortas.
// Para apuntar a algo nuevo, ponle `data-guia="nombre"` en la pantalla y úsalo aquí.
const MENU = { selector: 'nav.bottom-nav', titulo: 'Menú', texto: 'Cambia de pantalla desde aquí.', gesto: 'tocar' }
const MAS = { selector: '[data-guia="mas"]', titulo: 'Agregar', texto: 'Toca + para anotar un gasto, Whimm, Vitall o ingreso.', gesto: 'tocar' }
const PESTANAS = { selector: '[data-guia="pestanas"]', titulo: 'Whimms y Vitalls', texto: 'Cambia entre lo que quieres comprar y tus pagos fijos.', gesto: 'tocar' }

export const GUIAS = {
  '/': [
    { selector: '[data-guia="avatar"]', titulo: 'Tu perfil', texto: 'Toca tu foto para ver sueldos, avisos, temas, ajustes y cerrar sesión.', gesto: 'tocar' },
    { selector: '.hero-vivo', titulo: 'Tu saldo', texto: 'Lo que tienes ahora en el banco.', gesto: 'mirar' },
    { selector: '.tile-hoy', titulo: 'Para gastar hoy', texto: 'Lo que puedes gastar hoy. Baja con cada gasto que anotas.', gesto: 'mirar' },
    { selector: '.tile-hoy + *', titulo: 'Próxima compra', texto: 'Tu siguiente Whimm y en cuántos días te alcanza. Tócalo para verlo.', gesto: 'tocar' },
    { selector: '[data-guia="semana"]', titulo: 'Tu semana', texto: 'Cada barra es un día. Toca una para ver sus gastos.', gesto: 'tocar' },
    { selector: '[data-guia="acciones"]', titulo: 'Hoy', texto: 'Cobros y pagos del día. Aquí confirmas que ya te llegó tu sueldo.', gesto: 'tocar' },
    { selector: '[data-guia="cajitas"]', titulo: 'Cajitas', texto: 'Solo para ver cuánto dinero hay en cada parte. No mueven tu dinero real.', gesto: 'mirar' },
    MENU,
  ],
  '/gastos': [
    { selector: '[data-guia="periodo"]', titulo: 'Periodo', texto: 'Cambia qué días quieres ver.', gesto: 'tocar' },
    { selector: '[data-guia="totales"]', titulo: 'Gastos y compras', texto: 'Gastos: lo que gastaste. Compras Whimm: lo que pagaste por tus Whimms. Los dos son del periodo.', gesto: 'mirar' },
    { selector: '[data-guia="fila"]', titulo: 'Tus gastos', texto: 'Toca uno para editarlo. Deslízalo a la izquierda para eliminarlo.', gesto: 'deslizar' },
    MAS,
    MENU,
  ],
  '/whimms': [
    PESTANAS,
    { selector: '[data-guia="tabs-whimms"]', titulo: 'Tu lista', texto: 'Mira lo que sigue, lo que pagas a meses y lo ya comprado.', gesto: 'tocar' },
    { selector: '[data-guia="fila"]', titulo: 'Un Whimm', texto: 'Toca para ver su detalle. Deslízalo a la izquierda para eliminarlo.', gesto: 'deslizar' },
    MAS,
    MENU,
  ],
  '/vitalls': [
    PESTANAS,
    { selector: '[data-guia="fila"]', titulo: 'Un Vitall', texto: 'Toca para ver sus pagos. Deslízalo a la izquierda para eliminarlo.', gesto: 'deslizar' },
    MAS,
    MENU,
  ],
  '/calendar': [
    { selector: 'button[aria-label="Mes siguiente"]', titulo: 'Cambiar de mes', texto: 'Avanza o regresa con las flechas.', gesto: 'tocar' },
    { selector: '.screen .card', titulo: 'Tu mes', texto: 'Cada día marca cobros, pagos y compras. Toca un día para ver el detalle.', gesto: 'tocar' },
    { selector: '[data-guia="proximos"]', titulo: 'Próximos eventos', texto: 'Tus siguientes cobros y pagos, en orden por fecha y con su monto. Filtra por tipo arriba.', gesto: 'tocar' },
    MENU,
  ],
  '/perfil': [
    { selector: '.screen a[href*="configuracion"]', titulo: 'Ajustar saldo', texto: 'Si tu saldo no cuadra con el banco, corrígelo aquí.', gesto: 'tocar' },
    { selector: '.screen .row-list', titulo: 'Tu cuenta', texto: 'Sueldos, pagos fijos, avisos, temas y más.', gesto: 'tocar' },
    { selector: '[data-guia="legales"]', titulo: 'Términos y privacidad', texto: 'Consulta las reglas de uso y cómo se cuidan tus datos.', gesto: 'tocar' },
    { selector: '[data-guia="cerrar-sesion"]', titulo: 'Cerrar sesión', texto: 'Sal de tu cuenta desde aquí.', gesto: 'tocar' },
  ],
  '/perfil/sueldos': [
    { selector: '[data-guia="sueldo-botones"]', titulo: 'Agregar ingresos', texto: 'Sueldo fijo para lo que cobras siempre; ingreso rápido para algo extra.', gesto: 'tocar' },
    { selector: '[data-guia="sueldos-fijos"]', titulo: 'Sueldos fijos', texto: 'Toca uno para editarlo, desliza para eliminarlo. Marca "Ya llegó" cuando se deposite.', gesto: 'deslizar' },
    { selector: '[data-guia="sueldos-rapidos"]', titulo: 'Ingresos rápidos', texto: 'Tus ingresos extra recientes, del más nuevo al más viejo.', gesto: 'mirar' },
  ],
  '/perfil/pagos-fijos': [
    { selector: '[data-guia="fijo-total"]', titulo: 'Total al mes', texto: 'Lo que pagas en un mes entre todos tus pagos fijos.', gesto: 'mirar' },
    { selector: '[data-guia="fijo-lista"]', titulo: 'Tus pagos fijos', texto: 'Toca uno para abrirlo en Vitalls y editarlo.', gesto: 'tocar' },
  ],
  '/perfil/metricas': [
    { selector: '[data-guia="metricas"]', titulo: 'Tus números', texto: 'Promedios, mayores gastos, compras y pagos fijos en un vistazo.', gesto: 'mirar' },
  ],
  '/perfil/notificaciones': [
    { selector: '[data-guia="avisos-info"]', titulo: 'Frecuencia general', texto: 'Cada Whimm, Vitall o sueldo puede tener la suya y esa manda.', gesto: 'mirar' },
    { selector: '[data-guia="avisos-grupo"]', titulo: 'Cada cuánto avisar', texto: 'Elige la frecuencia de cada tipo de aviso.', gesto: 'tocar' },
  ],
  '/perfil/configuracion': [
    { selector: '[data-guia="ajustar-saldo"]', titulo: 'Ajustar saldo', texto: 'Si tu saldo no cuadra con el banco, escribe el del banco y se corrige.', gesto: 'tocar' },
    { selector: '[data-guia="config-lineas"]', titulo: 'Saldo y presupuesto', texto: 'Toca un valor para cambiarlo. El presupuesto semanal es tu caja de cada semana.', gesto: 'tocar' },
    { selector: '[data-guia="datos-prueba"]', titulo: 'Datos de prueba', texto: 'Llena la app con ejemplos para explorarla. Bórralos cuando quieras.', gesto: 'mirar' },
  ],
  '/perfil/temas': [
    { selector: '[data-guia="paleta"]', titulo: 'Paleta', texto: 'Toca una para cambiar el color de acento al instante.', gesto: 'tocar' },
    { selector: '[data-guia="fondo"]', titulo: 'Fondo', texto: 'Elige un fondo claro u oscuro.', gesto: 'tocar' },
  ],
  '/perfil/widget': [
    { selector: '[data-guia="widget-info"]', titulo: 'Para qué sirve', texto: 'Muestra cuánto puedes gastar hoy sin abrir la app.', gesto: 'mirar' },
    { selector: '[data-guia="widget-codigo"]', titulo: 'Tu código', texto: 'Genéralo y pégalo una sola vez en la app de Android.', gesto: 'tocar' },
  ],
  '/perfil/terminos': [
    { selector: '[data-guia="documento"]', titulo: 'Términos', texto: 'Las reglas de uso de Whital. Desliza para leerlos.', gesto: 'deslizar' },
  ],
  '/perfil/politica': [
    { selector: '[data-guia="documento"]', titulo: 'Privacidad', texto: 'Qué datos guarda Whital y cómo se cuidan. Desliza para leerla.', gesto: 'deslizar' },
  ],
  '/perfil/privacidad': [
    { selector: '[data-guia="priv-guarda"]', titulo: 'Tus datos', texto: 'Qué guarda Whital: solo tú puedes verlo.', gesto: 'mirar' },
    { selector: '[data-guia="priv-descargar"]', titulo: 'Descargar', texto: 'Baja un archivo con todo lo que registraste.', gesto: 'tocar' },
    { selector: '[data-guia="priv-peligro"]', titulo: 'Eliminar cuenta', texto: 'Borra tu cuenta y tus datos para siempre. Pide confirmación.', gesto: 'tocar' },
  ],
}
