import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, Producto, VentaItem } from '../lib/supabase'
import Head from 'next/head'
import { useRouter } from 'next/router'

type Comprobante = 'BOLETA' | 'FACTURA'

const numToWords = (n: number): string => {
  const ones = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
  if (n === 0) return 'CERO'
  if (n === 100) return 'CIEN'
  let r = ''
  if (n >= 1000) { r += (n >= 2000 ? numToWords(Math.floor(n / 1000)) + ' MIL' : 'MIL'); n %= 1000; if (n) r += ' ' }
  if (n >= 100) { r += hundreds[Math.floor(n / 100)]; n %= 100; if (n) r += ' ' }
  if (n >= 20) { r += tens[Math.floor(n / 10)]; n %= 10; if (n) r += ' Y ' + ones[n] }
  else if (n > 0) r += ones[n]
  return r.trim()
}

const moneyToWords = (amount: number): string => {
  const intPart = Math.floor(amount)
  const decPart = Math.round((amount - intPart) * 100)
  return `SON: ${numToWords(intPart)} Y ${String(decPart).padStart(2, '0')}/100 SOLES`
}

export default function Ventas() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [productos, setProductos] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [categorias, setCategorias] = useState<string[]>([])
  const [items, setItems] = useState<VentaItem[]>([])
  const [tipoComp, setTipoComp] = useState<Comprobante>('BOLETA')
  const [clienteNombre, setClienteNombre] = useState('CLIENTES VARIOS')
  const [clienteDocTipo, setClienteDocTipo] = useState('DNI')
  const [clienteDocNum, setClienteDocNum] = useState('00000000')
  const [clienteRuc, setClienteRuc] = useState('')
  const [metodoPago, setMetodoPago] = useState('CONTADO')
  const [loading, setLoading] = useState(false)
  const [ventaGuardada, setVentaGuardada] = useState<any>(null)
  const [showComprobante, setShowComprobante] = useState(false)
  const [showCliente, setShowCliente] = useState(false)
  const [showProductos, setShowProductos] = useState(false)
  const [msgToast, setMsgToast] = useState('')
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [cantEdit, setCantEdit] = useState('')
  const [precioEdit, setPrecioEdit] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const toast = (msg: string) => { setMsgToast(msg); setTimeout(() => setMsgToast(''), 2500) }

  useEffect(() => {
    setMounted(true)
    loadProductos()
  }, [])

  const loadProductos = async () => {
    const { data } = await supabase.from('productos').select('*').eq('activo', true).order('nombre')
    if (data) {
      setProductos(data)
      const cats = ['Todos', ...Array.from(new Set(data.map((p: Producto) => p.categoria))).filter(c => c !== 'Aves')]
      setCategorias(cats)
    }
  }

  const filtrados = productos.filter(p => {
    const match = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
    return match && (categoria === 'Todos' || p.categoria === categoria)
  })

  const addItem = (p: Producto) => {
    const idx = items.findIndex(i => i.producto_id === p.id)
    if (idx >= 0) {
      const upd = [...items]
      upd[idx] = { ...upd[idx], cantidad: upd[idx].cantidad + 1, subtotal: (upd[idx].cantidad + 1) * upd[idx].precio_unitario }
      setItems(upd)
    } else {
      setItems([...items, {
        producto_id: p.id,
        descripcion: p.nombre,
        unidad: p.unidad,
        cantidad: 1,
        precio_unitario: p.precio_unitario,
        subtotal: p.precio_unitario
      }])
    }
    toast(`✓ ${p.nombre}`)
  }

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const startEdit = (i: number) => {
    setEditIndex(i)
    setCantEdit(String(items[i].cantidad))
    setPrecioEdit(String(items[i].precio_unitario))
  }

  const applyEdit = () => {
    if (editIndex === null) return
    const cant = parseFloat(cantEdit) || 1
    const precio = parseFloat(precioEdit) || items[editIndex].precio_unitario
    const upd = [...items]
    upd[editIndex] = { ...upd[editIndex], cantidad: cant, precio_unitario: precio, subtotal: cant * precio }
    setItems(upd)
    setEditIndex(null)
  }

  const total = items.reduce((s, i) => s + i.subtotal, 0)
  const igv = tipoComp === 'FACTURA' ? +(total * 0.18).toFixed(2) : 0
  const subtotalFactura = tipoComp === 'FACTURA' ? +(total / 1.18).toFixed(2) : total

  const guardarVenta = async () => {
    if (items.length === 0) { toast('Agrega productos primero'); return }
    if (tipoComp === 'FACTURA' && !clienteRuc) { toast('Factura requiere RUC'); return }
    setLoading(true)
    try {
      const serie = tipoComp === 'BOLETA' ? 'B001' : 'F001'
      const { data: numData } = await supabase.rpc('get_next_numero', { p_tipo: tipoComp, p_serie: serie })
      const numero = numData || 1

      const { data: venta, error } = await supabase.from('ventas').insert({
        tipo_comprobante: tipoComp,
        serie,
        numero,
        cliente_nombre: clienteNombre,
        cliente_doc_tipo: 'DOC',
        cliente_doc_num: '—',
        subtotal: subtotalFactura,
        igv,
        total,
        es_exonerado: tipoComp === 'BOLETA',
        metodo_pago: metodoPago,
        estado: 'PAGADO'
      }).select().single()

      if (error) throw error

      const ventaItemsData = items.map(i => ({
        venta_id: venta.id,
        producto_id: i.producto_id,
        descripcion: i.descripcion,
        unidad: i.unidad,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal
      }))

      await supabase.from('venta_items').insert(ventaItemsData)

      setVentaGuardada({ ...venta, venta_items: items })
      setShowComprobante(true)
      setItems([])
      setClienteNombre('CLIENTES VARIOS')
      setClienteDocNum('00000000')
      setClienteRuc('')
    } catch (e: any) {
      toast('Error: ' + e.message)
    }
    setLoading(false)
  }

  const imprimirComprobante = () => window.print()

  return (
    <>
      <Head>
        <title>Granja Express - Ventas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div style={styles.root}>
        {/* HEADER */}
        <header style={styles.header}>
          <div style={styles.headerLogo}>
            <div style={styles.logoCircle}>🥚</div>
            <div>
              <div style={styles.logoTitle}>GRANJA EXPRESS</div>
              <div style={styles.logoSub}>Huevo de Oro</div>
            </div>
          </div>
          <div style={styles.headerRight}>
            <button style={styles.btnNav} onClick={() => router.push('/productos')}>
              📦 Productos
            </button>
            <button style={styles.btnNav} onClick={() => router.push('/historial')}>
              📋 Historial
            </button>
          </div>
        </header>

        <div style={styles.body}>
          {/* PANEL IZQUIERDO - CATÁLOGO */}
          <div style={styles.catalogo}>
            <div style={styles.searchBar}>
              <input
                ref={searchRef}
                style={styles.searchInput}
                placeholder="🔍 Buscar producto..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <div style={styles.catTabs}>
              {categorias.map(c => (
                <button
                  key={c}
                  style={{ ...styles.catTab, ...(categoria === c ? styles.catTabActive : {}) }}
                  onClick={() => setCategoria(c)}
                >{c}</button>
              ))}
            </div>
            <div style={styles.productGrid}>
              {!mounted ? <div style={styles.emptyMsg}>Cargando catálogo...</div> : null}
              {mounted && filtrados.map(p => (
                <button key={p.id} style={styles.productCard} onClick={() => addItem(p)}>
                  <div style={styles.prodIcon}>
                    {p.categoria === 'Huevos' ? '🥚' : p.categoria === 'Aves' ? '🐔' : '📦'}
                  </div>
                  <div style={styles.prodNombre}>{p.nombre}</div>
                  <div style={styles.prodPrecio}>S/ {p.precio_unitario.toFixed(2)}</div>
                  <div style={styles.prodUnidad}>{p.unidad}</div>
                </button>
              ))}
              {filtrados.length === 0 && (
                <div style={styles.emptyMsg}>No se encontraron productos</div>
              )}
            </div>
          </div>

          {/* PANEL DERECHO - VENTA */}
          <div style={styles.venta}>
            {/* Tipo comprobante */}
            <div style={styles.compTabs}>
              <button
                style={{ ...styles.compTab, ...(tipoComp === 'BOLETA' ? styles.compTabActive : {}) }}
                onClick={() => { setTipoComp('BOLETA'); setClienteNombre('CLIENTES VARIOS'); setClienteDocNum('00000000') }}
              >🧾 TICKET</button>
              <button
                style={{ ...styles.compTab, ...(tipoComp === 'FACTURA' ? styles.compTabActiveF : {}) }}
                onClick={() => { setTipoComp('FACTURA'); setShowCliente(true) }}
              >📄 FACTURA</button>
            </div>

            {/* Info cliente */}
            <div style={styles.clienteBar} onClick={() => setShowCliente(true)}>
              <div style={styles.clienteIcon}>👤</div>
              <div style={styles.clienteInfo}>
                <div style={styles.clienteNombre}>{clienteNombre}</div>
                <div style={styles.clienteDoc}>
                  {tipoComp === 'FACTURA' ? `RUC: ${clienteRuc || '—'}` : `${clienteDocTipo}: ${clienteDocNum}`}
                </div>
              </div>
              <div style={styles.clienteEdit}>✏️</div>
            </div>

            {/* Items */}
            <div style={styles.itemsList}>
              {items.length === 0 && (
                <div style={styles.emptyCart}>
                  <div style={{ fontSize: 40 }}>🛒</div>
                  <div>Toca un producto para agregar</div>
                </div>
              )}
              {items.map((item, i) => (
                <div key={i} style={styles.itemRow}>
                  {editIndex === i ? (
                    <div style={styles.itemEditRow}>
                      <div style={styles.itemEditDesc}>{item.descripcion}</div>
                      <div style={styles.itemEditFields}>
                        <div style={styles.fieldGroup}>
                          <label style={styles.fieldLabel}>Cant.</label>
                          <input style={styles.fieldInput} type="number" value={cantEdit} onChange={e => setCantEdit(e.target.value)} />
                        </div>
                        <div style={styles.fieldGroup}>
                          <label style={styles.fieldLabel}>P/U</label>
                          <input style={styles.fieldInput} type="number" value={precioEdit} onChange={e => setPrecioEdit(e.target.value)} />
                        </div>
                        <button style={styles.btnOk} onClick={applyEdit}>✓</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button style={styles.itemDel} onClick={() => removeItem(i)}>✕</button>
                      <div style={styles.itemDesc} onClick={() => startEdit(i)}>
                        <span style={styles.itemName}>{item.descripcion}</span>
                        <span style={styles.itemDetail}>{item.cantidad} {item.unidad} × S/ {item.precio_unitario.toFixed(2)}</span>
                      </div>
                      <div style={styles.itemSubtotal}>S/ {item.subtotal.toFixed(2)}</div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Totales */}
            <div style={styles.totales}>
              {tipoComp === 'FACTURA' && (
                <>
                  <div style={styles.totalRow}>
                    <span>Subtotal (sin IGV)</span>
                    <span>S/ {subtotalFactura.toFixed(2)}</span>
                  </div>
                  <div style={styles.totalRow}>
                    <span>IGV (18%)</span>
                    <span>S/ {igv.toFixed(2)}</span>
                  </div>
                </>
              )}
              {tipoComp === 'BOLETA' && (
                <div style={styles.totalRow}>
                  <span>OP. EXONERADAS</span>
                  <span>S/ {total.toFixed(2)}</span>
                </div>
              )}
              <div style={styles.totalFinal}>
                <span>TOTAL</span>
                <span>S/ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Método pago */}
            <div style={styles.pagoRow}>
              {['CONTADO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'CRÉDITO'].map(m => (
                <button
                  key={m}
                  style={{ ...styles.pagoBtn, ...(metodoPago === m ? styles.pagoBtnActive : {}) }}
                  onClick={() => setMetodoPago(m)}
                >{m}</button>
              ))}
            </div>

            {/* Botón guardar */}
            <button style={styles.btnGuardar} onClick={guardarVenta} disabled={loading || items.length === 0}>
              {loading ? '⏳ Guardando...' : `💾 GUARDAR VENTA - S/ ${total.toFixed(2)}`}
            </button>
          </div>
        </div>

        {/* MODAL CLIENTE */}
        {showCliente && (
          <div style={styles.modalOverlay} onClick={() => setShowCliente(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Datos del cliente</h3>
                <button style={styles.modalClose} onClick={() => setShowCliente(false)}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <label style={styles.label}>Nombre / Razón Social</label>
                <input style={styles.input} value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} placeholder="Nombre del cliente" />
                <button style={styles.btnModal} onClick={() => setShowCliente(false)}>Confirmar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL COMPROBANTE */}
        {showComprobante && ventaGuardada && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modal, maxWidth: 420 }}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>✅ Venta registrada</h3>
                <button style={styles.modalClose} onClick={() => setShowComprobante(false)}>✕</button>
              </div>
              <div style={styles.comprobantePreview} id="comprobante-print">
                <div style={styles.cpHeader}>
                  <div style={styles.cpLogo}>🥚 GRANJA EXPRESS</div>
                  <div style={styles.cpSubLogo}>HUEVO DE ORO</div>
                  <div style={styles.cpDato}>de: TORIBIO NICASIO HUGO RUBEN</div>
                  <div style={styles.cpDato}>RUC: 10157006610</div>
                  <div style={styles.cpDato}>Jr. Sinchi Roca Nro. 223, Amarilis, Huánuco</div>
                  <div style={styles.cpDato}>TELEF: 962560092 / 968491084</div>
                  <div style={{ ...styles.cpCompTitle, fontSize: '18px', border: '1px solid #000', padding: '4px' }}>TICKET</div>
                  <div style={styles.cpNumero}>{ventaGuardada.numero_completo || `${ventaGuardada.serie}-${String(ventaGuardada.numero).padStart(4, '0')}`}</div>
                </div>

                <div style={styles.cpSection}>
                  <div style={styles.cpRow}><span>CLIENTE:</span><span>{ventaGuardada.cliente_nombre}</span></div>
                  <div style={styles.cpRow}><span>FECHA:</span><span>{new Date(ventaGuardada.fecha || Date.now()).toLocaleDateString('es-PE')}</span></div>
                  <div style={styles.cpRow}><span>HORA:</span><span>{new Date(ventaGuardada.fecha || Date.now()).toLocaleTimeString('es-PE')}</span></div>
                  <div style={styles.cpRow}><span>PAGO:</span><span>{ventaGuardada.metodo_pago}</span></div>
                </div>

                <div style={styles.cpDivider} />
                <div style={styles.cpTableHead}>
                  <span style={{ flex: 3 }}>Descripción</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>Cant.</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>P/U</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Subtot.</span>
                </div>
                <div style={styles.cpDivider} />

                {ventaGuardada.venta_items?.map((it: VentaItem, i: number) => (
                  <div key={i}>
                    <div style={styles.cpItemNombre}>{it.descripcion}</div>
                    <div style={styles.cpItemRow}>
                      <span style={{ flex: 1 }}>{it.unidad}</span>
                      <span style={{ flex: 1, textAlign: 'center' }}>{it.cantidad}</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>{it.precio_unitario.toFixed(2)}</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>{it.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                <div style={styles.cpDivider} />
                {ventaGuardada.tipo_comprobante === 'BOLETA' ? (
                  <div style={styles.cpTotalRow}><span>OP. EXONERADAS:</span><span>S/{ventaGuardada.total.toFixed(2)}</span></div>
                ) : (
                  <>
                    <div style={styles.cpTotalRow}><span>SUBTOTAL:</span><span>S/{ventaGuardada.subtotal.toFixed(2)}</span></div>
                    <div style={styles.cpTotalRow}><span>IGV (18%):</span><span>S/{ventaGuardada.igv.toFixed(2)}</span></div>
                  </>
                )}
                <div style={styles.cpTotalRow}><span>TOTAL:</span><span>S/{ventaGuardada.total.toFixed(2)}</span></div>
                <div style={styles.cpTotalRow}><span>IMPORTE A PAGAR:</span><span>S/{ventaGuardada.total.toFixed(2)}</span></div>
                <div style={styles.cpSon}>{moneyToWords(ventaGuardada.total)}</div>
              </div>

              <div style={{ display: 'flex', gap: 10, padding: '12px 16px' }}>
                <button style={{ ...styles.btnModal, flex: 1, background: '#1a7a4a' }} onClick={imprimirComprobante}>
                  🖨️ Imprimir
                </button>
                <button style={{ ...styles.btnModal, flex: 1, background: '#6b7280' }} onClick={() => setShowComprobante(false)}>
                  Nueva venta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST */}
        {msgToast && <div style={styles.toast}>{msgToast}</div>}

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
            #comprobante-print [style*="font-size: 17"] {
              font-size: 18px !important;
            }
          }
        `}</style>
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a7a4a', color: '#fff', padding: '10px 16px', flexShrink: 0 },
  headerLogo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoCircle: { width: 40, height: 40, background: '#f5a623', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  logoTitle: { fontWeight: 700, fontSize: 17, letterSpacing: 1 },
  logoSub: { fontSize: 11, opacity: 0.85 },
  headerRight: { display: 'flex', gap: 8 },
  btnNav: { background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '7px 12px', borderRadius: 8, fontSize: 13 },
  body: { display: 'flex', flex: 1, overflow: 'hidden', gap: 0 },

  // Catálogo
  catalogo: { width: '58%', display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRight: '1px solid #e5e7eb', overflow: 'hidden' },
  searchBar: { padding: '10px 12px', borderBottom: '1px solid #e5e7eb' },
  searchInput: { width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 15, background: '#fff' },
  catTabs: { display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto', borderBottom: '1px solid #e5e7eb', flexShrink: 0 },
  catTab: { padding: '6px 14px', borderRadius: 20, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, whiteSpace: 'nowrap', color: '#374151' },
  catTabActive: { background: '#1a7a4a', color: '#fff', border: '1px solid #1a7a4a' },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gridAutoRows: '160px', alignContent: 'start', gap: 10, padding: 12, overflowY: 'auto', flex: 1 },
  productCard: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  prodIcon: { fontSize: 28 },
  prodNombre: { fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.3, textAlign: 'center' },
  prodPrecio: { fontSize: 14, fontWeight: 700, color: '#1a7a4a' },
  prodUnidad: { fontSize: 11, color: '#9ca3af' },
  emptyMsg: { gridColumn: '1/-1', textAlign: 'center', color: '#9ca3af', padding: 40 },

  // Venta
  venta: { flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' },
  compTabs: { display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', flexShrink: 0 },
  compTab: { flex: 1, padding: '12px', fontSize: 14, fontWeight: 600, background: '#f9fafb', color: '#6b7280', border: 'none', borderBottom: '3px solid transparent' },
  compTabActive: { background: '#fff', color: '#1a7a4a', borderBottom: '3px solid #1a7a4a' },
  compTabActiveF: { background: '#fff', color: '#f59e0b', borderBottom: '3px solid #f59e0b' },
  clienteBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0fdf4', borderBottom: '1px solid #d1fae5', cursor: 'pointer', flexShrink: 0 },
  clienteIcon: { fontSize: 22 },
  clienteInfo: { flex: 1 },
  clienteNombre: { fontWeight: 600, fontSize: 13, color: '#111827' },
  clienteDoc: { fontSize: 11, color: '#6b7280' },
  clienteEdit: { fontSize: 14, opacity: 0.5 },
  itemsList: { flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 },
  emptyCart: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', gap: 8, fontSize: 14 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', borderRadius: 8, padding: '8px 10px', border: '1px solid #f3f4f6' },
  itemDel: { width: 26, height: 26, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  itemDesc: { flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 },
  itemName: { fontSize: 13, fontWeight: 600, color: '#111827' },
  itemDetail: { fontSize: 11, color: '#6b7280' },
  itemSubtotal: { fontSize: 14, fontWeight: 700, color: '#1a7a4a', flexShrink: 0 },
  itemEditRow: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  itemEditDesc: { fontSize: 13, fontWeight: 600, color: '#111827' },
  itemEditFields: { display: 'flex', gap: 8, alignItems: 'flex-end' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 2 },
  fieldLabel: { fontSize: 10, color: '#6b7280' },
  fieldInput: { width: 70, padding: '5px 7px', border: '1.5px solid #1a7a4a', borderRadius: 6, fontSize: 14, textAlign: 'center' },
  btnOk: { padding: '5px 12px', background: '#1a7a4a', color: '#fff', borderRadius: 6, fontSize: 15, fontWeight: 700 },

  // Totales
  totales: { padding: '10px 14px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '2px 0' },
  totalFinal: { display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, color: '#111827', paddingTop: 6, marginTop: 4, borderTop: '1px solid #e5e7eb' },

  // Pago
  pagoRow: { display: 'flex', gap: 5, padding: '8px 10px', flexWrap: 'wrap', borderTop: '1px solid #f3f4f6', flexShrink: 0 },
  pagoBtn: { padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, fontWeight: 600, color: '#374151' },
  pagoBtnActive: { background: '#1a7a4a', color: '#fff', border: '1px solid #1a7a4a' },

  btnGuardar: { margin: '0 10px 10px', padding: '14px', background: '#1a7a4a', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 700, flexShrink: 0 },

  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 14, width: '90%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e5e7eb' },
  modalTitle: { fontSize: 17, fontWeight: 700 },
  modalClose: { fontSize: 18, background: 'none', color: '#9ca3af', padding: '4px 8px' },
  modalBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 15, width: '100%' },
  btnModal: { padding: '12px', background: '#1a7a4a', color: '#fff', borderRadius: 8, fontSize: 15, fontWeight: 600 },

  // Comprobante
  comprobantePreview: { padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5, borderBottom: '1px dashed #e5e7eb' },
  cpHeader: { textAlign: 'center', marginBottom: 10 },
  cpLogo: { fontSize: 15, fontWeight: 700 },
  cpSubLogo: { fontSize: 13, fontWeight: 600 },
  cpDato: { fontSize: 10 },
  cpCompTitle: { fontWeight: 700, fontSize: 12, marginTop: 6 },
  cpNumero: { fontWeight: 700, fontSize: 13 },
  cpSection: { marginBottom: 8 },
  cpRow: { display: 'flex', gap: 6, fontSize: 10 },
  cpDivider: { borderTop: '1px dashed #aaa', margin: '6px 0' },
  cpTableHead: { display: 'flex', fontSize: 10, fontWeight: 700 },
  cpItemNombre: { fontSize: 10, fontWeight: 600 },
  cpItemRow: { display: 'flex', fontSize: 10 },
  cpTotalRow: { display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600 },
  cpSon: { fontWeight: 700, fontSize: 11, marginTop: 6 },

  // Toast
  toast: { position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '10px 24px', borderRadius: 30, fontSize: 14, fontWeight: 500, zIndex: 200 },
}
