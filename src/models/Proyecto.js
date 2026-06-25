const mongoose = require('mongoose');

const proyectoSchema = new mongoose.Schema(
  {
    id_proyecto:              { type: String, trim: true },
    nombre_proyecto:          { type: String, required: true, trim: true },
    nomenclatura:             { type: String, trim: true },
    nombre_cliente:           { type: String, trim: true },
    celular_personal_cliente: { type: String, trim: true },
    ciudades:                 { type: String, trim: true },
    fecha_inicio:             { type: Date },
    monto_pago:               { type: Number },
    tipo_pago:                { type: String, trim: true },
    dias_pago:                { type: String, trim: true },
    pago_comision:            { type: Boolean, default: false },
    pago_adelantado:          { type: Boolean, default: false },
    clasificacion:            { type: String, trim: true },
    activo:                   { type: Boolean, default: true },
    id_calendario:            { type: String, trim: true },
    email_doctor:             { type: String, trim: true },
    hace_jornadas:            { type: Boolean, default: false },
    requiere_email_paciente:  { type: Boolean, default: false },
    id_cuenta_publicitaria:   { type: String },
    id_cuenta_anuncios:       { type: String },
    id_pagina_fb:             { type: String },
    id_pagina_ig:             { type: String },
    servicio_activo:          { type: String, trim: true },
    onboarding_completado:    { type: Boolean, default: false },
    registro_consultas:       { type: Boolean, default: false },
    num_cliente:              { type: String, trim: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'proyectos',
  }
);

proyectoSchema.index({ nombre_proyecto: 'text', nombre_cliente: 'text', id_proyecto: 'text' });

module.exports = mongoose.model('Proyecto', proyectoSchema);
