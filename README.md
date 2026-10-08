# Whital (organizador-gastos)

App personal (React + Vite + Firebase) para organizar sueldo, gastos, Whimms (cosas que quieres, con prioridad) y Vitalls (pagos recurrentes), con widget y app de reloj en Android.

Las reglas de cómo está organizado el código y cómo debe crecer están en [CLAUDE.md](./CLAUDE.md). Léelo antes de tocar el motor, Firestore o las funciones.

## Requisitos

- Node 22+
- Una cuenta de Google (Firebase)

## Correr en local

```bash
npm install
cp .env.example .env.local   # pega las llaves de Firebase (sin comillas)
npm run dev
```

Sin `.env.local` la app abre el login pero no puede entrar: falta configurar Firebase. Reinicia `npm run dev` después de editar `.env.local` (Vite solo lee las variables al arrancar). La terminal imprime una URL de red para abrirla desde el celular en la misma WiFi.

## Crear el proyecto de Firebase

1. https://console.firebase.google.com/ → **Crear proyecto** (el plan Spark basta).
2. **Authentication → Sign-in method** → habilita **Google**.
3. **Firestore Database** → crear en modo producción y publicar [`firestore.rules`](./firestore.rules). Storage usa [`storage.rules`](./storage.rules).
4. **Configuración del proyecto → Tus apps** → agrega una app Web y copia el `firebaseConfig` a `.env.local`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Desplegar (GitHub Pages)

1. **Settings → Pages → Source** = GitHub Actions.
2. **Settings → Secrets and variables → Actions**: agrega los 6 secrets `VITE_FIREBASE_*` con los mismos valores de `.env.local`.
3. **Firebase → Authentication → Authorized domains**: agrega `tu-usuario.github.io`.
4. Cada push a `main` ejecuta [`deploy.yml`](./.github/workflows/deploy.yml); el `base` de Vite sale del nombre del repo.

## Estructura

```
src/
  main.jsx, App.jsx      # arranque, sesión y puerta login -> app
  lib/                   # infraestructura compartida: Firebase, sesión, acceso a Firestore
  components/, hooks/    # piezas genéricas (iconos, toast, swipe)
  whital/                # TODA la app: ver CLAUDE.md
    lib/                 #   motor y lógica pura (budget, vista, calendario, notificaciones...)
    hooks/               #   lectura de datos y estado de la UI
    components/          #   piezas de UI de Whital
    pages/               #   una pantalla por archivo (+ pages/perfil/)
functions/               # Cloud Functions (avisos, widget, cuenta); reusan el motor
android/                 # app, widget y app del reloj (Wear OS)
```
