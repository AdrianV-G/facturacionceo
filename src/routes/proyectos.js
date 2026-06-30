const express = require('express');
const router  = express.Router();
const { query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// Helper: acceso directo a la colección sin schema fijo
const col = (name) => mongoose.connection.db.collection(name);

// GET /api/proyectos — listar proyectos
router.get(
  '/',
  [
    query('q').optional().trim(),
    query('activo').optional(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { q, page = 1, limit = 200 } = req.query;
      const filter = { activo: true };

      if (q) {
        filter.$or = [
          { nombre_proyecto: { $regex: q, $options: 'i' } },
          { nombre_cliente:  { $regex: q, $options: 'i' } },
          { id_proyecto:     { $regex: q, $options: 'i' } },
          { nomenclatura:    { $regex: q, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [proyectos, total] = await Promise.all([
        col('proyectos').find(filter)
          .sort({ nombre_cliente: 1, nombre_proyecto: 1 })
          .skip(skip)
          .limit(limit)
          .project({ _id:1, id_proyecto:1, nombre_proyecto:1, nomenclatura:1,
                     nombre_cliente:1, monto_pago:1, tipo_pago:1, clasificacion:1,
                     activo:1, servicio_activo:1, num_cliente:1 })
          .toArray(),
        col('proyectos').countDocuments(filter),
      ]);

      res.json({ data: proyectos, meta: { total, page, limit } });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener proyectos', detail: err.message });
    }
  }
);

// GET /api/proyectos/agrupados
// Join proyectos + clientes por num_cliente, agrupados por cliente
router.get('/agrupados', async (req, res) => {
  try {
    // 1. Traer todos los proyectos activos
    const proyectos = await col('proyectos')
      .find({ activo: true })
      .sort({ nombre_proyecto: 1 })
      .project({ _id:1, id_proyecto:1, nombre_proyecto:1, nomenclatura:1,
                 nombre_cliente:1, monto_pago:1, tipo_pago:1, clasificacion:1,
                 servicio_activo:1, num_cliente:1 })
      .toArray();

    // 2. Traer todos los clientes activos
    const clientes = await col('clientes')
      .find({ activo: true })
      .project({ _id:1, nombre:1, celular_personal:1, clasificacion:1, num_cliente:1 })
      .toArray();

    // 3. Mapa de clientes por num_cliente para lookup rápido
    const clienteMap = {};
    clientes.forEach(c => {
      if (c.num_cliente) clienteMap[c.num_cliente] = c;
    });

    // 4. Agrupar proyectos por cliente
    // Primero intentar cruzar con num_cliente, si no usar nombre_cliente del proyecto
    const grupos = {};
    proyectos.forEach(p => {
      const clienteData = p.num_cliente ? clienteMap[p.num_cliente] : null;
      const nombreGrupo = clienteData?.nombre || p.nombre_cliente || 'Sin cliente';

      if (!grupos[nombreGrupo]) {
        grupos[nombreGrupo] = {
          cliente: nombreGrupo,
          cliente_info: clienteData || null,
          proyectos: [],
        };
      }
      grupos[nombreGrupo].proyectos.push({
        ...p,
        _id: p._id.toString(),
      });
    });

    // 5. Ordenar alfabéticamente por cliente
    const data = Object.values(grupos)
      .sort((a, b) => a.cliente.localeCompare(b.cliente));

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener proyectos agrupados', detail: err.message });
  }
});

// GET /api/proyectos/:id
router.get('/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const proyecto = await col('proyectos')
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ data: proyecto });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener proyecto', detail: err.message });
  }
});

module.exports = router;


// PUT /api/proyectos/:id — actualizar proyecto
router.put('/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const updates = { ...req.body, updated_at: new Date() };
    delete updates._id;

    // Convertir tipos
    if (updates.monto_pago)  updates.monto_pago  = parseFloat(updates.monto_pago);
    if (updates.presupuesto) updates.presupuesto = parseFloat(updates.presupuesto);
    if (updates.fecha_inicio) updates.fecha_inicio = new Date(updates.fecha_inicio);

    const bools = ['pago_comision','pago_adelantado','hace_jornadas',
                   'requiere_email_paciente','onboarding_completado',
                   'registro_consultas','activo'];
    bools.forEach(k => {
      if (updates[k] !== undefined) updates[k] = updates[k] === true || updates[k] === 'true';
    });

    const result = await col('proyectos').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ data: result, message: 'Proyecto actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar proyecto', detail: err.message });
  }
});
