import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AYUDA } from '../lib/ayuda'
import { GUIAS } from '../lib/guias'
import GuiaAnimada from './GuiaAnimada'
import Modal from './Modal'

const clave = (ruta) => `whital:guia:${ruta}`
const yaVista = (ruta) => {
  try {
    return !!localStorage.getItem(clave(ruta))
  } catch {
    return false
  }
}
const marcarVista = (ruta) => {
  try {
    localStorage.setItem(clave(ruta), '1')
  } catch {
    /* sin almacenamiento: la guía se vuelve a ofrecer */
  }
}
// Solo los pasos cuyo elemento existe ahora mismo en la pantalla.
const pasosDisponibles = (ruta) => (GUIAS[ruta] || []).filter((p) => document.querySelector(p.selector))

// Botón "?" fijo arriba a la derecha. La primera vez en cada pantalla abre la guía animada;
// después abre la ayuda corta (con opción de volver a ver la guía).
export default function AyudaPantalla() {
  const { pathname } = useLocation()
  const [abierta, setAbierta] = useState(false)
  const [guia, setGuia] = useState(null) // { ruta, pasos }
  const ayuda = AYUDA[pathname]
  if (!ayuda) return null

  const iniciarGuia = () => {
    const pasos = pasosDisponibles(pathname)
    if (!pasos.length) return false
    marcarVista(pathname)
    setAbierta(false)
    setGuia({ ruta: pathname, pasos })
    return true
  }
  const abrir = () => {
    if (!yaVista(pathname) && iniciarGuia()) return
    setAbierta(true)
  }

  return (
    <>
      <button
        aria-label="Ayuda de esta pantalla"
        onClick={abrir}
        className="btn-ayuda"
      >
        ?
      </button>
      {guia && guia.ruta === pathname && <GuiaAnimada pasos={guia.pasos} onTerminar={() => setGuia(null)} />}
      <Modal
        abierto={abierta}
        onClose={() => setAbierta(false)}
        pie={
          <>
            {GUIAS[pathname] && <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} onClick={iniciarGuia}>Ver guía</button>}
            <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff' }} onClick={() => setAbierta(false)}>Entendido</button>
          </>
        }
      >
        <div className="eyebrow" style={{ marginBottom: 10 }}>{ayuda.titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ayuda.puntos.map((p) => <div key={p} style={{ fontSize: 14, lineHeight: 1.4 }}>{p}</div>)}
        </div>
      </Modal>
    </>
  )
}
