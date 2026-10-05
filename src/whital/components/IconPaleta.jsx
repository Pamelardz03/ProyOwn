// Ícono de paleta de pintura (para Perfil > Apariencia).
export default function IconPaleta({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.5a7.5 7.5 0 1 0 0 15c1 0 1.6-.7 1.6-1.5 0-.5-.2-.8-.4-1.1-.3-.4-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5h1.8a3 3 0 0 0 3-3C16.7 5.4 13.7 2.5 10 2.5z" />
      <circle cx="6.5" cy="9.5" r=".6" />
      <circle cx="9" cy="6.3" r=".6" />
      <circle cx="12.6" cy="7" r=".6" />
    </svg>
  )
}
