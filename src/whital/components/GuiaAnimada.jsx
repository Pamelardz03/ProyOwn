import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Guía animada: oscurece la pantalla, deja iluminado el elemento del paso, muestra el gesto
// (tocar / deslizar) sobre él y una card que explica qué hace. `pasos` ya viene filtrado
// (solo con elementos que existen). `onTerminar` se llama al acabar o al saltar.
export default function GuiaAnimada({ pasos, onTerminar }) {
  const [i, setI] = useState(0)
  const [caja, setCaja] = useState(null)
  const paso = pasos[i]
  const ultimo = i === pasos.length - 1

  useLayoutEffect(() => {
    const medir = () => {
      const el = document.querySelector(paso.selector)
      const shell = document.querySelector('.app-shell')
      if (!shell) return
      if (!el) {
        // Sin elemento que resaltar (no debería pasar: las pantallas muestran un ejemplo): solo se explica.
        setCaja({ sinFoco: true, alto: shell.getBoundingClientRect().height })
        return
      }
      // Dentro de la pantalla con scroll, se centra el elemento a mano (scrollIntoView movería también el contenedor).
      const pantalla = el.closest('.screen')
      if (pantalla) {
        const r0 = el.getBoundingClientRect()
        const p0 = pantalla.getBoundingClientRect()
        pantalla.scrollTop += r0.top + r0.height / 2 - (p0.top + p0.height / 2)
      }
      const r = el.getBoundingClientRect()
      const s = shell.getBoundingClientRect()
      setCaja({ x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, alto: s.height })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [paso])

  const destino = typeof document !== 'undefined' ? document.querySelector('.app-shell') || document.body : null
  if (!caja || !destino) return null

  const ALTO_CARD = 190
  const debajo = !caja.sinFoco && caja.alto - (caja.y + caja.h) >= ALTO_CARD
  const arriba = !caja.sinFoco && caja.y >= ALTO_CARD
  const posCard = debajo ? { top: caja.y + caja.h + 18 } : arriba ? { bottom: caja.alto - caja.y + 18 } : { bottom: 16 }

  return createPortal(
    <div className="guia-capa">
      {caja.sinFoco ? <div className="guia-oscuro" /> : <div className="guia-foco" style={{ left: caja.x - 6, top: caja.y - 6, width: caja.w + 12, height: caja.h + 12 }} />}
      {!caja.sinFoco && paso.gesto !== 'mirar' && (
        <div className={`guia-gesto guia-${paso.gesto}`} style={{ left: caja.x + caja.w / 2, top: caja.y + caja.h / 2 }}>
          <span className="guia-ola" />
          <span className="guia-dedo" />
        </div>
      )}
      <div className="card-solid guia-card" style={{ ...posCard, zIndex: 2 }}>
        <div className="eyebrow">{i + 1} de {pasos.length}</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{paso.titulo}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45, marginTop: 4 }}>{paso.texto}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <button style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 4px' }} onClick={onTerminar}>Saltar</button>
          <button className="pill" style={{ background: 'var(--wine)', color: '#fff', padding: '9px 20px', fontSize: 13 }} onClick={() => (ultimo ? onTerminar() : setI(i + 1))}>
            {ultimo ? 'Listo' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>,
    destino
  )
}
