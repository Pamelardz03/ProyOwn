// Iconos SVG reutilizados en todo el diseño (tomados del mockup de Figma Make).
// Todos aceptan `size` y `color`/`stroke` opcionales.

export function IconHome({ size = 20, color = '#b3ad8e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 10 4l7 6.5" />
      <path d="M5 9v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" />
      <path d="M8 17v-5h4v5" />
    </svg>
  )
}

export function IconReceipt({ size = 20, color = '#b3ad8e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2.5h10v15l-2-1.3-1.5 1.3-1.5-1.3L8.5 17.5 7 16.2 5 17.5V2.5z" />
      <path d="M7.3 6.5h5.4M7.3 9.5h5.4M7.3 12.5h3.4" />
    </svg>
  )
}

export function IconBag({ size = 20, color = '#b3ad8e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h10l-.8 9.2a1.8 1.8 0 0 1-1.8 1.6H7.6a1.8 1.8 0 0 1-1.8-1.6L5 7z" />
      <path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  )
}

export function IconCalendar({ size = 20, color = '#b3ad8e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.2" width="14" height="12.8" rx="2" />
      <path d="M3 8.2h14M7 2.5v3.4M13 2.5v3.4" />
    </svg>
  )
}

export function IconPerson({ size = 20, color = '#b3ad8e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="7.3" r="3" />
      <path d="M4 16.3c0-3 2.7-5 6-5s6 2 6 5" />
    </svg>
  )
}

export function IconChevronLeft({ size = 16, color = 'var(--wine)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 4.5 6 10l6.5 5.5" />
    </svg>
  )
}

export function IconChevronRight({ size = 15, color = 'var(--muted)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 4.5l5 5.5-5 5.5" />
    </svg>
  )
}

export function IconPlus({ size = 22, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export function IconClose({ size = 14, color = 'var(--wine)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

export function IconEdit({ size = 15, color = 'var(--muted)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3l4 4-9.5 9.5H3.5V12L13 3z" />
    </svg>
  )
}

export function IconTrash({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h12M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6M6 6l.6 10a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4L14 6" />
    </svg>
  )
}

export function IconBell({ size = 14, color = 'var(--wine)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8.5a4 4 0 0 1 8 0c0 3 1 4 1.5 4.5H4.5C5 12.5 6 11.5 6 8.5z" />
      <path d="M8.3 15a1.8 1.8 0 0 0 3.4 0" />
    </svg>
  )
}

export function IconProduct({ size = 17, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <circle cx="7" cy="8.5" r="1.4" />
      <path d="M4 14l4-4 3 3 2-2 4 4" />
    </svg>
  )
}

export function IconHeart({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17.2s-6.7-4.1-6.7-9A3.9 3.9 0 0 1 10 5.8a3.9 3.9 0 0 1 6.7 2.4c0 4.9-6.7 9-6.7 9z" />
    </svg>
  )
}

export function IconVitall({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.2 8.3a5.8 5.8 0 0 1 9.9-3.9l1.4 1.4" />
      <path d="M12.5 3.6v2.3h-2.3" />
      <path d="M15.8 11.7a5.8 5.8 0 0 1-9.9 3.9l-1.4-1.4" />
      <path d="M7.5 16.4v-2.3h2.3" />
    </svg>
  )
}

export function IconCard({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="15" height="11" rx="2" />
      <path d="M2.5 8.5h15" />
      <path d="M5.5 12.5h3" />
    </svg>
  )
}

export function IconClock({ size = 17, color = 'var(--wine)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10.5" r="7.3" />
      <path d="M10 6.5v4l2.8 1.8" />
    </svg>
  )
}

export function IconBars({ size = 17, color = 'var(--wine)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round">
      <path d="M4 16V11M10 16V5M16 16V9" />
    </svg>
  )
}

export function IconSalary({ size = 17, color = 'var(--wine)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.5v15" />
      <path d="M13.5 5.8c0-1.5-1.6-2.3-3.5-2.3S6.5 4.4 6.5 6c0 3.2 7 1.6 7 4.9 0 1.7-1.6 2.6-3.5 2.6s-3.7-.9-3.7-2.4" />
    </svg>
  )
}

export function IconWarning({ size = 16, color = 'var(--red)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3 2.5 16.5h15L10 3z" />
      <path d="M10 8.3v3.5" />
      <circle cx="10" cy="14" r=".2" />
    </svg>
  )
}

export function IconTrendDown({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 6v8M6.5 10.5 10 14l3.5-3.5" />
    </svg>
  )
}

export function IconTrendUp({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14V6M6.5 9.5 10 6l3.5 3.5" />
    </svg>
  )
}
