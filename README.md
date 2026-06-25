# DESEMPCEO Facturas — Backend API

API REST en Express.js para el sistema de facturas. Conecta MongoDB Atlas (catálogos) con Supabase (facturas + storage de comprobantes).

## Stack

- **Node.js 20** + Express 4
- **MongoDB Atlas** — catálogos de clientes y empleados
- **Supabase** — tabla `facturas` + Storage para comprobantes

---

## Setup local

### 1. Variables de entorno

```bash
cp .env.example .env
```

Llenar `.env` con tus credenciales:

```env
PORT=3001
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/desempceo
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=comprobantes
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### 2. Schema en Supabase

Ejecutar `supabase_schema.sql` en el SQL Editor de tu proyecto Supabase.

Después, en **Storage > New Bucket**, crear un bucket llamado `comprobantes` (público).

### 3. Instalar y correr

```bash
npm install
npm run dev     # desarrollo con hot-reload
npm start       # producción
```

---

## Endpoints

### Clientes (MongoDB)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/clientes` | Listar (query: `q`, `activo`, `page`, `limit`) |
| GET | `/api/clientes/:id` | Obtener uno |
| POST | `/api/clientes` | Crear |
| PUT | `/api/clientes/:id` | Actualizar |
| DELETE | `/api/clientes/:id` | Soft delete (activo=false) |

### Empleados (MongoDB)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/empleados` | Listar (query: `q`, `activo`, `page`, `limit`) |
| GET | `/api/empleados/:id` | Obtener uno |
| POST | `/api/empleados` | Crear |
| PUT | `/api/empleados/:id` | Actualizar |
| DELETE | `/api/empleados/:id` | Soft delete |

### Facturas (Supabase)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/facturas` | Listar con filtros |
| GET | `/api/facturas/:id` | Obtener una |
| POST | `/api/facturas` | Crear (multipart/form-data) |
| PUT | `/api/facturas/:id` | Actualizar (multipart/form-data) |
| PATCH | `/api/facturas/:id/cancelar` | Cancelar |
| GET | `/api/facturas/resumen/totales` | Totales para dashboard |

#### Filtros en GET /api/facturas

```
?tipo_operacion=deposito|cargo
&subtipo=honorarios|comisiones_por_venta|pautas|nomina|licencia|servicio
&estatus=pendiente|confirmado|cancelado
&fecha_desde=2025-01-01
&fecha_hasta=2025-12-31
&cliente_id=<mongo_id>
&empleado_id=<mongo_id>
&page=1&limit=20
&order=asc|desc
```

#### Crear factura (POST /api/facturas)

```
Content-Type: multipart/form-data

fecha_operacion: 2025-06-01         (requerido)
tipo_operacion:  deposito | cargo   (requerido)
subtipo:         honorarios         (requerido)
monto:           15000              (requerido)
cliente_id:      <mongo_id>         (requerido si deposito)
empleado_id:     <mongo_id>         (requerido si nomina)
estatus:         pendiente          (opcional, default: pendiente)
notas:           Texto libre        (opcional)
comprobante:     <archivo>          (opcional, PNG/JPG/WEBP/PDF máx 10MB)
```

---

## Despliegue en Easypanel

1. Subir código a un repo Git (GitHub/GitLab)
2. En Easypanel: **New App > Docker** o **Git**
3. Variables de entorno: copiar las del `.env` en la sección de Environment Variables
4. Puerto: `3001`
5. Health check: `GET /health`

---

## Estructura del proyecto

```
src/
├── config/
│   ├── mongodb.js      # Conexión a Mongo Atlas
│   └── supabase.js     # Cliente Supabase
├── middleware/
│   └── errorHandler.js # Manejo centralizado de errores
├── models/
│   ├── Cliente.js      # Schema Mongoose
│   └── Empleado.js     # Schema Mongoose
├── routes/
│   ├── clientes.js     # CRUD clientes
│   ├── empleados.js    # CRUD empleados
│   └── facturas.js     # CRUD facturas + upload Supabase
└── index.js            # Entry point
```
