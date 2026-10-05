// Color de la barra de estado (la franja de arriba) en la app de Android.
// Chrome solo repinta esa barra cuando el color de <meta name="theme-color"> CAMBIA, y la
// reinicia al cambiar de pantalla; por eso, si el valor ya es el correcto, se cambia por un
// instante y se vuelve a poner. Se llama al abrir, al cambiar de tema y en cada pantalla.
export function repintarBarra(color) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  if (meta.getAttribute('content') === color) {
    meta.setAttribute('content', '#010101')
    setTimeout(() => meta.setAttribute('content', color), 60)
  } else {
    meta.setAttribute('content', color)
  }
}
