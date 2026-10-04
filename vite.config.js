import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

// Commit con el que se construye (se muestra en Perfil para saber qué versión estás viendo).
function versionGit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'local'
  }
}

// Cambia '/organizador-gastos/' por '/NOMBRE-DEL-REPO/' cuando subas el proyecto a GitHub,
// para que las rutas funcionen en GitHub Pages (usuario.github.io/NOMBRE-DEL-REPO/).
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/organizador-gastos/',
  plugins: [react()],
  define: { __WHITAL_VERSION__: JSON.stringify(versionGit()) },
  server: {
    // host:true expone el server en la red local (te da una IP tipo
    // http://192.168.x.x:5174) para poder probar desde el celular.
    host: true,
    // Sin esto, el navegador bloquea que la ventana emergente de Google le
    // avise a la página cuando el login termina — la ventana se abre, no
    // logra comunicarse y se cierra sola casi de inmediato.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
})
