const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: false,
    status: 'legacy-demo-disabled',
    message: 'Esta instancia raíz es un stub legacy. La aplicación real y segura vive en la carpeta frontend.',
    realApp: 'frontend/src/server.js',
  });
});

app.get('*', (_req, res) => {
  res.status(410).json({
    error: 'Instancia legacy desactivada',
    message: 'El sistema real se ejecuta desde frontend y usa autenticación real. Este backend raíz fue removido del flujo activo.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Legacy API disabled on ${PORT}. Use frontend application.`);
});
