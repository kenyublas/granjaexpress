import { useState, useEffect } from 'react'
import { supabase, Producto } from '../lib/supabase'
import Head from 'next/head'
import { useRouter } from 'next/router'

const CATEGORIAS = ['Huevos', 'Abarrotes', 'Lácteos', 'Bebidas', 'Limpieza', 'General']
const UNIDADES = ['UND', 'KG', 'PK', 'CBT', 'CJA', 'DOC', 'LT', 'BLS', 'SAC']

const emptyForm = { nombre: '', codigo: '', categoria: 'General', precio_unitario: '', stock: '', unidad: 'UND', activo: true }

export default function Productos() {
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('Todos')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [msgToast, setMsgToast] = useState('')
  const [showInactivos, setShowInactivos] = useState(false)

  const toast = (m: string) => { setMsgToast(m); setTimeout(() => setMsgToast(''), 2500) }

  useEffect(() => { loadProductos() }, [showInactivos])

  const loadProductos = async () => {
    let q = supabase.from('productos').select('*').order('nombre')
    if (!showInactivos) q = q.eq('activo', true)
    const { data } = await q
    if (data) setProductos(data)
  }

  const filtrados = productos.filter(p => {
    const match = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
    return match && (catFiltro === 'Todos' || p.categoria === catFiltro)
  })

  const abrirNuevo = () => { setForm(emptyForm); setEditId(null); setShowForm(true) }

  const abrirEditar = (p: Producto) => {
    setForm({ nombre: p.nombre, codigo: p.codigo || '', categoria: p.categoria, precio_unitario: String(p.precio_unitario), stock: String(p.stock), unidad: p.unidad, activo: p.activo })
    setEditId(p.id)
    setShowForm(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido'); return }
    if (!form.precio_unitario || isNaN(Number(form.precio_unitario))) { toast('Precio inválido'); return }
    setLoading(true)
    const data = {
      nombre: form.nombre.trim().toUpperCase(),
      codigo: form.codigo.trim().toUpperCase() || null,
      categoria: form.categoria,
      precio_unitario: parseFloat(form.precio_unitario),
      stock: parseInt(form.stock) || 0,
      unidad: form.unidad,
      activo: form.activo
    }
    if (editId) {
      const { error } = await supabase.from('productos').update(data).eq('id', editId)
      if (error) { toast('Error: ' + error.message); setLoading(false); return }
      toast('✓ Producto actualizado')
    } else {
      const { error } = await supabase.from('productos').insert(data)
      if (error) { toast('Error: ' + error.message); setLoading(false); return }
      toast('✓ Producto creado')
    }
    setShowForm(false)
    loadProductos()
    setLoading(false)
  }

  const toggleActivo = async (p: Producto) => {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    toast(p.activo ? 'Producto desactivado' : 'Producto activado')
    loadProductos()
  }

  const cats = ['Todos', ...CATEGORIAS]

  return (
    <>
      <Head>
        <title>Productos - Granja Express</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div style={s.root}>
        <header style={s.header}>
          <button style={s.btnBack} onClick={() => router.push('/')}>← Volver</button>
          <div style={s.headerTitle}>📦 Productos ({filtrados.length})</div>
          <button style={s.btnAdd} onClick={abrirNuevo}>+ Nuevo</button>
        </header>

        <div style={s.filtros}>
          <input style={s.search} placeholder="🔍 Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <label style={s.checkLabel}>
            <input type="checkbox" checked={showInactivos} onChange={e => setShowInactivos(e.target.checked)} />
            {' '}Ver inactivos
          </label>
        </div>

        <div style={s.catTabs}>
          {cats.map(c => (
            <button key={c} style={{ ...s.catBtn, ...(catFiltro === c ? s.catBtnActive : {}) }} onClick={() => setCatFiltro(c)}>{c}</button>
          ))}
        </div>

        <div style={s.lista}>
          {filtrados.length === 0 && <div style={s.empty}>No hay productos</div>}
          {filtrados.map(p => (
            <div key={p.id} style={{ ...s.row, ...(!p.activo ? s.rowInactivo : {}) }}>
              <div style={s.rowIcon}>
                {p.categoria === 'Huevos' ? '🥚' : p.categoria === 'Lácteos' ? '🥛' : p.categoria === 'Bebidas' ? '🧃' : '📦'}
              </div>
              <div style={s.rowInfo} onClick={() => abrirEditar(p)}>
                <div style={s.rowNombre}>{p.nombre}</div>
                <div style={s.rowMeta}>
                  <span style={s.badge}>{p.categoria}</span>
                  <span style={s.rowCodigo}>{p.codigo || '—'}</span>
                  <span>Stock: <b>{p.stock}</b> {p.unidad}</span>
                </div>
              </div>
              <div style={s.rowRight}>
                <div style={s.rowPrecio}>S/ {Number(p.precio_unitario).toFixed(2)}</div>
                <button
                  style={{ ...s.toggleBtn, background: p.activo ? '#fee2e2' : '#e8f5ee', color: p.activo ? '#dc2626' : '#1a7a4a' }}
                  onClick={() => toggleActivo(p)}
                >{p.activo ? '✕' : '✓'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <div style={s.overlay} onClick={() => setShowForm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <h3 style={s.modalTitle}>{editId ? '✏️ Editar producto' : '➕ Nuevo producto'}</h3>
              <button style={s.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <label style={s.label}>Nombre *</label>
              <input style={s.input} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: HUEVO X PAQUETE" />

              <div style={s.row2}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Código</label>
                  <input style={s.input} value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="HUE-PK" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Unidad</label>
                  <select style={s.input} value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <label style={s.label}>Categoría</label>
              <div style={s.catGrid}>
                {CATEGORIAS.map(c => (
                  <button key={c} style={{ ...s.catPill, ...(form.categoria === c ? s.catPillActive : {}) }} onClick={() => setForm({ ...form, categoria: c })}>{c}</button>
                ))}
              </div>

              <div style={s.row2}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Precio (S/) *</label>
                  <input style={s.input} type="number" step="0.01" value={form.precio_unitario} onChange={e => setForm({ ...form, precio_unitario: e.target.value })} placeholder="0.00" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Stock inicial</label>
                  <input style={s.input} type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                </div>
              </div>

              <label style={s.checkLabel}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
                {' '}Producto activo (visible en ventas)
              </label>

              <button style={s.btnGuardar} onClick={guardar} disabled={loading}>
                {loading ? 'Guardando...' : editId ? '✓ Actualizar producto' : '✓ Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {msgToast && <div style={s.toast}>{msgToast}</div>}
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f0f4f8' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a7a4a', color: '#fff', padding: '12px 16px' },
  btnBack: { background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 14 },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  btnAdd: { background: '#f5a623', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 14 },
  filtros: { display: 'flex', gap: 12, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb', alignItems: 'center' },
  search: { flex: 1, padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 15 },
  checkLabel: { fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  catTabs: { display: 'flex', gap: 6, padding: '8px 14px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #e5e7eb' },
  catBtn: { padding: '5px 12px', borderRadius: 20, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, whiteSpace: 'nowrap', color: '#374151' },
  catBtnActive: { background: '#1a7a4a', color: '#fff', border: '1px solid #1a7a4a' },
  lista: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { textAlign: 'center', padding: 40, color: '#9ca3af' },
  row: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #e5e7eb' },
  rowInactivo: { opacity: 0.5 },
  rowIcon: { fontSize: 26 },
  rowInfo: { flex: 1, cursor: 'pointer' },
  rowNombre: { fontSize: 14, fontWeight: 700, color: '#111827' },
  rowMeta: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, fontSize: 12, color: '#6b7280' },
  badge: { background: '#e8f5ee', color: '#1a7a4a', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600 },
  rowCodigo: { color: '#9ca3af' },
  rowRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  rowPrecio: { fontSize: 16, fontWeight: 700, color: '#1a7a4a' },
  toggleBtn: { width: 28, height: 28, borderRadius: '50%', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 14, width: '90%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e5e7eb' },
  modalTitle: { fontSize: 17, fontWeight: 700 },
  modalClose: { background: 'none', border: 'none', fontSize: 18, color: '#9ca3af' },
  modalBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 15, width: '100%', background: '#fff' },
  row2: { display: 'flex', gap: 10 },
  catGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  catPill: { padding: '6px 12px', borderRadius: 20, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, color: '#374151' },
  catPillActive: { background: '#1a7a4a', color: '#fff', border: '1px solid #1a7a4a' },
  btnGuardar: { padding: '13px', background: '#1a7a4a', color: '#fff', borderRadius: 9, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 4 },
  toast: { position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '10px 24px', borderRadius: 30, fontSize: 14, zIndex: 200 },
}
