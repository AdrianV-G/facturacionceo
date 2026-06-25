const express = require('express');
const router = express.Router();
const { query, param, body, validationResult } = require('express-validator');
const Cliente = require('../models/Cliente');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

// GET /api/clientes — listar con búsqueda y paginación
router.get(
  '/',
  [
    query('q').optional().trim().escape(),
    query('activo').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { q, activo, page = 1, limit = 50 } = req.query;
      const filter = {};

      if (q) {
        filter.$or = [
          { nombre: { $regex: q, $options: 'i' } },
          { empresa: { $regex: q, $options: 'i' } },
        ];
      }

      if (activo !== undefined) {
        filter.activo = activo === 'true';
      } else {
        filter.activo = true; // por defecto solo activos
      }

      const skip = (page - 1) * limit;
      const [clientes, total] = await Promise.all([
        Cliente.find(filter).sort({ nombre: 1 }).skip(skip).limit(limit).lean(),
        Cliente.countDocuments(filter),
      ]);

      res.json({
        data: clientes,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener clientes', detail: err.message });
    }
  }
);

// GET /api/clientes/:id
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('ID inválido')],
  handleValidation,
  async (req, res) => {
    try {
      const cliente = await Cliente.findById(req.params.id).lean();
      if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
      res.json({ data: cliente });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener cliente', detail: err.message });
    }
  }
);

// POST /api/clientes
router.post(
  '/',
  [
    body('nombre').notEmpty().trim().withMessage('El nombre es requerido'),
    body('empresa').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('telefono').optional().trim(),
    body('notas').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const cliente = new Cliente(req.body);
      await cliente.save();
      res.status(201).json({ data: cliente, message: 'Cliente creado correctamente' });
    } catch (err) {
      res.status(500).json({ error: 'Error al crear cliente', detail: err.message });
    }
  }
);

// PUT /api/clientes/:id
router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('nombre').optional().notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const cliente = await Cliente.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );
      if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
      res.json({ data: cliente, message: 'Cliente actualizado' });
    } catch (err) {
      res.status(500).json({ error: 'Error al actualizar cliente', detail: err.message });
    }
  }
);

// DELETE /api/clientes/:id — soft delete
router.delete(
  '/:id',
  [param('id').isMongoId()],
  handleValidation,
  async (req, res) => {
    try {
      const cliente = await Cliente.findByIdAndUpdate(
        req.params.id,
        { activo: false },
        { new: true }
      );
      if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
      res.json({ message: 'Cliente desactivado', data: cliente });
    } catch (err) {
      res.status(500).json({ error: 'Error al eliminar cliente', detail: err.message });
    }
  }
);

module.exports = router;
