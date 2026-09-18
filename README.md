# Organizador de Gastos

App personal (React + Vite) para organizar sueldo, gastos, gasto hormiga, una lista de Whimms (cosas que quieres) con prioridad y Vitalls (servicios recurrentes). El plan completo (arquitectura, modelo de datos, fórmula de prioridad y roadmap por fases) vive en el doc del proyecto "Aplicaciones Pame".

Este README cubre el setup técnico: repo + Firebase + despliegue a GitHub Pages.

## 1. Requisitos

- Node 22+
- Una cuenta de Google (para Firebase)

## 2. Instalar dependencias

```bash
npm install
```

## 3. Correr en local sin Firebase (para revisar el diseño)

```bash
npm run dev
```

Si todavía no existe `.env.local`, la app entra en **"modo local"**: se salta el login y muestra las 9 pantallas con datos de ejemplo (con un banner arriba avisando que falta configurar Firebase). Sirve para revisar el diseño sin tener que crear el proyecto de Firebase primero.

La terminal también imprime una URL de red (`Network: http://192.168.x.x:5174/...`) — esa es la que usas para abrir la app desde el celular, siempre que estén en la misma red WiFi.

## 4. Crear el proyecto de Firebase (para que guarde de verdad)

1. Ve a https://console.firebase.google.com/ → **Crear proyecto** (el plan gratuito "Spark" es suficiente).
2. **Authentication** → pestaña *Sign-in method* → habilita **Google**.
3. **Firestore Database** → **Crear base de datos** → modo producción, la región más cercana (ej. `us-central` o `southamerica-east1`).
4. En **Firestore Database → Reglas**, pega el contenido de [`firestore.rules`](./firestore.rules) y publica. Esto asegura que cada usuario solo pueda leer/escribir sus propios datos.
5. En **Configuración del proyecto → General**, baja hasta "Tus apps" → agrega una app **Web** (ícono `</>`). Copia los valores del objeto `firebaseConfig` que te da.

## 5. Configurar variables de entorno locales

```bash
cp .env.example .env.local
```

Abre `.env.local` y pega ahí los valores que copiaste de Firebase (sin comillas):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`.env.local` está en `.gitignore` — nunca se sube al repo. Reinicia `npm run dev` después de crearlo/editarlo (Vite solo lee las variables de entorno al arrancar). Con esto puesto, ya no aparece el banner de "modo local" y el login con Google pide tu cuenta de verdad.

## 6. Subir a GitHub y desplegar

1. Crea un repo nuevo en GitHub (público, o privado si activaste GitHub Student Pack) y conéctalo:

   ```bash
   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
   git branch -M main
   git push -u origin main
   ```

2. En el repo de GitHub: **Settings → Pages → Source** → selecciona **GitHub Actions**.
3. En **Settings → Secrets and variables → Actions**, agrega estos 6 secrets (mismos nombres y valores que tu `.env.local`):

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

4. En **Firebase → Authentication → Settings → Authorized domains**, agrega tu dominio de GitHub Pages (`tu-usuario.github.io`) para que el login con Google funcione ahí también.
5. Cada push a `main` dispara el workflow (`.github/workflows/deploy.yml`), que construye la app y la publica en GitHub Pages. El `base` de Vite se ajusta solo al nombre del repo (no hay que tocar `vite.config.js`).

## Estructura del proyecto

```
src/
  lib/
    firebase.js         # inicializa Firebase (Auth + Firestore); "modo local" si faltan las llaves
    AuthContext.jsx      # contexto de sesión (login/logout con Google)
  components/            # Icons, BottomNav, AddSheet, Toast, Toggle — compartidos entre pantallas
  hooks/useToast.js
  pages/
    Login.jsx             Inicio.jsx        Gastos.jsx         Compras.jsx
    Calendario.jsx         Perfil.jsx        MetricasStats.jsx  HistorialCompleto.jsx
    PreciosFijos.jsx       Sueldos.jsx
  App.jsx                 # navegación, rutas y el "gate" de login/modo local
firestore.rules          # reglas de seguridad (pegar en la consola de Firebase)
.github/workflows/deploy.yml   # build + deploy automático a GitHub Pages
```

## Siguiente paso

Las 9 pantallas del diseño ya están portadas a React con datos de ejemplo (Fase 1 — UI del roadmap). Lo que sigue es conectar cada pantalla a Firestore de verdad, empezando por la **Fase 2 — Sueldo y presupuesto diario** del plan.
