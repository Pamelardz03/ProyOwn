import { useEffect, useMemo, useRef, useState } from 'react'
import { recortarFoto } from '../lib/imagenes'
import Modal from './Modal'

const MARCO = 260 // lado del cuadro en pantalla (px); el Whimm muestra su foto en un cuadro igual

const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// Ajusta una foto antes de guardarla: se ve en un cuadro del tamaño del Whimm, con una
// cuadrícula encima. Se mueve con el dedo, se agranda con pellizco o con la barra, y lo que
// la foto no cubra queda en blanco.
export default function AjustarFoto({ archivo, onCancelar, onListo }) {
  const [dim, setDim] = useState(null) // { w, h } reales de la foto
  const [t, setT] = useState({ s: 1, x: 0, y: 0 }) // escala y posición de la foto dentro del cuadro
  const [trabajando, setTrabajando] = useState(false)
  const punteros = useRef(new Map())
  const gesto = useRef(null)

  const url = useMemo(() => URL.createObjectURL(archivo), [archivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const limites = (w, h) => ({ min: Math.min(MARCO / w, MARCO / h) * 0.4, max: Math.max(MARCO / w, MARCO / h) * 4 })
  const acomodar = (nuevo) => {
    if (!dim) return nuevo
    const { min, max } = limites(dim.w, dim.h)
    const s = Math.min(max, Math.max(min, nuevo.s))
    // la foto nunca sale por completo del cuadro: siempre se queda un pedazo a la vista
    const ancho = dim.w * s
    const alto = dim.h * s
    return { s, x: Math.min(MARCO - 40, Math.max(40 - ancho, nuevo.x)), y: Math.min(MARCO - 40, Math.max(40 - alto, nuevo.y)) }
  }

  const alAncho = () => dim && setT({ s: MARCO / dim.w, x: 0, y: (MARCO - dim.h * (MARCO / dim.w)) / 2 })
  const alAlto = () => dim && setT({ s: MARCO / dim.h, x: (MARCO - dim.w * (MARCO / dim.h)) / 2, y: 0 })
  const llenar = () => {
    if (!dim) return
    const s = MARCO / Math.min(dim.w, dim.h)
    setT({ s, x: (MARCO - dim.w * s) / 2, y: (MARCO - dim.h * s) / 2 })
  }

  // Zoom con la barra: alrededor del centro del cuadro.
  const zoomCentro = (s) => {
    const c = MARCO / 2
    const px = (c - t.x) / t.s
    const py = (c - t.y) / t.s
    setT(acomodar({ s, x: c - px * s, y: c - py * s }))
  }

  const empezar = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = e.currentTarget.getBoundingClientRect()
    punteros.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
    reiniciarGesto()
  }
  const reiniciarGesto = () => {
    const ps = [...punteros.current.values()]
    if (ps.length === 1) gesto.current = { tipo: 'mover', p0: ps[0], t0: t }
    else if (ps.length >= 2) gesto.current = { tipo: 'pellizco', d0: distancia(ps[0], ps[1]) || 1, m0: { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 }, t0: t }
    else gesto.current = null
  }
  const mover = (e) => {
    if (!punteros.current.has(e.pointerId) || !gesto.current) return
    const r = e.currentTarget.getBoundingClientRect()
    punteros.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
    const ps = [...punteros.current.values()]
    const g = gesto.current
    if (g.tipo === 'mover' && ps.length === 1) {
      setT(acomodar({ ...g.t0, x: g.t0.x + ps[0].x - g.p0.x, y: g.t0.y + ps[0].y - g.p0.y }))
    } else if (g.tipo === 'pellizco' && ps.length >= 2) {
      const s = g.t0.s * (distancia(ps[0], ps[1]) / g.d0)
      const m = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 }
      const px = (g.m0.x - g.t0.x) / g.t0.s // punto de la foto que estaba bajo los dedos
      const py = (g.m0.y - g.t0.y) / g.t0.s
      setT(acomodar({ s, x: m.x - px * s, y: m.y - py * s }))
    }
  }
  const terminar = (e) => {
    punteros.current.delete(e.pointerId)
    reiniciarGesto()
  }

  const usar = async () => {
    setTrabajando(true)
    try {
      const blob = await recortarFoto(archivo, { s: t.s, x: t.x, y: t.y, marco: MARCO, anchoReal: dim.w })
      onListo(blob)
    } catch {
      setTrabajando(false)
    }
  }

  const lim = dim ? limites(dim.w, dim.h) : { min: 0.1, max: 1 }
  const valorBarra = dim ? (100 * Math.log(t.s / lim.min)) / Math.log(lim.max / lim.min) : 0
  const linea = { position: 'absolute', background: 'rgba(0,0,0,.2)', pointerEvents: 'none' }
  const pill = { background: 'var(--beige2)', color: 'var(--acento)' }

  return (
    <Modal
      abierto
      onClose={() => !trabajando && onCancelar()}
      nivel={3}
      pie={(
        <>
          <button className="segbtn" style={{ background: 'var(--beige2)', color: 'var(--muted)' }} disabled={trabajando} onClick={onCancelar}>Cancelar</button>
          <button className="segbtn" style={{ background: 'var(--wine)', color: '#fff', opacity: dim && !trabajando ? 1 : 0.45 }} disabled={!dim || trabajando} onClick={usar}>{trabajando ? 'Preparando…' : 'Usar foto'}</button>
        </>
      )}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Ajusta la foto</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.4 }}>Muévela y agrándala. Lo que no cubra la foto queda en blanco.</div>

      <div
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        style={{ position: 'relative', width: MARCO, height: MARCO, margin: '0 auto', background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--beige3)', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
      >
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const w = e.currentTarget.naturalWidth
              const h = e.currentTarget.naturalHeight
              setDim({ w, h })
              setT({ s: MARCO / w, x: 0, y: (MARCO - h * (MARCO / w)) / 2 }) // empieza ajustada al ancho
            }}
            style={{ position: 'absolute', left: 0, top: 0, width: dim ? dim.w * t.s : 'auto', height: dim ? dim.h * t.s : 'auto', maxWidth: 'none', transform: `translate(${t.x}px, ${t.y}px)`, pointerEvents: 'none', visibility: dim ? 'visible' : 'hidden' }}
          />
        )}
        {/* cuadrícula de tercios */}
        <div style={{ ...linea, left: '33.33%', top: 0, bottom: 0, width: 1 }} />
        <div style={{ ...linea, left: '66.66%', top: 0, bottom: 0, width: 1 }} />
        <div style={{ ...linea, top: '33.33%', left: 0, right: 0, height: 1 }} />
        <div style={{ ...linea, top: '66.66%', left: 0, right: 0, height: 1 }} />
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
        <button type="button" className="pill" style={pill} onClick={alAncho}>Al ancho</button>
        <button type="button" className="pill" style={pill} onClick={alAlto}>Al alto</button>
        <button type="button" className="pill" style={pill} onClick={llenar}>Llenar</button>
      </div>
      <input
        type="range"
        aria-label="Tamaño de la foto"
        min={0}
        max={100}
        step={0.5}
        value={valorBarra}
        disabled={!dim}
        onChange={(e) => zoomCentro(lim.min * Math.pow(lim.max / lim.min, Number(e.target.value) / 100))}
        style={{ width: '100%', marginTop: 12, accentColor: 'var(--wine)' }}
      />
    </Modal>
  )
}
