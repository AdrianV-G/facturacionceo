const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { query, param, body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'comprobantes';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Solo se permiten archivos PNG, JPG, WEBP o PDF'));
  },
});

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

const SUBTIPOS = {
  deposito: ['honorarios', 'comisiones_por_venta', 'pautas'],
  cargo: ['nomina', 'licencia', 'servicio'],
};

// Helper: subir archivo a Supabase Storage
const uploadComprobante = async (file, tipo_operacion) => {
  const ext = file.mimetype === 'application/pdf' ? 'pdf' : file.originalname.split('.').pop();
  const fileName = `${tipo_operacion}/${uuidv4()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

// Helper: obtener tasas default desde config_fiscal
const getTasasDefault = async () => {
  const { data, error } = await supabase
    .from('config_fiscal')
    .select('tasa_iva, tasa_isr')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data;
};

// ─── LISTAR ──────────────────────────────────────────────────
router.get(
  '/',
  [
    query('tipo_operacion').optional().isIn(['deposito', 'cargo']),
    query('subtipo').optional().trim(),
    query('estatus').optional().isIn(['pendiente', 'confirmado', 'cancelado']),
    query('requiere_factura').optional().isBoolean(),
    query('fecha_desde').optional().isISO8601(),
    query('fecha_hasta').optional().isISO8601(),
    query('proyecto_id').optional().trim(),
    query('empleado_id').optional().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const {
        tipo_operacion, subtipo, estatus, requiere_factura,
        fecha_desde, fecha_hasta, proyecto_id, empleado_id,
        page = 1, limit = 20, order = 'desc',
      } = req.query;

      const from = (page - 1) * limit;
      let q = supabase
        .from('facturas')
        .select('*', { count: 'exact' })
        .order('fecha_registro', { ascending: order === 'asc' })
        .range(from, from + limit - 1);

      if (tipo_operacion)    q = q.eq('tipo_operacion', tipo_operacion);
      if (subtipo)           q = q.eq('subtipo', subtipo);
      if (estatus)           q = q.eq('estatus', estatus);
      if (proyecto_id)        q = q.eq('proyecto_id', proyecto_id);
      if (empleado_id)       q = q.eq('empleado_id', empleado_id);
      if (fecha_desde)       q = q.gte('fecha_operacion', fecha_desde);
      if (fecha_hasta)       q = q.lte('fecha_operacion', fecha_hasta);
      if (requiere_factura !== undefined)
        q = q.eq('requiere_factura', requiere_factura === 'true');

      const { data, error, count } = await q;
      if (error) throw error;

      res.json({ data, meta: { total: count, page, limit, pages: Math.ceil(count / limit) } });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener facturas', detail: err.message });
    }
  }
);

// ─── OBTENER UNA ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('facturas').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener factura', detail: err.message });
  }
});

// ─── CREAR ────────────────────────────────────────────────────
router.post(
  '/',
  upload.single('comprobante'),
  [
    body('fecha_operacion').isISO8601().withMessage('Fecha de operación inválida'),
    body('tipo_operacion').isIn(['deposito', 'cargo']).withMessage('Tipo inválido'),
    body('subtipo').notEmpty().withMessage('El subtipo es requerido'),
    body('monto').isFloat({ min: 0.01 }).withMessage('Monto inválido'),
    body('requiere_factura').optional().isBoolean(),
    // tasas opcionales — si no vienen, se toman de config_fiscal
    body('tasa_iva').optional().isFloat({ min: 0, max: 1 }),
    body('tasa_isr').optional().isFloat({ min: 0, max: 1 }),
    body('proyecto_id').optional().trim(),
    body('empleado_id').optional().trim(),
    body('estatus').optional().isIn(['pendiente', 'confirmado', 'cancelado']),
    body('notas').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { tipo_operacion, subtipo, proyecto_id, empleado_id } = req.body;
      const requiere_factura = req.body.requiere_factura === 'true' || req.body.requiere_factura === true;

      if (!SUBTIPOS[tipo_operacion]?.includes(subtipo)) {
        return res.status(422).json({
          error: `Subtipo "${subtipo}" no válido para "${tipo_operacion}". Opciones: ${SUBTIPOS[tipo_operacion].join(', ')}`,
        });
      }
      if (tipo_operacion === 'deposito' && !proyecto_id)
        return res.status(422).json({ error: 'Los depósitos requieren un proyecto' });
      if (subtipo === 'nomina' && !empleado_id)
        return res.status(422).json({ error: 'Las nóminas requieren un empleado' });
      if (requiere_factura && tipo_operacion !== 'deposito')
        return res.status(422).json({ error: 'La factura solo aplica en depósitos' });

      // Tasas: usar las del request o las del config_fiscal
      let tasa_iva = null;
      let tasa_isr = null;
      if (requiere_factura) {
        if (req.body.tasa_iva !== undefined && req.body.tasa_isr !== undefined) {
          tasa_iva = parseFloat(req.body.tasa_iva);
          tasa_isr = parseFloat(req.body.tasa_isr);
        } else {
          const defaults = await getTasasDefault();
          tasa_iva = req.body.tasa_iva !== undefined ? parseFloat(req.body.tasa_iva) : defaults.tasa_iva;
          tasa_isr = req.body.tasa_isr !== undefined ? parseFloat(req.body.tasa_isr) : defaults.tasa_isr;
        }
      }

      let comprobante_url = null;
      if (req.file) comprobante_url = await uploadComprobante(req.file, tipo_operacion);

      const payload = {
        fecha_operacion: req.body.fecha_operacion,
        tipo_operacion,
        subtipo,
        monto: parseFloat(req.body.monto),
        requiere_factura,
        tasa_iva,
        tasa_isr,
        proyecto_id: proyecto_id || null,
        empleado_id: empleado_id || null,
        estatus: req.body.estatus || 'pendiente',
        comprobante_url,
        notas: req.body.notas || null,
      };

      const { data, error } = await supabase.from('facturas').insert(payload).select().single();
      if (error) throw error;

      res.status(201).json({ data, message: 'Factura registrada correctamente' });
    } catch (err) {
      res.status(500).json({ error: 'Error al crear factura', detail: err.message });
    }
  }
);

// ─── ACTUALIZAR ───────────────────────────────────────────────
router.put(
  '/:id',
  upload.single('comprobante'),
  [
    body('fecha_operacion').optional().isISO8601(),
    body('tipo_operacion').optional().isIn(['deposito', 'cargo']),
    body('subtipo').optional().notEmpty(),
    body('monto').optional().isFloat({ min: 0.01 }),
    body('requiere_factura').optional().isBoolean(),
    body('tasa_iva').optional().isFloat({ min: 0, max: 1 }),
    body('tasa_isr').optional().isFloat({ min: 0, max: 1 }),
    body('estatus').optional().isIn(['pendiente', 'confirmado', 'cancelado']),
    body('notas').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('facturas').select('*').eq('id', req.params.id).single();
      if (fetchError || !existing) return res.status(404).json({ error: 'Factura no encontrada' });

      const tipo_operacion = req.body.tipo_operacion || existing.tipo_operacion;
      const subtipo = req.body.subtipo || existing.subtipo;
      const requiere_factura =
        req.body.requiere_factura !== undefined
          ? req.body.requiere_factura === 'true' || req.body.requiere_factura === true
          : existing.requiere_factura;

      if (subtipo && !SUBTIPOS[tipo_operacion]?.includes(subtipo))
        return res.status(422).json({ error: `Subtipo "${subtipo}" no válido para "${tipo_operacion}"` });

      // Recalcular tasas si cambia requiere_factura
      let tasa_iva = existing.tasa_iva;
      let tasa_isr = existing.tasa_isr;
      if (requiere_factura) {
        if (req.body.tasa_iva !== undefined) tasa_iva = parseFloat(req.body.tasa_iva);
        if (req.body.tasa_isr !== undefined) tasa_isr = parseFloat(req.body.tasa_isr);
        // Si se activa factura y no había tasas, cargar defaults
        if (!tasa_iva || !tasa_isr) {
          const defaults = await getTasasDefault();
          tasa_iva = tasa_iva ?? defaults.tasa_iva;
          tasa_isr = tasa_isr ?? defaults.tasa_isr;
        }
      } else {
        tasa_iva = null;
        tasa_isr = null;
      }

      let comprobante_url = existing.comprobante_url;
      if (req.file) comprobante_url = await uploadComprobante(req.file, tipo_operacion);

      const updates = {
        ...(req.body.fecha_operacion && { fecha_operacion: req.body.fecha_operacion }),
        ...(req.body.tipo_operacion  && { tipo_operacion: req.body.tipo_operacion }),
        ...(req.body.subtipo         && { subtipo: req.body.subtipo }),
        ...(req.body.monto           && { monto: parseFloat(req.body.monto) }),
        ...(req.body.estatus         && { estatus: req.body.estatus }),
        ...(req.body.notas !== undefined && { notas: req.body.notas }),
        ...(req.body.proyecto_id  !== undefined && { proyecto_id:  req.body.proyecto_id  || null }),
        ...(req.body.empleado_id !== undefined && { empleado_id: req.body.empleado_id || null }),
        requiere_factura,
        tasa_iva,
        tasa_isr,
        comprobante_url,
      };

      const { data, error } = await supabase
        .from('facturas').update(updates).eq('id', req.params.id).select().single();
      if (error) throw error;
      res.json({ data, message: 'Factura actualizada' });
    } catch (err) {
      res.status(500).json({ error: 'Error al actualizar factura', detail: err.message });
    }
  }
);

// ─── CANCELAR ─────────────────────────────────────────────────
router.patch('/:id/cancelar', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('facturas').update({ estatus: 'cancelado' }).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({ data, message: 'Factura cancelada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar factura', detail: err.message });
  }
});

// ─── RESUMEN / DASHBOARD ──────────────────────────────────────
router.get('/resumen/totales', async (req, res) => {
  try {
    const { mes, anio } = req.query;

    let q = supabase
      .from('facturas')
      .select('tipo_operacion, subtipo, monto, monto_base, iva_calculado, isr_retenido, neto_recibido, requiere_factura')
      .neq('estatus', 'cancelado');

    if (mes && anio) {
      const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const fin = new Date(anio, mes, 0).toISOString().split('T')[0];
      q = q.gte('fecha_operacion', inicio).lte('fecha_operacion', fin);
    }

    const { data, error } = await q;
    if (error) throw error;

    const totales = {
      total_depositos: 0,
      total_cargos: 0,
      balance: 0,
      // Fiscal
      total_iva: 0,
      total_isr: 0,
      total_neto: 0,
      facturas_emitidas: 0,
      por_subtipo: {},
    };

    data.forEach((f) => {
      const monto = parseFloat(f.monto);
      if (f.tipo_operacion === 'deposito') {
        totales.total_depositos += monto;
        totales.total_iva += parseFloat(f.iva_calculado || 0);
        totales.total_isr += parseFloat(f.isr_retenido  || 0);
        totales.total_neto += parseFloat(f.neto_recibido || monto);
        if (f.requiere_factura) totales.facturas_emitidas++;
      } else {
        totales.total_cargos += monto;
      }
      totales.por_subtipo[f.subtipo] = (totales.por_subtipo[f.subtipo] || 0) + monto;
    });

    totales.balance = totales.total_depositos - totales.total_cargos;

    res.json({ data: totales });
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular totales', detail: err.message });
  }
});

// ─── OBLIGACIONES FISCALES (para declaración) ─────────────────
router.get('/resumen/fiscal', async (req, res) => {
  try {
    const { anio } = req.query;

    let q = supabase
      .from('obligaciones_fiscales')  // vista en Supabase
      .select('*');

    if (anio) {
      q = q.gte('mes', `${anio}-01-01`).lte('mes', `${anio}-12-31`);
    }

    const { data, error } = await q.order('mes', { ascending: false });
    if (error) throw error;

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen fiscal', detail: err.message });
  }
});

module.exports = router;
