const errorHandler = (err, req, res, next) => {
  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'El archivo excede el tamaño máximo de 10MB' });
    }
    return res.status(400).json({ error: err.message });
  }

  // Archivo no permitido
  if (err.message && err.message.includes('Solo se permiten')) {
    return res.status(415).json({ error: err.message });
  }

  // Error genérico
  console.error('❌ Error no controlado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
  });
};

const notFound = (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
};

module.exports = { errorHandler, notFound };
