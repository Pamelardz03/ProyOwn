# Whital — reglas del repo

App de finanzas personales (React 19 + Vite + Firebase). Idioma del producto, comentarios y commits: **español**. Commits en Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`), una idea por commit.

## Mapa del código

| Dónde | Qué vive ahí | Puede importar de |
|---|---|---|
| `src/whital/lib/` | Motor y lógica **pura** (`budget`, `vista`, `calendario`, `notificaciones`, `recordatorio`, `historial`, `metricas`, `periodos`) y adaptadores del navegador/Firebase (`barra`, `push`, `imagenes`, `cuenta`, `seed`, `ultimaCompras`) | los puros, solo entre sí y JS estándar |
| `src/whital/hooks/` | Lectura de datos (`useWhitalDatos`) y estado de UI | `lib/`, `src/lib/` |
| `src/whital/components/` | Piezas de UI reutilizables | `lib/`, `hooks/`, `src/components/` |
| `src/whital/pages/` | Una pantalla por archivo; subpantallas de Perfil en `pages/perfil/` | todo lo anterior |
| `src/lib/` | Infraestructura compartida: Firebase, sesión, acceso a Firestore, Storage | Firebase SDK |
| `src/components/`, `src/hooks/` | Piezas genéricas (iconos, toast, swipe) sin lógica de negocio | React |
| `functions/` | Cloud Functions: avisos, widget, cuenta/respaldo | motor copiado a `functions/whital/` |
| `android/` | App, widget y reloj (Wear OS) | datos que manda `functions/widget.js` |

Ya no existe la "app clásica" (`src/pages`, `src/lib/budget.js`...): se eliminó porque ninguna cuenta la veía. Si hace falta algo de ella, está en el historial de git.

## Reglas para crecer

1. **Dirección de dependencias, siempre hacia abajo:** `pages → components → hooks → lib`. Los archivos puros de `lib/` nunca importan React, `pages` ni el navegador (`window`, `document`, `localStorage`, Firebase). Lo que toca el navegador va en un adaptador aparte (`barra`, `push`...); si un cálculo necesita algo del navegador, se divide y la parte pura queda en el motor.
2. **El motor es puro y se recalcula en vivo.** Nunca se guarda un saldo o total derivado en Firestore; se guarda la línea de tiempo de eventos reales (gastos, sueldos, pagos, compras) y todo lo demás sale de `budget.js`/`vista.js`.
3. **Motor compartido con el servidor.** `functions/scripts/copiar-lib.mjs` copia `budget.js`, `vista.js`, `notificaciones.js` y `recordatorio.js` a `functions/whital/` (carpeta ignorada por git). Esos cuatro archivos solo pueden importarse entre sí con rutas relativas `./nombre`. Si otro archivo del motor pasa a ser necesario en el servidor, se agrega a la lista del script.
4. **Un archivo de pantalla no debería pasar de ~500 líneas.** Al pasarse, las secciones se extraen (pendiente: `Whimms.jsx`, ~750 líneas) a `components/` o a un archivo hermano (como `pages/perfil/piezas.jsx`). Los cálculos que aparezcan en una página se mueven a `lib/`.
5. **Nada de números mágicos de negocio en pantallas.** Montos, topes y porcentajes viven como constante nombrada en `lib/` o, si el usuario puede cambiarlos, en `config/presupuesto` del usuario con un valor por defecto en `lib/`.
6. **Todo lo que el usuario pueda querer ajustar es configuración, no código.** Orden obligatorio al agregar una opción: (a) campo en `config/presupuesto`, (b) lectura con valor por defecto en `parametrosMotor` (`lib/vista.js`), (c) control en Perfil > Configuración, (d) el motor la recibe por parámetro. Nunca leer `config` directo dentro de `budget.js`.
7. **Datos por usuario:** todo cuelga de `users/{uid}/...` y las reglas de `firestore.rules` / `storage.rules` solo dejan leer y escribir lo propio. Una colección nueva se agrega en `useWhitalDatos`, en `functions/cuenta.js` (respaldo y borrado de cuenta) y en `lib/seed.js` si debe tener datos de prueba.
8. **Cambios de forma de datos son compatibles hacia atrás:** el motor debe seguir leyendo documentos viejos (ver `normalizarNivel`, `nivelDeEscala10`). Si se renombra un campo, la lectura acepta ambos.
9. **Sin código muerto.** Lo que se reemplaza se borra en el mismo commit (el historial de git es el respaldo): nada de funciones, exports, clases CSS o archivos "por si acaso", ni comentarios que describan un motor o pantalla que ya no existe. Antes de cerrar una tarea: `npm run lint` y `npm run build` sin errores.
10. **Android:** el widget y el reloj solo leen lo que arma `functions/widget.js`; no calculan presupuesto. Cualquier número nuevo en pantalla del widget se calcula en el motor y se agrega a ese payload.
11. **Estilos:** `src/index.css` = base y utilidades compartidas; `src/whital/whital.css` = temas y overrides dentro de `.whital`; `loginWhital.css` = login/saludo (`wl-*`). Colores siempre con variables de tema (`var(--wine)`...), nunca hex sueltos en pantallas nuevas.

## Regla de la caja semanal (resumen de `cajaSemanal` en `lib/budget.js`)

- La unidad es la **semana lunes–domingo**: cada lunes la caja = `presupuestoSemanal` + lo que se decidió mantener. Lo "por día" es solo guía.
- Pasarte de un día sale de la misma caja; pasarte de la semana lo cubre Whimms y **no** afecta semanas siguientes.
- Al cerrar la semana, lo que sobró se manda a Whimms o se mantiene (`cierresSemana[lunes]`); sin decisión, no se arrastra.
- `presupuestoSemanal` viene de la configuración del usuario; 840 es solo el valor por defecto.
- **Pendientes de diseño conocidos:** el monto aplica retroactivamente a semanas pasadas (falta guardarlo con vigencia por semana), `MODELO_SEMANAL_DESDE` está fija en código, el día de inicio de semana no es configurable, y no hay "mantener siempre" ni mantener solo una parte.

## Pruebas manuales mínimas antes de un commit de motor

Probar con cuenta nueva (sin datos), con datos de prueba (Perfil > Configuración) y cambiando `presupuestoSemanal`; revisar que Inicio, Gastos, Whimms y el widget coinciden en "disponible de la semana".
