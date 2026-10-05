import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconClose, IconEdit } from '../../components/Icons'
import { deleteUserDoc, updateUserDoc } from '../../lib/firestoreCollections'
import { diaSemanaCorto, fechaCorta, fmt } from '../lib/vista'
import BotonEliminar from './BotonEliminar'
import Campo from './Campo'
import Modal from './Modal'

const num = (v) => (v === '' || v == null ? 0 : Number(v))
const boton = { width: '100%', borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 600, textAlign: 'center' }

// Ventana del lápiz: lo que se puede hacer con ESA fecha (cambiar el monto,
// omitirla como dato atípico o restaurarla) y con TODA la serie (editarla o
// eliminarla).
function EditarOcurrencia({ coleccion, entidad, ocurrencia, nombre, user, show, hoy, onCerrar }) {
  const navigate = useNavigate()
  const exc = entidad.excepciones?.[ocurrencia.fecha] || {}
  const tieneMonto = exc.montoReal != null || exc.monto != null
  const [valor, setValor] = useState(String(ocurrencia.monto))

  const escribirExcepcion = async (nueva, mensaje) => {
    try {
      await updateUserDoc(user.uid, coleccion, entidad.id, { [`excepciones.${ocurrencia.fecha}`]: nueva })
      show(mensaje)
      onCerrar()
    } catch {
      show('No se pudo guardar')
    }
  }

  const editarSerie = () => {
    if (coleccion === 'pagosFijos') navigate('/vitalls', { state: { openPagoId: entidad.id } })
    else navigate('/perfil/sueldos', { state: { openSueldoId: entidad.id } })
  }

  const eliminarSerie = async () => {
    try {
      // Un pago a meses liga a su Whimm: al borrarlo el Whimm regresa a la fila.
      if (coleccion === 'pagosFijos' && entidad.whimmId) {
        await updateUserDoc(user.uid, 'whimms', entidad.whimmId, { estado: 'espera', pagoFijoMsiId: null, precioComprado: null })
      }
      await deleteUserDoc(user.uid, coleccion, entidad.id)
      show('Serie eliminada')
      onCerrar()
    } catch {
      show('No se pudo eliminar')
    }
  }

  return (
    <Modal abierto onClose={onCerrar} nivel={1}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{nombre || entidad.name || entidad.nombre}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{diaSemanaCorto(ocurrencia.fecha)} {fechaCorta(ocurrencia.fecha)}</div>
        </div>
        <button aria-label="Cerrar" onClick={onCerrar} style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--beige2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconClose />
        </button>
      </div>

      <div className="eyebrow" style={{ marginBottom: 8 }}>Esta fecha</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        <Campo label={`Monto${tieneMonto ? ` · base ${fmt(entidad.monto)}` : ''}`}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="fld" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            <button className="segbtn" style={{ flex: 'none', padding: '0 16px', background: 'var(--wine)', color: '#fff' }} onClick={() => escribirExcepcion({ omitida: !!exc.omitida, montoReal: num(valor) }, 'Monto actualizado')}>Guardar</button>
          </div>
        </Campo>
        {tieneMonto && <button style={{ alignSelf: 'flex-start', fontSize: 11, color: 'var(--acento)', fontWeight: 600, textDecoration: 'underline' }} onClick={() => escribirExcepcion({ omitida: !!exc.omitida }, 'Monto restablecido')}>Restablecer el monto base</button>}
        {coleccion === 'sueldosFijos' && !ocurrencia.omitida && ocurrencia.fecha <= hoy && (
          <button style={{ ...boton, background: 'var(--beige2)', color: 'var(--acento)' }} onClick={() => escribirExcepcion({ ...exc, omitida: true, pendiente: true }, 'Se sumará cuando llegue')}>Aún no llega</button>
        )}
        <button style={{ ...boton, background: ocurrencia.omitida ? 'var(--green-bg)' : 'var(--beige2)', color: ocurrencia.omitida ? 'var(--green)' : 'var(--wine)' }} onClick={() => escribirExcepcion({ ...exc, omitida: !ocurrencia.omitida, pendiente: false }, ocurrencia.omitida ? 'Fecha restaurada' : 'Fecha omitida')}>
          {ocurrencia.pendiente ? 'Ya llegó' : ocurrencia.omitida ? 'Restaurar esta fecha' : 'Omitir esta fecha (dato atípico)'}
        </button>
      </div>

      <div className="eyebrow" style={{ marginBottom: 8 }}>Toda la serie</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={{ ...boton, background: 'var(--beige2)', color: 'var(--acento)' }} onClick={editarSerie}>Editar serie</button>
      </div>
      <div style={{ marginTop: 8 }}>
        <BotonEliminar mensaje="¿Eliminar toda la serie? También se pierden sus pagos del historial." onConfirmar={eliminarSerie} />
      </div>
    </Modal>
  )
}

// Una ocurrencia de una serie recurrente (Vitall o sueldo fijo). El lápiz abre
// todo lo que se puede hacer con esa fecha o con la serie.
//   coleccion: 'pagosFijos' | 'sueldosFijos'      entidad: el documento de la serie
//   ocurrencia: { fecha, monto, omitida }         nombre: texto opcional a la izquierda
export default function FilaExcepcion({ coleccion, entidad, ocurrencia, hoy, user, show, nombre }) {
  const [abierto, setAbierto] = useState(false)
  const exc = entidad.excepciones?.[ocurrencia.fecha] || {}
  const tieneMonto = exc.montoReal != null || exc.monto != null

  return (
    <div style={{ padding: '9px 0', borderTop: '1px solid var(--beige2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{diaSemanaCorto(ocurrencia.fecha)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fechaCorta(ocurrencia.fecha)}{ocurrencia.fecha < hoy ? ' · pasó' : ''}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, opacity: ocurrencia.omitida ? 0.55 : 1 }}>
          {nombre && <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>}
          <div className="mono" style={{ fontSize: 13, textDecoration: ocurrencia.omitida ? 'line-through' : 'none' }}>{fmt(ocurrencia.monto)}</div>
          {ocurrencia.omitida && <div style={{ fontSize: 10, color: 'var(--amber)' }}>{ocurrencia.pendiente ? 'Esperando el depósito' : 'Dato atípico'}</div>}
          {!ocurrencia.omitida && tieneMonto && <div style={{ fontSize: 10, color: 'var(--amber)' }}>monto ajustado (base {fmt(entidad.monto)})</div>}
        </div>
        <button aria-label="Editar" onClick={() => setAbierto(true)}><IconEdit /></button>
      </div>
      {abierto && <EditarOcurrencia coleccion={coleccion} entidad={entidad} ocurrencia={ocurrencia} nombre={nombre} user={user} show={show} hoy={hoy} onCerrar={() => setAbierto(false)} />}
    </div>
  )
}
