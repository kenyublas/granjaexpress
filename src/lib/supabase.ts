import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Producto = {
  id: string
  nombre: string
  codigo: string
  categoria: string
  precio_unitario: number
  stock: number
  unidad: string
  activo: boolean
}

export type Cliente = {
  id: string
  nombre: string
  tipo_doc: string
  num_doc: string
  telefono?: string
  direccion?: string
  es_empresa: boolean
  ruc?: string
}

export type VentaItem = {
  producto_id?: string
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export type Venta = {
  id: string
  tipo_comprobante: 'BOLETA' | 'FACTURA'
  serie: string
  numero: number
  numero_completo: string
  cliente_nombre: string
  cliente_doc_tipo: string
  cliente_doc_num: string
  subtotal: number
  igv: number
  total: number
  es_exonerado: boolean
  estado: string
  metodo_pago: string
  fecha: string
  venta_items?: VentaItem[]
}
