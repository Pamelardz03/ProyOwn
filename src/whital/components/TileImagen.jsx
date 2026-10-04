import { useState } from 'react'
import { IconProduct } from '../../components/Icons'

// Imagen de un Whimm (cuadro redondeado); si no hay o no carga, el ícono de siempre.
export default function TileImagen({ url, size = 38, radius = 10, icono = 17, alt = '' }) {
  const [fallo, setFallo] = useState(false)
  const conImagen = !!url && !fallo
  return (
    <div className="icon-tile" style={{ width: size, height: size, borderRadius: radius, background: conImagen ? '#fff' : undefined, overflow: 'hidden' }}>
      {conImagen ? (
        <img src={url} alt={alt} onError={() => setFallo(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      ) : (
        <IconProduct size={icono} />
      )}
    </div>
  )
}
