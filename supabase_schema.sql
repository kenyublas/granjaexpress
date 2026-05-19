-- =============================================
-- GRANJA EXPRESS - Schema de Base de Datos
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Tabla de productos
CREATE TABLE productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT UNIQUE,
  categoria TEXT DEFAULT 'General',
  precio_unitario DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0,
  unidad TEXT DEFAULT 'UND',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de clientes
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo_doc TEXT DEFAULT 'DNI',
  num_doc TEXT,
  telefono TEXT,
  direccion TEXT,
  es_empresa BOOLEAN DEFAULT false,
  ruc TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secuencias para numeración
CREATE SEQUENCE boleta_seq START 1;
CREATE SEQUENCE factura_seq START 1;

-- Tabla de ventas
CREATE TABLE ventas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_comprobante TEXT NOT NULL CHECK (tipo_comprobante IN ('BOLETA', 'FACTURA')),
  serie TEXT NOT NULL,
  numero INTEGER NOT NULL,
  numero_completo TEXT GENERATED ALWAYS AS (serie || '-' || LPAD(numero::TEXT, 4, '0')) STORED,
  cliente_id UUID REFERENCES clientes(id),
  cliente_nombre TEXT NOT NULL DEFAULT 'CLIENTES VARIOS',
  cliente_doc_tipo TEXT DEFAULT 'DNI',
  cliente_doc_num TEXT DEFAULT '00000000',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  igv DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  es_exonerado BOOLEAN DEFAULT true,
  estado TEXT DEFAULT 'PAGADO' CHECK (estado IN ('PAGADO', 'ANULADO')),
  metodo_pago TEXT DEFAULT 'CONTADO',
  observaciones TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de detalle de ventas
CREATE TABLE venta_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  descripcion TEXT NOT NULL,
  unidad TEXT DEFAULT 'UND',
  cantidad DECIMAL(10,3) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar cliente genérico
INSERT INTO clientes (nombre, tipo_doc, num_doc) VALUES ('CLIENTES VARIOS', 'DNI', '00000000');

-- Insertar productos de ejemplo
INSERT INTO productos (nombre, codigo, categoria, precio_unitario, stock, unidad) VALUES
  ('HUEVO X PAQUETE', 'HUE-PQ', 'Huevos', 50.00, 100, 'PK'),
  ('HUEVO X UNIDAD', 'HUE-UN', 'Huevos', 0.50, 500, 'UND'),
  ('HUEVO X CUBETA', 'HUE-CB', 'Huevos', 15.00, 50, 'CBT'),
  ('POLLO ENTERO', 'POL-EN', 'Aves', 25.00, 30, 'KG'),
  ('ARROZ EXTRA 1KG', 'ARR-1K', 'Abarrotes', 3.50, 200, 'KG'),
  ('ACEITE 1L', 'ACE-1L', 'Abarrotes', 8.00, 100, 'UND'),
  ('AZUCAR 1KG', 'AZU-1K', 'Abarrotes', 2.80, 150, 'KG'),
  ('SAL 1KG', 'SAL-1K', 'Abarrotes', 1.00, 200, 'KG');

-- Habilitar Row Level Security (básico - sin auth para tablet local)
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para uso local (tablet en tienda)
CREATE POLICY "allow_all_productos" ON productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_ventas" ON ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_items" ON venta_items FOR ALL USING (true) WITH CHECK (true);

-- Función para obtener próximo número de comprobante
CREATE OR REPLACE FUNCTION get_next_numero(p_tipo TEXT, p_serie TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_max INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_max
  FROM ventas
  WHERE tipo_comprobante = p_tipo AND serie = p_serie;
  RETURN v_max;
END;
$$ LANGUAGE plpgsql;
