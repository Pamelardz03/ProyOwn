import { useState } from 'react'
import { IconProduct } from '../../components/Icons'

// Imagen de un Whimm (cuadro redondeado, fondo blanco siempre). La foto se ajusta al ANCHO:
// si es más alta que el cuadro se recorta arriba y abajo; si es más baja, quedan franjas blancas.
// Si no hay foto o no carga, el ícono de siempre.
// `no-referrer` evita que algunas tiendas bloqueen la imagen por venir de otra página.
export default function TileImagen({ url, size = 38, radius = 10, icono = 17, alt = '' }) {
  const [fallo, setFallo] = useState(false)
  const conImagen = !!url && !fallo
  return (
    <div className="icon-tile" style={{ width: size, height: size, borderRadius: radius, background: conImagen ? '#fff' : undefined, overflow: 'hidden' }}>
      {conImagen ? (
        <img src={url} alt={alt} referrerPolicy="no-referrer" onError={() => setFallo(true)} style={{ width: '100%', height: 'auto', flexShrink: 0, display: 'block' }} />
      ) : (
        <IconProduct size={icono} />
      )}
    </div>
  )
}
