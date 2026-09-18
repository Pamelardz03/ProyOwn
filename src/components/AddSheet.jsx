import { useState } from 'react'
import { IconPlus, IconClose, IconChevronLeft, IconReceipt, IconHeart, IconVitall, IconCard } from './Icons'
import Toggle from './Toggle'

const FREQS = ['Semanal', 'Quincenal', 'Mensual']

// Botón "+" flotante + hoja inferior para agregar Gasto / Whimm / Vitall / Pago fijo.
// Reutilizado en Inicio, Gastos, Compras, Calendario y Perfil — igual que en el mockup.
// Por ahora guarda solo localmente (toast de confirmación); la Fase que corresponda
// del roadmap conecta cada guardado a Firestore.
export default function AddSheet({ onToast, cats, onAddCat }) {
  const [step, setStep] = useState('closed') // closed | picker | gasto | objeto | servicio | pago
  const [catSel, setCatSel] = useState(cats?.[0] ?? 'Accesorios')
  const [newCatOpen, setNewCatOpen] = useState(false)
  const [freq, setFreq] = useState('Mensual')
  const [necesarioSel, setNecesarioSel] = useState(true)

  const close = () => setStep('closed')
  const open = () => setStep(step === 'closed' ? 'picker' : 'closed')

  function save(kind, msg) {
    setStep('closed')
    onToast?.(msg)
  }

  const categorias = cats && cats.length ? cats : ['Accesorios', 'Skin care', 'Makeup']

  return (
    <>
      <button aria-label="Agregar" onClick={open} className="fab">
        <IconPlus />
      </button>

      {step !== 'closed' && (
        <>
          <div className="sheet-backdrop" onClick={close} />
          <div className="sheet">
            <div className="sheet-grabber"><span /></div>
            <div className="sheet-body">
              {step === 'picker' && (
                <>
                  <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 14px' }}>¿Qué quieres agregar?</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button className="pick-option" onClick={() => setStep('gasto')}>
                      <span className="icon"><IconReceipt /></span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Gasto</span>
                    </button>
                    <button className="pick-option" onClick={() => setStep('objeto')}>
                      <span className="icon"><IconHeart /></span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Whimm</span>
                    </button>
                    <button className="pick-option" onClick={() => setStep('servicio')}>
                      <span className="icon"><IconVitall /></span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Vitall</span>
                    </button>
                    <button className="pick-option" onClick={() => setStep('pago')}>
                      <span className="icon"><IconCard /></span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Pago fijo</span>
                    </button>
                  </div>
                </>
              )}

              {step === 'gasto' && (
                <>
                  <SheetHeader title="Nuevo gasto" onBack={() => setStep('picker')} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="fld" placeholder="Concepto" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="fld" placeholder="Monto" inputMode="decimal" />
                      <input className="fld" placeholder="Lugar" />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="pill"
                        style={{ flex: 1, background: necesarioSel ? 'var(--wine)' : 'var(--card)', color: necesarioSel ? '#fff' : 'var(--muted)', border: necesarioSel ? 'none' : '1px solid var(--beige3)' }}
                        onClick={() => setNecesarioSel(true)}
                      >
                        Necesario
                      </button>
                      <button
                        className="pill"
                        style={{ flex: 1, background: !necesarioSel ? 'var(--wine)' : 'var(--card)', color: !necesarioSel ? '#fff' : 'var(--muted)', border: !necesarioSel ? 'none' : '1px solid var(--beige3)' }}
                        onClick={() => setNecesarioSel(false)}
                      >
                        Shopping
                      </button>
                    </div>
                    <ToggleRow label="Recurrente" />
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => save('gasto', 'Gasto guardado')}>
                    Guardar gasto
                  </button>
                </>
              )}

              {step === 'objeto' && (
                <>
                  <SheetHeader title="Nuevo Whimm" onBack={() => setStep('picker')} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="fld" placeholder="Nombre del producto" />
                    <div>
                      <div className="chiprow">
                        {categorias.map((c) => (
                          <span
                            key={c}
                            onClick={() => setCatSel(c)}
                            className="pill"
                            style={{ background: catSel === c ? 'var(--wine)' : '#fff', color: catSel === c ? '#fff' : 'var(--muted)', border: `1px solid ${catSel === c ? 'var(--wine)' : 'var(--beige3)'}` }}
                          >
                            {c}
                          </span>
                        ))}
                        <button aria-label="Nueva categoría" onClick={() => setNewCatOpen((v) => !v)} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 14, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconPlus size={13} color="var(--wine)" />
                        </button>
                      </div>
                      {newCatOpen && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <input className="fld" style={{ flex: 1 }} placeholder="Nombre de la categoría" id="new-cat-input" />
                          <button
                            style={{ background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '0 14px', fontSize: 12, fontWeight: 600 }}
                            onClick={() => {
                              const el = document.getElementById('new-cat-input')
                              const name = el?.value?.trim()
                              if (name) {
                                onAddCat?.(name)
                                setCatSel(name)
                              }
                              setNewCatOpen(false)
                              onToast?.('Categoría creada')
                            }}
                          >
                            Crear
                          </button>
                        </div>
                      )}
                    </div>
                    <input className="fld" placeholder="Precio" inputMode="decimal" />
                    <input className="fld" placeholder="Lugar de compra" />
                    <input className="fld" placeholder="Link de dónde lo encontré" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="pill" style={{ flex: 1, textAlign: 'center', background: 'var(--wine)', color: '#fff' }}>En espera</span>
                      <span className="pill" style={{ flex: 1, textAlign: 'center', background: 'var(--card)', border: '1px solid var(--beige3)', color: 'var(--muted)' }}>Apartando fondos</span>
                    </div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => save('objeto', 'Whimm guardado')}>
                    Guardar Whimm
                  </button>
                </>
              )}

              {step === 'servicio' && (
                <>
                  <SheetHeader title="Nuevo Vitall" onBack={() => setStep('picker')} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="fld" placeholder="Nombre del servicio" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="fld" style={{ flex: 1 }} placeholder="Costo" inputMode="decimal" />
                      <input className="fld" style={{ flex: 1 }} placeholder="Frecuencia" />
                    </div>
                    <ToggleRow label="Activo" defaultOn />
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 6 }}>
                      Notificaciones
                    </div>
                    <ToggleRow label="Recordatorio formal" hint="2 días antes" defaultOn />
                    <ToggleRow label="Recordatorio mini" hint="Diario, desde que se activa hasta el día de pago" defaultOn />
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => save('servicio', 'Vitall guardado')}>
                    Guardar Vitall
                  </button>
                </>
              )}

              {step === 'pago' && (
                <>
                  <SheetHeader title="Nuevo pago fijo" onBack={() => setStep('picker')} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="fld" placeholder="Nombre (ej. Netflix)" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="fld" style={{ flex: 1 }} placeholder="Monto" inputMode="decimal" />
                      <input className="fld" style={{ flex: 1 }} placeholder="Tipo" />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                      Frecuencia
                    </div>
                    <div className="chiprow">
                      {FREQS.map((f) => (
                        <span
                          key={f}
                          onClick={() => setFreq(f)}
                          className="pill"
                          style={{ background: freq === f ? 'var(--wine)' : '#fff', color: freq === f ? '#fff' : 'var(--muted)', border: `1px solid ${freq === f ? 'var(--wine)' : 'var(--beige3)'}` }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => save('pago', 'Pago fijo guardado')}>
                    Guardar pago fijo
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function SheetHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 14px' }}>
      <button aria-label="Atrás" onClick={onBack}>
        <IconChevronLeft />
      </button>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
    </div>
  )
}

function ToggleRow({ label, hint, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--beige2)', borderRadius: 10, padding: '11px 12px' }}>
      <div>
        <div style={{ fontSize: hint ? 12 : 12, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>}
      </div>
      <Toggle on={on} onClick={() => setOn((v) => !v)} ariaLabel={label} />
    </div>
  )
}

// Botón para cerrar el picker desde fuera, si algún día hace falta.
export { IconClose }
