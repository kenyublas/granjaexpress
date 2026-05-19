import { useState, useEffect } from 'react'
import { supabase, Venta } from '../lib/supabase'
import Head from 'next/head'
import { useRouter } from 'next/router'

const moneyToWords = (n: number): string => {
  const ones = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
  const toW = (x: number): string => {
    if (x === 0) return ''
    if (x === 100) return 'CIEN'
    let r = ''
    if (x >= 1000) { r += (x >= 2000 ? toW(Math.floor(x / 1000)) + ' MIL' : 'MIL'); x %= 1000; if (x) r += ' ' }
    if (x >= 100) { r += hundreds[Math.floor(x / 100)]; x %= 100; if (x) r += ' ' }
    if (x >= 20) { r += tens[Math.floor(x / 10)]; x %= 10; if (x) r += ' Y ' + ones[x] }
    else if (x > 0) r += ones[x]
    return r.trim()
  }
  const intPart = Math.floor(n)
  const dec = Math.round((n - intPart) * 100)
  return `SON: ${toW(intPart) || 'CERO'} Y ${String(dec).padStart(2, '0')}/100 SOLES`
}

export default function Historial() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [ventas, setVentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [ventaDetalle, setVentaDetalle] = useState<any>(null)
  const [msgToast, setMsgToast] = useState('')
  const [resumen, setResumen] = useState({ total: 0, boletas: 0, facturas: 0, count: 0 })

  const toast = (m: string) => { setMsgToast(m); setTimeout(() => setMsgToast(''), 2500) }

  useEffect(() => {
    // Inicializar fechas solo en el cliente para evitar errores de hidratación
    setMounted(true)
    const d = new Date(); d.setHours(0, 0, 0, 0);
    setFechaDesde(d.toISOString().split('T')[0]);
    setFechaHasta(new Date().toISOString().split('T')[0]);
  }, [])

  useEffect(() => { if (fechaDesde && fechaHasta) loadVentas() }, [fechaDesde, fechaHasta, filtroTipo])

  const loadVentas = async () => {
    setLoading(true)
    let q = supabase.from('ventas')
      .select('*')
      .gte('fecha', fechaDesde + 'T00:00:00')
      .lte('fecha', fechaHasta + 'T23:59:59')
      .order('fecha', { ascending: false })

    if (filtroTipo !== 'TODOS') q = q.eq('tipo_comprobante', filtroTipo)

    const { data } = await q
    if (data) {
      setVentas(data)
      const total = data.filter(v => v.estado !== 'ANULADO').reduce((s: number, v: any) => s + v.total, 0)
      const boletas = data.filter((v: any) => v.tipo_comprobante === 'BOLETA' && v.estado !== 'ANULADO').length
      const facturas = data.filter((v: any) => v.tipo_comprobante === 'FACTURA' && v.estado !== 'ANULADO').length
      setResumen({ total, boletas, facturas, count: data.length })
    }
    setLoading(false)
  }

  const verDetalle = async (v: any) => {
    const { data } = await supabase.from('venta_items').select('*').eq('venta_id', v.id)
    setVentaDetalle({ ...v, items: data || [] })
  }

  const anularVenta = async (id: string) => {
    if (!confirm('¿Seguro que deseas ANULAR esta venta?')) return
    await supabase.from('ventas').update({ estado: 'ANULADO' }).eq('id', id)
    toast('Venta anulada')
    setVentaDetalle(null)
    loadVentas()
  }

  const imprimirDetalle = () => window.print()

  // Filtrado incremental en memoria para búsqueda instantánea
  const ventasFiltradas = ventas.filter(v => {
    const term = busqueda.toLowerCase()
    return v.cliente_nombre.toLowerCase().includes(term) ||
      (v.numero_completo || '').toLowerCase().includes(term)
  })

  // Resumen calculado dinámicamente basado en la búsqueda
  const resumenFiltrado = {
    total: ventasFiltradas.filter(v => v.estado !== 'ANULADO').reduce((acc, v) => acc + v.total, 0),
    count: ventasFiltradas.length,
    boletas: ventasFiltradas.filter(v => v.tipo_comprobante === 'BOLETA' && v.estado !== 'ANULADO').length,
    facturas: ventasFiltradas.filter(v => v.tipo_comprobante === 'FACTURA' && v.estado !== 'ANULADO').length,
  }

  return (
    <>
      <Head>
        <title>Historial - Granja Express</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div style={s.root}>
        {/* HEADER */}
        <header style={s.header}>
          <button style={s.btnBack} onClick={() => router.push('/')}>← Volver</button>
          <div style={s.headerTitle}>📋 Historial de Ventas</div>
          <div style={{ width: 80 }} />
        </header>

        {/* FILTROS */}
        <div style={s.filtros}>
          <div style={s.filtroGroup}>
            <label style={s.filtroLabel}>Desde</label>
            <input type="date" style={s.filtroInput} value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          </div>
          <div style={s.filtroGroup}>
            <label style={s.filtroLabel}>Hasta</label>
            <input type="date" style={s.filtroInput} value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          </div>
          <div style={s.filtroGroup}>
            <label style={s.filtroLabel}>Tipo</label>
            <select style={s.filtroInput} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="TODOS">Todos</option>
              <option value="BOLETA">Boletas</option>
              <option value="FACTURA">Facturas</option>
            </select>
          </div>
          <div style={{ ...s.filtroGroup, flex: 1 }}>
            <label style={s.filtroLabel}>Buscar cliente / Ticket</label>
            <input
              style={s.filtroInput}
              placeholder="🔍 Escribe un nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {/* RESUMEN */}
        <div style={s.resumen}>
          <div style={s.resCard}>
            <div style={s.resLabel}>Total vendido</div>
            <div style={{ ...s.resValue, color: '#1a7a4a' }}>S/ {resumenFiltrado.total.toFixed(2)}</div>
          </div>
          <div style={s.resCard}>
            <div style={s.resLabel}>Comprobantes</div>
            <div style={s.resValue}>{resumenFiltrado.count}</div>
          </div>
          <div style={s.resCard}>
            <div style={s.resLabel}>Boletas</div>
            <div style={{ ...s.resValue, color: '#1a7a4a' }}>{resumenFiltrado.boletas}</div>
          </div>
          <div style={s.resCard}>
            <div style={s.resLabel}>Facturas</div>
            <div style={{ ...s.resValue, color: '#f59e0b' }}>{resumenFiltrado.facturas}</div>
          </div>
        </div>

        {/* LISTA */}
        <div style={s.lista}>
          {!mounted || loading ? <div style={s.loadMsg}>Cargando...</div> : null}
          {mounted && !loading && ventasFiltradas.length === 0 && (
            <div style={s.loadMsg}>{busqueda ? 'No se encontraron resultados para "' + busqueda + '"' : 'No hay ventas en este período'}</div>
          )}
          {mounted && ventasFiltradas.map(v => (
            <div key={v.id} style={{ ...s.ventaRow, ...(v.estado === 'ANULADO' ? s.anulado : {}) }} onClick={() => verDetalle(v)}>
              <div style={s.ventaLeft}>
                <div style={{ ...s.ventaBadge, background: v.tipo_comprobante === 'BOLETA' ? '#e8f5ee' : '#fef3c7', color: v.tipo_comprobante === 'BOLETA' ? '#1a7a4a' : '#d97706' }}>
                  {v.tipo_comprobante === 'BOLETA' ? 'TICKET' : 'FACTURA'}
                </div>
                <div style={s.ventaNum}>{v.numero_completo || `${v.serie}-${String(v.numero).padStart(4, '0')}`}</div>
              </div>
              <div style={s.ventaMid}>
                <div style={s.ventaCliente}>{v.cliente_nombre}</div>
                <div style={s.ventaFecha}>{new Date(v.fecha).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={s.ventaRight}>
                {v.estado === 'ANULADO'
                  ? <span style={s.anuladoBadge}>ANULADO</span>
                  : <span style={s.ventaTotal}>S/ {v.total.toFixed(2)}</span>
                }
                <div style={s.ventaPago}>{v.metodo_pago}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DETALLE */}
      {ventaDetalle && (
        <div style={s.overlay} onClick={() => setVentaDetalle(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <h3 style={s.modalTitle}>Detalle de venta</h3>
              <button style={s.modalClose} onClick={() => setVentaDetalle(null)}>✕</button>
            </div>

            <div style={s.comprobante} id="comprobante-print">
              <div style={s.cpCenter}>
                <div style={s.cpTitle}>🥚 GRANJA EXPRESS</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>HUEVO DE ORO</div>
                <div style={s.cpSmall}>de: TORIBIO NICASIO HUGO RUBEN</div>
                <div style={s.cpSmall}>RUC: 10157006610</div>
                <div style={s.cpSmall}>Jr. Sinchi Roca Nro. 223, Amarilis, Huánuco</div>
                <div style={s.cpSmall}>TELEF: 962560092 / 968491084</div>
                <div style={{ fontWeight: 700, fontSize: 12, marginTop: 6 }}>TICKET</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{ventaDetalle.numero_completo || `${ventaDetalle.serie}-${String(ventaDetalle.numero).padStart(4, '0')}`}</div>
              </div>

              <div style={s.cpSection}>
                <div style={s.cpRow}><span>CLIENTE:</span><span>{ventaDetalle.cliente_nombre}</span></div>
                <div style={s.cpRow}><span>FECHA:</span><span>{new Date(ventaDetalle.fecha).toLocaleDateString('es-PE')}</span></div>
                <div style={s.cpRow}><span>HORA:</span><span>{new Date(ventaDetalle.fecha).toLocaleTimeString('es-PE')}</span></div>
                <div style={s.cpRow}><span>PAGO:</span><span>{ventaDetalle.metodo_pago}</span></div>
              </div>

              <div style={s.cpDivider} />
              <div style={{ display: 'flex', fontSize: 10, fontWeight: 700 }}>
                <span style={{ flex: 3 }}>Descripción</span>
                <span style={{ flex: 1, textAlign: 'center' }}>Cant.</span>
                <span style={{ flex: 1, textAlign: 'right' }}>P/U</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Subtot.</span>
              </div>
              <div style={s.cpDivider} />

              {ventaDetalle.items.map((it: any, i: number) => (
                <div key={i}>
                  <div style={{ fontSize: 10, fontWeight: 600 }}>{it.descripcion}</div>
                  <div style={{ display: 'flex', fontSize: 10 }}>
                    <span style={{ flex: 1 }}>{it.unidad}</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>{it.cantidad}</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>{Number(it.precio_unitario).toFixed(2)}</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>{Number(it.subtotal).toFixed(2)}</span>
                  </div>
                </div>
              ))}

              <div style={s.cpDivider} />
              {ventaDetalle.tipo_comprobante === 'BOLETA' ? (
                <div style={s.cpTotalRow}><span>OP. EXONERADAS:</span><span>S/{Number(ventaDetalle.total).toFixed(2)}</span></div>
              ) : (
                <>
                  <div style={s.cpTotalRow}><span>SUBTOTAL:</span><span>S/{Number(ventaDetalle.subtotal).toFixed(2)}</span></div>
                  <div style={s.cpTotalRow}><span>IGV (18%):</span><span>S/{Number(ventaDetalle.igv).toFixed(2)}</span></div>
                </>
              )}
              <div style={s.cpTotalRow}><span>TOTAL:</span><span>S/{Number(ventaDetalle.total).toFixed(2)}</span></div>
              <div style={s.cpTotalRow}><span>IMPORTE A PAGAR:</span><span>S/{Number(ventaDetalle.total).toFixed(2)}</span></div>
              <div style={{ fontWeight: 700, fontSize: 11, marginTop: 6 }}>{moneyToWords(Number(ventaDetalle.total))}</div>
              {ventaDetalle.estado === 'ANULADO' && (
                <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#dc2626', marginTop: 10, border: '2px solid #dc2626', padding: 4 }}>*** ANULADO ***</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '12px 14px' }}>
              <button style={{ ...s.btnAction, background: '#1a7a4a' }} onClick={imprimirDetalle}>🖨️ Imprimir</button>
              {ventaDetalle.estado !== 'ANULADO' && (
                <button style={{ ...s.btnAction, background: '#dc2626' }} onClick={() => anularVenta(ventaDetalle.id)}>🚫 Anular</button>
              )}
              <button style={{ ...s.btnAction, background: '#6b7280' }} onClick={() => setVentaDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {msgToast && <div style={s.toast}>{msgToast}</div>}

      <style>{`
        @media print {
          @page {
            size: 80mm 210mm;
            margin: 0;
          }
          body * { visibility: hidden !important; }
          #comprobante-print, #comprobante-print * {
            visibility: visible !important;
          }
          #comprobante-print {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 72.1mm !important;
            padding: 2mm !important;
            margin: 0 !important;
            font-size: 14px !important;
            line-height: 1.3 !important;
            font-family: monospace !important;
          }
          #comprobante-print div, #comprobante-print span {
            font-size: 13px !important;
          }
          #comprobante-print [style*="font-size: 15"],
          #comprobante-print [style*="font-size: 16"] {
            font-size: 18px !important;
          }
        }
      `}</style>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f0f4f8' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a7a4a', color: '#fff', padding: '12px 16px' },
  btnBack: { background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 14 },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  filtros: { display: 'flex', gap: 12, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb' },
  filtroGroup: { display: 'flex', flexDirection: 'column', gap: 3 },
  filtroLabel: { fontSize: 11, color: '#6b7280', fontWeight: 600 },
  filtroInput: { padding: '7px 10px', border: '1.5px solid #d1d5db', borderRadius: 7, fontSize: 14, background: '#fff' },
  resumen: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '12px 16px' },
  resCard: { background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #e5e7eb' },
  resLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  resValue: { fontSize: 20, fontWeight: 700, color: '#111827' },
  lista: { flex: 1, overflowY: 'auto', padding: '0 16px 16px' },
  loadMsg: { textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 },
  ventaRow: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid #e5e7eb', cursor: 'pointer' },
  anulado: { opacity: 0.55 },
  ventaLeft: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' },
  ventaBadge: { padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 },
  ventaNum: { fontSize: 13, fontWeight: 700, color: '#111827' },
  ventaMid: { flex: 1 },
  ventaCliente: { fontSize: 13, fontWeight: 600, color: '#111827' },
  ventaFecha: { fontSize: 11, color: '#9ca3af' },
  ventaRight: { textAlign: 'right' },
  ventaTotal: { fontSize: 16, fontWeight: 700, color: '#1a7a4a', display: 'block' },
  anuladoBadge: { fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: 20, display: 'block' },
  ventaPago: { fontSize: 11, color: '#9ca3af' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 14, width: '90%', maxWidth: 420, maxHeight: '90vh', overflow: 'auto' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e5e7eb' },
  modalTitle: { fontSize: 16, fontWeight: 700 },
  modalClose: { background: 'none', border: 'none', fontSize: 18, color: '#9ca3af' },
  comprobante: { padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5 },
  cpCenter: { textAlign: 'center', marginBottom: 10 },
  cpTitle: { fontSize: 15, fontWeight: 700 },
  cpSmall: { fontSize: 10 },
  cpSection: { marginBottom: 8 },
  cpRow: { display: 'flex', gap: 6, fontSize: 10 },
  cpDivider: { borderTop: '1px dashed #aaa', margin: '6px 0' },
  cpTotalRow: { display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600 },
  btnAction: { flex: 1, padding: '11px', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' },
  toast: { position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '10px 24px', borderRadius: 30, fontSize: 14, zIndex: 200 },
}
