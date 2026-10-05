// Temas de Whital: una PALETA (los colores de acento) y un FONDO (claro/oscuro). Los
// colores reales viven en whital.css (data-paleta / data-fondo en la raíz de Whital);
// aquí solo están los nombres, las muestras para elegir y el valor por defecto.
export const PALETAS = [
  { id: 'vino', nombre: 'Vino y oliva', muestra: ['#3a0f1f', '#5c2536', '#7c8c5a', '#a8b488'] },
  { id: 'oceano', nombre: 'Océano', muestra: ['#0f2a3f', '#24506f', '#3f7f8c', '#8fbfc4'] },
  { id: 'bosque', nombre: 'Bosque', muestra: ['#17382a', '#2d5f48', '#4f9a7a', '#9ccdb5'] },
  { id: 'ciruela', nombre: 'Ciruela', muestra: ['#2b1a4a', '#4b3180', '#8a6bbf', '#c4aee6'] },
  { id: 'terracota', nombre: 'Terracota', muestra: ['#4a1f12', '#7d3a24', '#c0693f', '#e3a98a'] },
]

// `barra`: color de la barra del sistema / fondo detrás de la app.
export const FONDOS = [
  { id: 'beige', nombre: 'Beige', fondo: '#f3efe2', tarjeta: '#fbfaf5', texto: '#1a1208', barra: '#f3efe2' },
  { id: 'blanco', nombre: 'Blanco', fondo: '#ffffff', tarjeta: '#f5f5f5', texto: '#141414', barra: '#ffffff' },
  { id: 'oscuro', nombre: 'Gris oscuro', fondo: '#1e1f22', tarjeta: '#26282c', texto: '#ecebe6', barra: '#1e1f22' },
]

export const TEMA_DEFECTO = { paleta: 'vino', fondo: 'beige' }

export const paletaValida = (id) => PALETAS.some((p) => p.id === id)
export const fondoValido = (id) => FONDOS.some((f) => f.id === id)
