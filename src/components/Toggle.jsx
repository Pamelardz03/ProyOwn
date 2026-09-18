export default function Toggle({ on, onClick, ariaLabel }) {
  return (
    <button
      aria-label={ariaLabel || 'Cambiar'}
      onClick={onClick}
      className="toggle"
      style={{ background: on ? 'var(--wine)' : 'var(--beige3)' }}
    >
      <span className="knob" style={{ [on ? 'right' : 'left']: 2 }} />
    </button>
  )
}
