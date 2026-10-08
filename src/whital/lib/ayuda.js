// Ayuda corta por pantalla (botón "?" arriba a la derecha). Solo texto: una pantalla = un bloque.
// Reglas: máximo 3 puntos, cada uno de una línea. Si una pantalla nueva no tiene bloque aquí, no muestra "?".
// Más adelante este archivo puede alimentar las preguntas frecuentes.
export const AYUDA = {
  '/': {
    titulo: 'Inicio',
    puntos: ['Para gastar hoy: lo que te queda de la semana entre los días que faltan.', 'La semana va de lunes a domingo.', 'Abajo ves tu próxima compra y los pagos que vienen.'],
  },
  '/gastos': {
    titulo: 'Gastos',
    puntos: ['Toca + (abajo, al centro) para anotar lo que gastaste.', 'Cada gasto baja tu caja de la semana.', 'Cambia el periodo arriba para ver más o menos días.'],
  },
  '/whimms': {
    titulo: 'Whimms',
    puntos: ['Lo que quieres comprar, en fila por prioridad.', 'Whital calcula la fecha en que ya te alcanza.', 'Toca uno para ver detalle, editarlo o marcarlo comprado.'],
  },
  '/vitalls': {
    titulo: 'Vitalls',
    puntos: ['Tus pagos fijos: suscripciones, renta, pagos a meses.', 'Whital los aparta antes de repartir tu dinero.', 'Puedes pausar uno o cambiar su monto en una fecha.'],
  },
  '/calendar': {
    titulo: 'Calendario',
    puntos: ['Ves cobros, pagos y compras proyectadas por día.', 'Toca un día para ver el detalle.', 'Cambia de mes con las flechas.'],
  },
  '/perfil': {
    titulo: 'Perfil',
    puntos: ['Aquí están tus sueldos, pagos fijos y ajustes.', 'Configuración: presupuesto semanal y saldo.', 'Temas y Widget cambian cómo se ve y se usa la app.'],
  },
  '/perfil/historial': { titulo: 'Historial', puntos: ['Todo lo que ha pasado en tu cuenta, de lo más nuevo a lo más viejo.', 'Filtra por tipo con los botones de arriba.'] },
  '/perfil/pagos-fijos': { titulo: 'Pagos fijos', puntos: ['Agrega aquí tus Vitalls: monto, frecuencia y fecha.', 'Un pago a meses termina solo al completar los plazos.'] },
  '/perfil/sueldos': { titulo: 'Sueldos', puntos: ['Tus ingresos fijos y los rápidos (extras).', 'Marca "ya llegó" cuando se deposite.'] },
  '/perfil/metricas': { titulo: 'Métricas', puntos: ['Resumen de cómo vas con tus gastos y compras.'] },
  '/perfil/notificaciones': { titulo: 'Avisos', puntos: ['Elige qué avisos quieres y cada cuánto.'] },
  '/perfil/configuracion': { titulo: 'Configuración', puntos: ['Presupuesto semanal: lo que tienes para gastar cada semana.', 'Saldo: ajústalo cuando no cuadre con tu banco.'] },
  '/perfil/temas': { titulo: 'Temas', puntos: ['Cambia el color y el fondo de la app.'] },
  '/perfil/widget': { titulo: 'Widget', puntos: ['Copia el código y pégalo en el widget de Android.', 'Muestra lo que te queda para hoy sin abrir la app.'] },
  '/perfil/terminos': { titulo: 'Términos', puntos: ['Las reglas de uso de Whital.'] },
  '/perfil/politica': { titulo: 'Privacidad', puntos: ['Qué datos guarda Whital y cómo los proteges.'] },
  '/perfil/privacidad': { titulo: 'Privacidad', puntos: ['Descarga tus datos o elimina tu cuenta.'] },
}
