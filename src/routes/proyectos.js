const express = require('express');
const router = express.Router();
const { query, param, validationResult } = require('express-validator');
const Proyecto = require('../models/Proyecto');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// GET /api/proyectos — listar con búsqueda
router.get(
  '/',
  [
    query('q').optional().trim(),
    query('activo').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { q, activo, page = 1, limit = 100 } = req.query;
      const filter = {};

      if (q) {
        filter.$or = [
          { nombre_proyecto:  { $regex: q, $options: 'i' } },
          { nombre_cliente:   { $regex: q, $options: 'i' } },
          { id_proyecto:      { $regex: q, $options: 'i' } },
          { nomenclatura:     { $regex: q, $options: 'i' } },
        ];
      }

      filter.activo = activo !== undefined ? activo === 'true' : true;

      const skip = (page - 1) * limit;
      const [proyectos, total] = await Promise.all([
        Proyecto.find(filter)
          .sort({ nombre_proyecto: 1 })
          .skip(skip)
          .limit(limit)
          .select('_id id_proyecto nombre_proyecto nomenclatura nombre_cliente monto_pago tipo_pago clasificacion activo servicio_activo')
          .lean(),
        Proyecto.countDocuments(filter),
      ]);

      res.json({
        data: proyectos,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener proyectos', detail: err.message });
    }
  }
);

// GET /api/proyectos/:id
router.get(
  '/:id',
  [param('id').isMongoId()],
  handleValidation,
  async (req, res) => {
    try {
      const proyecto = await Proyecto.findById(req.params.id).lean();
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
      res.json({ data: proyecto });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener proyecto', detail: err.message });
    }
  }
);

module.exports = router;
