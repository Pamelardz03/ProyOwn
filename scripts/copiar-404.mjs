// GitHub Pages no sabe que /gastos o /perfil son pantallas de la app y responde 404 si el
// navegador recarga en una de ellas (por ejemplo, tras tocar el widget). La solución estándar
// para una app de una sola página: publicar una 404.html que es la propia app. El navegador
// la carga igual y el enrutador de la app muestra la pantalla que corresponde.
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (!existsSync(join(dist, 'index.html'))) throw new Error('Falta dist/index.html: corre primero vite build')
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'))
console.log('dist/404.html creado (copia de index.html)')
