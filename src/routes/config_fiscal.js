const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
};

// GET /api/config-fiscal — obtener tasas actuales
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('config_fiscal')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración fiscal', detail: err.message });
  }
});

// PUT /api/config-fiscal — actualizar tasas RESICO
router.put(
  '/',
  [
    body('tasa_iva')
      .isFloat({ min: 0, max: 1 })
      .withMessage('tasa_iva debe ser un decimal entre 0 y 1 (ej: 0.16 para 16%)'),
    body('tasa_isr')
      .isFloat({ min: 0, max: 1 })
      .withMessage('tasa_isr debe ser un decimal entre 0 y 1 (ej: 0.0125 para 1.25%)'),
    body('regimen').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { tasa_iva, tasa_isr, regimen } = req.body;

      const { data, error } = await supabase
        .from('config_fiscal')
        .update({
          tasa_iva: parseFloat(tasa_iva),
          tasa_isr: parseFloat(tasa_isr),
          ...(regimen && { regimen }),
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;

      res.json({
        data,
        message: `Tasas actualizadas: IVA ${(tasa_iva * 100).toFixed(2)}% | ISR ${(tasa_isr * 100).toFixed(4)}%`,
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al actualizar configuración fiscal', detail: err.message });
    }
  }
);

module.exports = router;
