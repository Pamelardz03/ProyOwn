import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AYUDA } from '../lib/ayuda'
import { useGuia } from '../hooks/useGuia'
import { GUIAS } from '../lib/guias'
import EnPantalla from './EnPantalla'
import GuiaAnimada from './GuiaAnimada'
import Modal from './Modal'

// Todos los pasos se muestran siempre: si la pantalla está vacía, muestra un ejemplo falso durante la guía.
const pasosDisponibles = (ruta) => GUIAS[ruta] || []

// Botón "?" fijo arriba a la derecha: abre la guía animada de la pantalla (siempre que se toca).
// Las pantallas sin guía abren la ayuda corta.
export default function AyudaPantalla() {
  const { pathname } = useLocation()
  const [abierta, setAbierta] = useState(false)
  const [guia, setGuia] = useState(null) // { ruta, pasos }
  const { setActiva } = useGuia()
  const ayuda = AYUDA[pathname]
  if (!ayuda) return null

  const iniciarGuia = () => {
    const pasos = pasosDisponibles(pathname)
    if (!pasos.length) return false
    setAbierta(false)
    setGuia({ ruta: pathname, pasos })
    setActiva(true)
    return true
  }
  const abrir = () => {
    if (!iniciarGuia()) setAbierta(true)
  }

  return (
    <>
      <EnPantalla>
        <button aria-label="Ayuda de esta pantalla" onClick={abrir} className="btn-ayuda">
          ?
        </button>
      </EnPantalla>
      {guia && guia.ruta === pathname && <GuiaAnimada pasos={guia.pasos} onTerminar={() => { setGuia(null); setActiva(false) }} />}
      <Modal
        abierto={abierta}
        onClose={() => setAbierta(false)}
        pie={
          <>
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
