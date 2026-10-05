// Ícono combinado de Compras: la bolsa de los Whimms con las flechas circulares de los
// Vitalls adentro.
export default function IconCompras({ size = 20, color = '#b3ad8e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h10l-.8 9.2a1.8 1.8 0 0 1-1.8 1.6H7.6a1.8 1.8 0 0 1-1.8-1.6L5 7z" />
      <path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
      <g strokeWidth="1.3">
        <path d="M7.9 11.7a2.3 2.3 0 0 1 4-.7" />
        <path d="M12.2 9.7v1.4h-1.4" />
        <path d="M12.1 13.3a2.3 2.3 0 0 1-4 .7" />
        <path d="M7.8 15.3v-1.4h1.4" />
      </g>
    </svg>
  )
}
