// Color de la barra de estado (la franja de arriba) en la app de Android.
// Chrome solo repinta esa barra cuando el color de <meta name="theme-color"> CAMBIA, y la
// reinicia al cambiar de pantalla; por eso, si el valor ya es el correcto, se cambia por otro
// que difiere en UN solo punto de azul (imperceptible) y se vuelve a poner el correcto.
// Se llama al abrir, al cambiar de tema y en cada pantalla.
function casiIgual(color) {
  const m = /^#([0-9a-f]{6})$/i.exec(color)
  if (!m) return color
  const n = parseInt(m[1], 16)
  const azul = n & 0xff
  return `#${((n & 0xffff00) | (azul === 0xff ? 0xfe : azul + 1)).toString(16).padStart(6, '0')}`
}

export function repintarBarra(color) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  if (meta.getAttribute('content') === color) {
    meta.setAttribute('content', casiIgual(color))
    setTimeout(() => meta.setAttribute('content', color), 60)
  } else {
    meta.setAttribute('content', color)
  }
}
