import { CONTACTO_URL, DOCUMENTOS } from '../lib/legal'

const negritas = (texto) => texto.split('**').map((t, i) => (i % 2 ? <strong key={i}>{t}</strong> : t))

// Documento legal con los colores del tema (Términos y condiciones / Política de privacidad).
export default function DocumentoLegal({ id }) {
  const doc = DOCUMENTOS[id]
  if (!doc) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="eyebrow">Whital · Última actualización: {doc.fecha}</div>
      {doc.bloques.map((b, i) => {
        if (b.h) return <div key={i} style={{ fontSize: 15, fontWeight: 600, marginTop: 10, color: 'var(--acento)' }}>{b.h}</div>
        if (b.p) return <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{negritas(b.p)}</div>
        if (b.ul) {
          return (
            <ul key={i} style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {b.ul.map((t) => <li key={t} style={{ fontSize: 13, lineHeight: 1.55 }}>{negritas(t)}</li>)}
            </ul>
          )
        }
        return (
          <a key={i} href={CONTACTO_URL} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--acento)', textDecoration: 'underline' }}>
            github.com/Pamelardz03/ProyOwn/issues
          </a>
        )
      })}
    </div>
  )
}
