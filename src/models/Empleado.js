const mongoose = require('mongoose');

const empleadoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
    },
    apellido: {
      type: String,
      trim: true,
    },
    puesto: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    salario_base: {
      type: Number,
      min: 0,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    fecha_ingreso: {
      type: Date,
    },
    notas: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'empleados',
  }
);

empleadoSchema.index({ nombre: 'text', apellido: 'text' });

// Virtual: nombre completo
empleadoSchema.virtual('nombre_completo').get(function () {
  return `${this.nombre} ${this.apellido || ''}`.trim();
});

empleadoSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Empleado', empleadoSchema);
