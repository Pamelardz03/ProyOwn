// Pantalla temporal para las secciones de Whital que todavía no se construyen.
export default function Pendiente({ titulo, texto }) {
  return (
    <div className="screen">
      <div className="eyebrow">Whital</div>
      <h1>{titulo}</h1>
      <div className="empty-state">{texto}</div>
    </div>
  )
}
