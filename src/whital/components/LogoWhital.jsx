// Marca de Whital: cuadro vino con una W que se dibuja sola (la animación está en
// loginWhital.css y se apaga con "reducir movimiento").
export default function LogoWhital({ size = 72, animado = true }) {
  return (
    <svg className={animado ? 'wl-logo wl-logo-anim' : 'wl-logo'} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Whital">
      <rect width="64" height="64" rx="18" fill="var(--wine)" />
      <polyline className="wl-trazo" points="15,19 24,46 32,28 40,46 49,19" fill="none" stroke="#f3efe2" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength="100" />
      <circle cx="49" cy="19" r="3.4" fill="var(--wine5)" />
    </svg>
  )
}
