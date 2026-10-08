import DocumentoLegal from '../../components/DocumentoLegal'
import EncabezadoSub from '../../components/EncabezadoSub'
import { DOCUMENTOS } from '../../lib/legal'

// Términos y condiciones / Política de privacidad, dentro de Perfil y con el tema.
export default function Legal({ id }) {
  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div data-guia="documento" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <EncabezadoSub titulo={DOCUMENTOS[id].titulo} />
        <DocumentoLegal id={id} />
      </div>
    </div>
  )
}
