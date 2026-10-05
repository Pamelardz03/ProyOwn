// Campo de texto con sugerencias DENTRO de la app (en vez del desplegable del navegador,
// que sale fuera del diseño): las categorías ya usadas aparecen como botones debajo.
export default function InputConSugerencias({ value, onChange, opciones }) {
  const q = value.trim().toLowerCase()
  const sugeridas = opciones.filter((o) => o.toLowerCase() !== q && (!q || o.toLowerCase().includes(q))).slice(0, 8)
  return (
    <>
      <input className="fld" value={value} onChange={(e) => onChange(e.target.value)} />
      {sugeridas.length > 0 && (
        <div className="chiprow" style={{ marginTop: 6 }}>
          {sugeridas.map((o) => (
            <button key={o} type="button" className="pill" style={{ background: 'var(--beige2)', color: 'var(--wine)', padding: '5px 10px', fontSize: 11 }} onClick={() => onChange(o)}>{o}</button>
          ))}
        </div>
      )}
    </>
  )
}
