const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    celular_personal: { type: String, trim: true },
    activo: { type: Boolean, default: true },
    id_portafolio_comercial: { type: String },
    clasificacion: { type: String, trim: true },
    num_cliente: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'clientes',
  }
);

clienteSchema.index({ nombre: 'text' });

module.exports = mongoose.model('Cliente', clienteSchema);
