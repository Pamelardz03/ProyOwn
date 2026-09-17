# Organizador de Gastos

App personal (React + Vite) para organizar sueldo, gastos, gasto hormiga y una wishlist de productos con prioridad. El plan completo (arquitectura, modelo de datos, fórmula de prioridad y roadmap por fases) vive en el doc del proyecto "Aplicaciones Pame".

Este README cubre solo el setup técnico de la **Fase 0**: repo + Firebase + despliegue a GitHub Pages.

## 1. Requisitos

- Node 22+
- Una cuenta de Google (para Firebase)

## 2. Instalar dependencias

```bash
npm install
```

## 3. Crear el proyecto de Firebase

1. Ve a https://console.firebase.google.com/ → **Crear proyecto** (el plan gratuito "Spark" es suficiente).
2. **Authentication** → pestaña *Sign-in method* → habilita **Google**.
3. **Firestore Database** → **Crear base de datos** → modo producción, la región más cercana (ej. `us-central` o `southamerica-east1`).
4. En **Firestore Database → Reglas**, pega el contenido de [`firestore.rules`](./firestore.rules) y publica. Esto asegura que cada usuario solo pueda leer/escribir sus propios datos.
5. En **Configuración del proyecto → General**, baja hasta "Tus apps" → agrega una app **Web** (ícono `</>`). Copia los valores del objeto `firebaseConfig` que te da.

## 4. Configurar variables de entorno locales

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

`.env.local` está en `.gitignore` — nunca se sube al repo.

## 5. Correr en local

```bash
npm run dev
```

Abre la URL que te muestre la terminal. Inicia sesión con Google y usa el botón "Escribir dato de prueba en Firestore" — si ves el JSON de vuelta, la Fase 0 está completa.

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
    firebase.js       # inicializa Firebase (Auth + Firestore)
    AuthContext.jsx    # contexto de sesión (login/logout con Google)
  pages/
    Home.jsx           # Fase 0: prueba de conexión con Firestore
    Placeholder.jsx     # placeholder para secciones futuras (Gastos, Wishlist)
  App.jsx               # navegación y rutas
firestore.rules          # reglas de seguridad (pegar en la consola de Firebase)
.github/workflows/deploy.yml   # build + deploy automático a GitHub Pages
```

## Siguiente paso

Con la Fase 0 funcionando (login + lectura/escritura en Firestore + desplegado en GitHub Pages), lo que sigue es la **Fase 1 — Sueldo y saldo** del roadmap.
