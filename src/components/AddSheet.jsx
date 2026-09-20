import { useState } from 'react'
import { IconPlus, IconClose, IconChevronLeft, IconReceipt, IconHeart, IconVitall, IconCard } from './Icons'
import Toggle from './Toggle'
import { useAuth } from '../lib/AuthContext'
import { addUserDoc } from '../lib/firestoreCollections'
import { todayISO } from '../lib/date'
import { computeWhimmScore } from '../lib/score'

const FREQS = ['Semanal', 'Quincenal', 'Mensual']
const TIPOS_PAGO = ['Vitall', 'Vivienda', 'Transporte', 'Deuda']
const GASTO_TIPOS = ['Necesario', 'Shopping', 'Whimm']

function errMsg(err) {
  return `${err?.code ? `(${err.code}) ` : ''}${err?.message || 'Error desconocido'}`
}

const emptyGasto = { concepto: '', monto: '', lugar: '' }
const emptyObjeto = { nombre: '', precio: '', lugar: '', imagenUrl: '' }
const emptyServicio = { nombre: '', costo: '' }
const emptyPago = { nombre: '', monto: '' }

// Botón "+" flotante + hoja inferior para agregar Gasto / Whimm / Vitall / Pago fijo.
// Reutilizado en Inicio, Gastos, Compras, Calendario y Perfil — igual que en el mockup.
// Guarda de verdad en Firestore: /users/{uid}/gastos, /whimms y /pagosFijos
// (Vitall y Pago fijo son el mismo tipo de dato — pagosFijos — con distinto
// punto de entrada; Vitall preselecciona tipo="Vitall").
export default function AddSheet({ onToast, cats }) {
  const { user } = useAuth()
  const [step, setStep] = useState('closed') // closed | picker | gasto | objeto | servicio | pago
  const [saving, setSaving] = useState(false)

  const categorias = cats && cats.length ? cats : ['Accesorios', 'Skin care', 'Maquillaje']

  const [gastoForm, setGastoForm] = useState(emptyGasto)
  const [gastoTipo, setGastoTipo] = useState('Necesario')
  const [gastoCatSel, setGastoCatSel] = useState(categorias[0])
  const [extraCats, setExtraCats] = useState([])
  const [gastoNewCatOpen, setGastoNewCatOpen] = useState(false)
  const [gastoNewCatValue, setGastoNewCatValue] = useState('')

  const allCats = [...categorias, ...extraCats.filter((c) => !categorias.includes(c))]

  const [objetoForm, setObjetoForm] = useState(emptyObjeto)
  const [catSel, setCatSel] = useState(cats?.[0] ?? 'Accesorios')
  const [newCatOpen, setNewCatOpen] = useState(false)
  const [newCatValue, setNewCatValue] = useState('')
  const [estadoSel, setEstadoSel] = useState('espera')
  const [linksList, setLinksList] = useState([''])
  const [necesidadSel, setNecesidadSel] = useState(3)
  const [deseoSel, setDeseoSel] = useState(3)
  const [montoApartado, setMontoApartado] = useState('')
  const [objNotifFormal, setObjNotifFormal] = useState(true)
  const [objNotifMini, setObjNotifMini] = useState(true)

  const [servicioForm, setServicioForm] = useState(emptyServicio)
  const [servicioFreq, setServicioFreq] = useState('Mensual')
  const [servicioFecha, setServicioFecha] = useState(todayISO())
  const [notifFormal, setNotifFormal] = useState(true)
  const [notifMini, setNotifMini] = useState(true)

  const [pagoForm, setPagoForm] = useState(emptyPago)
  const [pagoFecha, setPagoFecha] = useState(todayISO())
  const [pagoTipo, setPagoTipo] = useState('Vitall')
  const [pagoFreq, setPagoFreq] = useState('Mensual')
  const [pagoFinito, setPagoFinito] = useState(false)
  const [pagoNumPagos, setPagoNumPagos] = useState('')

  const close = () => setStep('closed')
  const open = () => setStep(step === 'closed' ? 'picker' : 'closed')

  function updateLink(idx, value) {
    setLinksList((prev) => prev.map((l, i) => (i === idx ? value : l)))
  }
  function addLinkRow() {
    setLinksList((prev) => [...prev, ''])
  }
  function removeLinkRow(idx) {
    setLinksList((prev) => prev.filter((_, i) => i !== idx))
  }

  async function saveGasto() {
    const monto = Number(gastoForm.monto)
    if (!gastoForm.concepto.trim() || !monto) return
    if (gastoTipo === 'Whimm' && !gastoCatSel) return
    setSaving(true)
    try {
      await addUserDoc(user.uid, 'gastos', {
        concepto: gastoForm.concepto.trim(),
        monto,
        lugar: gastoForm.lugar.trim(),
        categoria: gastoTipo,
        categoriaWhimm: gastoTipo === 'Whimm' ? gastoCatSel : '',
        fecha: todayISO(),
      })
      setGastoForm(emptyGasto)
      setGastoTipo('Necesario')
      setStep('closed')
      onToast?.('Gasto guardado')
    } catch (err) {
      console.error(err)
      onToast?.(`No se pudo guardar: ${errMsg(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function saveObjeto() {
    const precio = Number(objetoForm.precio)
    if (!objetoForm.nombre.trim() || !precio) return
    setSaving(true)
    try {
      const links = linksList.map((l) => l.trim()).filter(Boolean)
      const score = computeWhimmScore({ necesidad: necesidadSel, deseo: deseoSel, precio })
      await addUserDoc(user.uid, 'whimms', {
        name: objetoForm.nombre.trim(),
        categoria: catSel,
        precio,
        lugar: objetoForm.lugar.trim(),
        imagenUrl: objetoForm.imagenUrl.trim(),
        links,
        link: links[0] || '',
        necesidad: necesidadSel,
        deseo: deseoSel,
        score,
        estado: estadoSel,
        montoApartado: estadoSel === 'apartando' ? (Number(montoApartado) || 0) : 0,
        notifFormal: objNotifFormal,
        notifMini: objNotifMini,
      })
      setObjetoForm(emptyObjeto)
      setEstadoSel('espera')
      setLinksList([''])
      setNecesidadSel(3)
      setDeseoSel(3)
      setMontoApartado('')
      setObjNotifFormal(true)
      setObjNotifMini(true)
      setStep('closed')
      onToast?.('Whimm guardado')
    } catch (err) {
      console.error(err)
      onToast?.(`No se pudo guardar: ${errMsg(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function saveServicio() {
    const monto = Number(servicioForm.costo)
    if (!servicioForm.nombre.trim() || !monto) return
    setSaving(true)
    try {
      await addUserDoc(user.uid, 'pagosFijos', {
        name: servicioForm.nombre.trim(),
        monto,
        frecuencia: servicioFreq,
        tipo: 'Vitall',
        activo: true,
        fecha: servicioFecha,
        finito: false,
        numPagos: null,
        notifFormal,
        notifMini,
      })
      setServicioForm(emptyServicio)
      setServicioFreq('Mensual')
      setServicioFecha(todayISO())
      setStep('closed')
      onToast?.('Vitall guardado')
    } catch (err) {
      console.error(err)
      onToast?.(`No se pudo guardar: ${errMsg(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function savePago() {
    const monto = Number(pagoForm.monto)
    if (!pagoForm.nombre.trim() || !monto) return
    setSaving(true)
    try {
      await addUserDoc(user.uid, 'pagosFijos', {
        name: pagoForm.nombre.trim(),
        monto,
        frecuencia: pagoFreq,
        tipo: pagoTipo,
        activo: true,
        fecha: pagoFecha,
        finito: pagoFinito,
        numPagos: pagoFinito ? Number(pagoNumPagos) || null : null,
      })
      setPagoForm(emptyPago)
      setPagoFecha(todayISO())
      setPagoTipo('Vitall')
      setPagoFreq('Mensual')
      setPagoFinito(false)
      setPagoNumPagos('')
      setStep('closed')
      onToast?.('Pago fijo guardado')
    } catch (err) {
      console.error(err)
      onToast?.(`No se pudo guardar: ${errMsg(err)}`)
    } finally {
      setSaving(false)
    }
  }

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
                      <span className="icon"><IconReceipt color="#fff" /></span>
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
                    <input
                      className="fld"
                      placeholder="Concepto"
                      value={gastoForm.concepto}
                      onChange={(e) => setGastoForm((f) => ({ ...f, concepto: e.target.value }))}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="fld"
                        placeholder="Monto"
                        inputMode="decimal"
                        value={gastoForm.monto}
                        onChange={(e) => setGastoForm((f) => ({ ...f, monto: e.target.value }))}
                      />
                      <input
                        className="fld"
                        placeholder="Lugar (opcional)"
                        value={gastoForm.lugar}
                        onChange={(e) => setGastoForm((f) => ({ ...f, lugar: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {GASTO_TIPOS.map((t) => (
                        <button
                          key={t}
                          className="pill"
                          style={{ flex: 1, background: gastoTipo === t ? 'var(--wine)' : 'var(--card)', color: gastoTipo === t ? '#fff' : 'var(--muted)', border: gastoTipo === t ? 'none' : '1px solid var(--beige3)' }}
                          onClick={() => setGastoTipo(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {gastoTipo === 'Whimm' && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                          Categoría
                        </div>
                        <div className="chiprow">
                          {allCats.map((c) => (
                            <span
                              key={c}
                              onClick={() => setGastoCatSel(c)}
                              className="pill"
                              style={{ background: gastoCatSel === c ? 'var(--wine)' : '#fff', color: gastoCatSel === c ? '#fff' : 'var(--muted)', border: `1px solid ${gastoCatSel === c ? 'var(--wine)' : 'var(--beige3)'}` }}
                            >
                              {c}
                            </span>
                          ))}
                          <button aria-label="Nueva categoría" onClick={() => setGastoNewCatOpen((v) => !v)} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 14, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconPlus size={13} color="var(--wine)" />
                          </button>
                        </div>
                        {gastoNewCatOpen && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <input
                              className="fld"
                              style={{ flex: 1 }}
                              placeholder="Nombre de la categoría"
                              value={gastoNewCatValue}
                              onChange={(e) => setGastoNewCatValue(e.target.value)}
                            />
                            <button
                              style={{ background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '0 14px', fontSize: 12, fontWeight: 600 }}
                              onClick={() => {
                                const name = gastoNewCatValue.trim()
                                if (name) {
                                  setExtraCats((prev) => [...new Set([...prev, name])])
                                  setGastoCatSel(name)
                                }
                                setGastoNewCatValue('')
                                setGastoNewCatOpen(false)
                              }}
                            >
                              Crear
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14, opacity: saving ? 0.7 : 1 }} onClick={saveGasto} disabled={saving}>
                    Guardar gasto
                  </button>
                </>
              )}

              {step === 'objeto' && (
                <>
                  <SheetHeader title="Nuevo Whimm" onBack={() => setStep('picker')} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      className="fld"
                      placeholder="Nombre del producto"
                      value={objetoForm.nombre}
                      onChange={(e) => setObjetoForm((f) => ({ ...f, nombre: e.target.value }))}
                    />
                    <div>
                      <div className="chiprow">
                        {allCats.map((c) => (
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
                          <input
                            className="fld"
                            style={{ flex: 1 }}
                            placeholder="Nombre de la categoría"
                            value={newCatValue}
                            onChange={(e) => setNewCatValue(e.target.value)}
                          />
                          <button
                            style={{ background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '0 14px', fontSize: 12, fontWeight: 600 }}
                            onClick={() => {
                              const name = newCatValue.trim()
                              if (name) {
                                setExtraCats((prev) => [...new Set([...prev, name])])
                                setCatSel(name)
                              }
                              setNewCatValue('')
                              setNewCatOpen(false)
                            }}
                          >
                            Crear
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      className="fld"
                      placeholder="Precio"
                      inputMode="decimal"
                      value={objetoForm.precio}
                      onChange={(e) => setObjetoForm((f) => ({ ...f, precio: e.target.value }))}
                    />
                    <input
                      className="fld"
                      placeholder="Lugar de compra"
                      value={objetoForm.lugar}
                      onChange={(e) => setObjetoForm((f) => ({ ...f, lugar: e.target.value }))}
                    />
                    <input
                      className="fld"
                      placeholder="URL de imagen (pégala desde Google Imágenes u otro sitio)"
                      value={objetoForm.imagenUrl}
                      onChange={(e) => setObjetoForm((f) => ({ ...f, imagenUrl: e.target.value }))}
                    />
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                      Links donde lo encontré
                    </div>
                    {linksList.map((l, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="fld"
                          style={{ flex: 1 }}
                          placeholder="Link de dónde lo encontré"
                          value={l}
                          onChange={(e) => updateLink(idx, e.target.value)}
                        />
                        {linksList.length > 1 && (
                          <button aria-label="Quitar link" onClick={() => removeLinkRow(idx)} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <IconClose size={12} color="var(--muted)" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={addLinkRow} style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: 'var(--wine)' }}>
                      + Agregar otro link
                    </button>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                      Solo nombre y precio son obligatorios. El resto ayuda al análisis: si no ajustas necesidad y deseo, se toman como 3 por default.
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                      Necesidad
                    </div>
                    <ScalePicker value={necesidadSel} onChange={setNecesidadSel} />
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                      Deseo
                    </div>
                    <ScalePicker value={deseoSel} onChange={setDeseoSel} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <span
                        onClick={() => setEstadoSel('espera')}
                        className="pill"
                        style={{ flex: 1, textAlign: 'center', background: estadoSel === 'espera' ? 'var(--wine)' : 'var(--card)', color: estadoSel === 'espera' ? '#fff' : 'var(--muted)', border: estadoSel === 'espera' ? 'none' : '1px solid var(--beige3)' }}
                      >
                        En espera
                      </span>
                      <span
                        onClick={() => setEstadoSel('apartando')}
                        className="pill"
                        style={{ flex: 1, textAlign: 'center', background: estadoSel === 'apartando' ? 'var(--wine)' : 'var(--card)', color: estadoSel === 'apartando' ? '#fff' : 'var(--muted)', border: estadoSel === 'apartando' ? 'none' : '1px solid var(--beige3)' }}
                      >
                        Apartando fondos
                      </span>
                    </div>
                    {estadoSel === 'apartando' && (
                      <>
                        <input
                          className="fld"
                          placeholder="¿Cuánto ya llevas juntado?"
                          inputMode="decimal"
                          value={montoApartado}
                          onChange={(e) => setMontoApartado(e.target.value)}
                        />
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: -4 }}>
                          Este monto es dinero que ya tienes aparte (efectivo u otra cuenta) — no se toma de tu sueldo ni sueldo rápido.
                        </div>
                      </>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 6 }}>
                      Notificaciones
                    </div>
                    <ToggleRow label="Recordatorio formal" hint="2 días antes" on={objNotifFormal} onClick={() => setObjNotifFormal((v) => !v)} />
                    <ToggleRow label="Recordatorio mini" hint="Diario, desde que se activa hasta el día estimado" on={objNotifMini} onClick={() => setObjNotifMini((v) => !v)} />
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14, opacity: saving ? 0.7 : 1 }} onClick={saveObjeto} disabled={saving}>
                    Guardar Whimm
                  </button>
                </>
              )}

              {step === 'servicio' && (
                <>
                  <SheetHeader title="Nuevo Vitall" onBack={() => setStep('picker')} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      className="fld"
                      placeholder="Nombre del servicio"
                      value={servicioForm.nombre}
                      onChange={(e) => setServicioForm((f) => ({ ...f, nombre: e.target.value }))}
                    />
                    <input
                      className="fld"
                      placeholder="Costo"
                      inputMode="decimal"
                      value={servicioForm.costo}
                      onChange={(e) => setServicioForm((f) => ({ ...f, costo: e.target.value }))}
                    />
                    <div className="chiprow">
                      {FREQS.map((f) => (
                        <span
                          key={f}
                          onClick={() => setServicioFreq(f)}
                          className="pill"
                          style={{ background: servicioFreq === f ? 'var(--wine)' : '#fff', color: servicioFreq === f ? '#fff' : 'var(--muted)', border: `1px solid ${servicioFreq === f ? 'var(--wine)' : 'var(--beige3)'}` }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                      Próximo vencimiento
                    </div>
                    <input
                      className="fld"
                      type="date"
                      value={servicioFecha}
                      onChange={(e) => setServicioFecha(e.target.value)}
                    />
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      Un Vitall no tiene fecha de fin (servicio continuo) — si esta compra sí termina en algún momento, agrégala como "Pago fijo".
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 6 }}>
                      Notificaciones
                    </div>
                    <ToggleRow label="Recordatorio formal" hint="2 días antes" on={notifFormal} onClick={() => setNotifFormal((v) => !v)} />
                    <ToggleRow label="Recordatorio mini" hint="Diario, desde que se activa hasta el día de pago" on={notifMini} onClick={() => setNotifMini((v) => !v)} />
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14, opacity: saving ? 0.7 : 1 }} onClick={saveServicio} disabled={saving}>
                    Guardar Vitall
                  </button>
                </>
              )}

              {step === 'pago' && (
                <>
                  <SheetHeader title="Nuevo pago fijo" onBack={() => setStep('picker')} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      className="fld"
                      placeholder="Nombre (ej. Netflix)"
                      value={pagoForm.nombre}
                      onChange={(e) => setPagoForm((f) => ({ ...f, nombre: e.target.value }))}
                    />
                    <input
                      className="fld"
                      placeholder="Monto"
                      inputMode="decimal"
                      value={pagoForm.monto}
                      onChange={(e) => setPagoForm((f) => ({ ...f, monto: e.target.value }))}
                    />
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                      Tipo
                    </div>
                    <div className="chiprow">
                      {TIPOS_PAGO.map((t) => (
                        <span
                          key={t}
                          onClick={() => setPagoTipo(t)}
                          className="pill"
                          style={{ background: pagoTipo === t ? 'var(--wine)' : '#fff', color: pagoTipo === t ? '#fff' : 'var(--muted)', border: `1px solid ${pagoTipo === t ? 'var(--wine)' : 'var(--beige3)'}` }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                      Frecuencia
                    </div>
                    <div className="chiprow">
                      {FREQS.map((f) => (
                        <span
                          key={f}
                          onClick={() => setPagoFreq(f)}
                          className="pill"
                          style={{ background: pagoFreq === f ? 'var(--wine)' : '#fff', color: pagoFreq === f ? '#fff' : 'var(--muted)', border: `1px solid ${pagoFreq === f ? 'var(--wine)' : 'var(--beige3)'}` }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 2 }}>
                      Próximo vencimiento
                    </div>
                    <input
                      className="fld"
                      type="date"
                      value={pagoFecha}
                      onChange={(e) => setPagoFecha(e.target.value)}
                    />
                    <ToggleRow label="¿Tiene fin?" hint="ej. compra a meses sin intereses" on={pagoFinito} onClick={() => setPagoFinito((v) => !v)} />
                    {pagoFinito && (
                      <input
                        className="fld"
                        placeholder="Número de pagos (ej. 12)"
                        inputMode="numeric"
                        value={pagoNumPagos}
                        onChange={(e) => setPagoNumPagos(e.target.value)}
                      />
                    )}
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14, opacity: saving ? 0.7 : 1 }} onClick={savePago} disabled={saving}>
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

function ToggleRow({ label, hint, on, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--beige2)', borderRadius: 10, padding: '11px 12px' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>}
      </div>
      <Toggle on={on} onClick={onClick} ariaLabel={label} />
    </div>
  )
}

function ScalePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: value === n ? 'var(--wine)' : 'var(--card)', color: value === n ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: 700, border: value === n ? 'none' : '1px solid var(--beige3)' }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export { IconClose }
