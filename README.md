# 🥚 GRANJA EXPRESS - Sistema de Ventas

Sistema de ventas para tablet optimizado para tienda mayorista en Perú.
Genera Boletas y Facturas electrónicas, gestión de productos e historial.

---

## 🚀 PASOS PARA INSTALAR

### PASO 1 — Crear base de datos en Supabase

1. Ve a **https://supabase.com** y crea una cuenta gratis
2. Crea un nuevo proyecto (pon cualquier nombre, ej: `granja-express`)
3. En el menú izquierdo ve a **SQL Editor**
4. Copia y pega todo el contenido del archivo `supabase_schema.sql`
5. Haz clic en **Run** (botón verde)
6. ✅ Listo, la base de datos está creada con productos de ejemplo

### PASO 2 — Obtener las credenciales de Supabase

1. En tu proyecto de Supabase ve a **Settings → API**
2. Copia:
   - **Project URL** → algo como `https://abcdef.supabase.co`
   - **anon public key** → una clave larga que empieza con `eyJ...`

### PASO 3 — Subir a Vercel

1. Ve a **https://github.com** y crea un repositorio nuevo llamado `granja-express`
2. Sube todos estos archivos al repositorio
3. Ve a **https://vercel.com**, crea cuenta gratis y conecta con GitHub
4. Importa el repositorio `granja-express`
5. Antes de hacer deploy, en **Environment Variables** agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu Project URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon public key
6. Haz clic en **Deploy**
7. ✅ En 2 minutos tendrás tu URL, ej: `https://granja-express.vercel.app`

### PASO 4 — Usar en tablet

1. Abre la URL en el navegador de tu tablet
2. Agrega a pantalla de inicio para usarlo como app

---

## 📱 PÁGINAS DEL SISTEMA

| Página | URL | Función |
|--------|-----|---------|
| Ventas | `/` | Pantalla principal de ventas |
| Historial | `/historial` | Ver y reimprimir ventas del día |
| Productos | `/productos` | Agregar/editar productos |

---

## 🖨️ IMPRESIÓN DE COMPROBANTES

El sistema genera comprobantes para impresora térmica de **80mm**.

**Para imprimir:**
1. Al guardar una venta aparece el comprobante en pantalla
2. Toca el botón **🖨️ Imprimir**
3. Selecciona tu impresora térmica Bluetooth o USB

**Recomendación de impresora:**
- Cualquier impresora térmica de 80mm con Bluetooth (ej: Epson TM-T20, Xprinter)
- Conectar vía Bluetooth al tablet y seleccionar al imprimir

---

## 💼 FUNCIONALIDADES

- ✅ Boleta de Venta Electrónica (serie B001)
- ✅ Factura de Venta Electrónica (serie F001, requiere RUC)
- ✅ Búsqueda rápida de productos por nombre o código
- ✅ Filtro por categorías
- ✅ Editar cantidad y precio al agregar item
- ✅ Múltiples métodos de pago: Contado, Yape, Plin, Transferencia, Crédito
- ✅ Historial con filtro por fechas y tipo de comprobante
- ✅ Anular comprobantes
- ✅ Gestión completa de productos (crear, editar, activar/desactivar)
- ✅ Operaciones exoneradas (IGV) para boletas
- ✅ Cálculo de IGV 18% para facturas
- ✅ Importe en letras (ej: QUINIENTOS Y 00/100 SOLES)

---

## 🔧 DATOS DE LA EMPRESA

Para cambiar el nombre, RUC y dirección en los comprobantes,
edita en los archivos `src/pages/index.tsx` e `historial.tsx` las líneas:

```
TORIBIO NICASIO HUGO RUBEN
RUC: 10157006610
Jr. Sinchi Roca Nro. 223, Amarilis, Huánuco
TELEF: 962560092 / 968491084
```

---

## 📞 SOPORTE

Si tienes problemas con la instalación, busca tutoriales de:
- "Cómo subir proyecto Next.js a Vercel"
- "Cómo usar Supabase con Next.js"
