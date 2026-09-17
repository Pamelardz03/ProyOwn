import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Cambia '/organizador-gastos/' por '/NOMBRE-DEL-REPO/' cuando subas el proyecto a GitHub,
// para que las rutas funcionen en GitHub Pages (usuario.github.io/NOMBRE-DEL-REPO/).
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/organizador-gastos/',
  plugins: [react()],
})
