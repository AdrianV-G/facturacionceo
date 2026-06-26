const express = require('express');
const router = express.Router();
const { query, param, body, validationResult } = require('express-validator');
const Empleado = require('../models/Empleado');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// GET /api/empleados
router.get(
  '/',
  [
    query('q').optional().trim().escape(),
    query('activo').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { q, activo, page = 1, limit = 50 } = req.query;
      const filter = {};

      if (q) {
        filter.$or = [
          { nombre: { $regex: q, $options: 'i' } },
          { apellido: { $regex: q, $options: 'i' } },
          { puesto: { $regex: q, $options: 'i' } },
        ];
      }

      filter.activo = activo !== undefined ? activo === 'true' : true;

      const skip = (page - 1) * limit;
      const [empleados, total] = await Promise.all([
        Empleado.find(filter).sort({ nombre: 1 }).skip(skip).limit(limit).lean(),
        Empleado.countDocuments(filter),
      ]);

      // Agregar nombre_completo manualmente (lean() no incluye virtuals)
      const data = empleados.map((e) => ({
        ...e,
        nombre_completo: `${e.nombre} ${e.apellido || ''}`.trim(),
      }));

      res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener empleados', detail: err.message });
    }
  }
);

// GET /api/empleados/:id
router.get(
  '/:id',
  [param('id').isMongoId()],
  handleValidation,
  async (req, res) => {
    try {
      const empleado = await Empleado.findById(req.params.id).lean();
      if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
      res.json({
        data: { ...empleado, nombre_completo: `${empleado.nombre} ${empleado.apellido || ''}`.trim() },
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener empleado', detail: err.message });
    }
  }
);

// POST /api/empleados
router.post(
  '/',
  [
    body('nombre').notEmpty().trim().withMessage('El nombre es requerido'),
    body('apellido').optional().trim(),
    body('puesto').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('salario_base').optional().isFloat({ min: 0 }),
    body('fecha_ingreso').optional().isISO8601(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const empleado = new Empleado(req.body);
      await empleado.save();
      res.status(201).json({ data: empleado, message: 'Empleado creado correctamente' });
    } catch (err) {
      res.status(500).json({ error: 'Error al crear empleado', detail: err.message });
    }
  }
);

// PUT /api/empleados/:id
router.put(
  '/:id',
  [param('id').isMongoId(), body('email').optional().isEmail().normalizeEmail()],
  handleValidation,
  async (req, res) => {
    try {
      const empleado = await Empleado.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );
      if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
      res.json({ data: empleado, message: 'Empleado actualizado' });
    } catch (err) {
      res.status(500).json({ error: 'Error al actualizar empleado', detail: err.message });
    }
  }
);

// DELETE /api/empleados/:id — soft delete
router.delete(
  '/:id',
  [param('id').isMongoId()],
  handleValidation,
  async (req, res) => {
    try {
      const empleado = await Empleado.findByIdAndUpdate(
        req.params.id,
        { activo: false },
        { new: true }
      );
      if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
      res.json({ message: 'Empleado desactivado', data: empleado });
    } catch (err) {
      res.status(500).json({ error: 'Error al eliminar empleado', detail: err.message });
    }
  }
);

module.exports = router;
