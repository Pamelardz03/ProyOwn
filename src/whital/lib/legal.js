// Textos legales (única fuente: se muestran dentro de la app, con el tema). Para cambiar algo,
// edita aquí y actualiza `fecha`. Bloques: { h } subtítulo, { p } párrafo, { ul } lista,
// { contacto: true } línea de contacto. `**así**` marca negritas.
export const DOCUMENTOS = {
  terminos: {
    titulo: 'Términos y condiciones',
    fecha: '5 de octubre de 2026',
    bloques: [
      { h: 'Qué es Whital' },
      { p: 'Una herramienta personal para organizar tu presupuesto y planear compras. Los cálculos (por ejemplo, "para gastar hoy" o las fechas estimadas de tus Whimms) son orientativos y dependen de lo que tú registras.' },
      { h: 'No es asesoría financiera' },
      { p: 'Whital no da asesoría financiera, fiscal ni legal. Las decisiones sobre tu dinero son tuyas. Revisa siempre tus saldos reales en tu banco.' },
      { h: 'Tu cuenta' },
      { p: 'Entras con tu cuenta de Google y eres responsable de mantenerla segura y de la veracidad de lo que registras. No compartas el código de tu widget: quien lo tenga puede ver tu resumen del día.' },
      { h: 'Uso aceptable' },
      { p: 'No uses la app para actividades ilegales, para intentar acceder a datos de otras personas ni para sobrecargar el servicio.' },
      { h: 'Disponibilidad' },
      { p: 'La app se ofrece "tal cual", sin garantía de que esté disponible siempre o libre de errores. Puede cambiar o dejar de funcionar. Se hacen respaldos semanales, pero se recomienda descargar tus datos de vez en cuando desde Perfil → Privacidad y datos.' },
      { h: 'Eliminar tu cuenta' },
      { p: 'Puedes eliminar tu cuenta y todos tus datos cuando quieras desde la app. Consulta la política de privacidad (en Perfil) para ver qué se borra.' },
      { h: 'Cambios y contacto' },
      { p: 'Estos términos pueden actualizarse; la fecha de arriba lo indica.' },
      { contacto: true },
    ],
  },
  privacidad: {
    titulo: 'Política de privacidad',
    fecha: '5 de octubre de 2026',
    bloques: [
      { p: 'Whital es una aplicación personal para llevar tu presupuesto: gastos, sueldos, pagos fijos y compras que quieres hacer ("Whimms"). Esta política explica qué datos guarda, para qué y cómo puedes controlarlos.' },
      { h: 'Qué datos guarda' },
      {
        ul: [
          '**Tu cuenta de Google:** identificador, nombre, correo y foto, que Google entrega cuando inicias sesión. No se guarda ninguna contraseña.',
          '**Lo que tú registras:** gastos, sueldos, pagos fijos, Whimms (nombre, precio, enlace y foto que elijas), ajustes de saldo y tu configuración (presupuesto, tema, notificaciones).',
          '**Datos para avisos y widget:** un identificador del dispositivo para enviarte notificaciones, y un código personal del widget (se guarda cifrado con una huella, no en claro).',
          '**Respaldos:** una copia semanal de tus datos, de la que se conservan las últimas 8.',
        ],
      },
      { p: 'La app **no** usa anuncios ni herramientas de analítica o seguimiento, y **no** accede a tus contactos, ubicación ni mensajes.' },
      { h: 'Para qué se usan' },
      { p: 'Solo para que la app funcione: mostrarte tus números, calcular cuánto puedes gastar, enviarte los avisos que activaste y actualizar el widget. No se usan para publicidad ni se venden.' },
      { h: 'Dónde se guardan y quién los procesa' },
      { p: 'Tus datos se guardan en los servicios de Google Firebase / Google Cloud (inicio de sesión, base de datos, almacenamiento de fotos, funciones y mensajería), en la región us-central1 (Estados Unidos). Las páginas de la app se publican en GitHub Pages, que puede registrar datos técnicos de la visita, como la dirección IP. No se comparten tus datos con nadie más.' },
      { h: 'Cómo se protegen' },
      { p: 'Solo tu sesión puede leer y escribir tus datos: las reglas del servidor lo exigen. La conexión va cifrada y los datos están cifrados en reposo por Google. Para cuidar tu cuenta, activa la verificación en dos pasos en tu cuenta de Google.' },
      { h: 'Cuánto tiempo se conservan' },
      { p: 'Mientras tengas la cuenta. Si la eliminas, se borran de inmediato tus datos, fotos, respaldos, el código del widget y tu usuario.' },
      { h: 'Tus derechos' },
      {
        ul: [
          '**Ver y corregir:** todo lo que registraste está en la app y lo puedes editar.',
          '**Descargar tus datos:** en Perfil → Privacidad y datos → "Descargar mis datos".',
          '**Eliminar tu cuenta y tus datos:** en Perfil → Privacidad y datos → "Eliminar mi cuenta y mis datos". No se puede deshacer.',
        ],
      },
      { h: 'Menores de edad' },
      { p: 'Whital no está dirigida a menores de 13 años.' },
      { h: 'Cambios y contacto' },
      { p: 'Si esta política cambia, se actualizará la fecha de arriba. Para dudas o solicitudes sobre tus datos:' },
      { contacto: true },
    ],
  },
}

export const CONTACTO_URL = 'https://github.com/Pamelardz03/ProyOwn/issues'
