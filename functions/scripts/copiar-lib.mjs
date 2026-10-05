// Copia el motor de Whital (funciones puras del front) a functions/whital para que
// la función programada calcule los avisos con la MISMA lógica que la app.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const destino = join(raiz, 'functions', 'whital')
mkdirSync(destino, { recursive: true })
for (const f of ['budget.js', 'vista.js', 'notificaciones.js', 'recordatorio.js']) {
  // Vite acepta imports sin extensión; Node no: se agrega `.js` a los relativos.
  const codigo = readFileSync(join(raiz, 'src', 'whital', 'lib', f), 'utf8').replace(/(from\s+['"]\.\/[\w-]+)(['"])/g, '$1.js$2')
  writeFileSync(join(destino, f), codigo)
}
console.log('Motor copiado a functions/whital')
