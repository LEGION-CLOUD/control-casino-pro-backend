const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check for Render
app.get('/', (req, res) => {
  res.json({ status: 'OK', service: 'Casino Control Pro Backend', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Auth - login que espera tu frontend
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username);
  
  // Credenciales que usa tu frontend: admin / admin123
  if ((username === 'admin' && password === 'admin123') || (username === 'admin' && password === 'admin')) {
    return res.json({
      success: true,
      token: 'demo-token-casino-pro-2024',
      user: { id: 1, username: 'admin', role: 'admin' }
    });
  }
  return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
});

// Endpoints dummy para que no de 404 el frontend
app.get('/api/mesas', (req, res) => {
  res.json([
    { id: 1, nombre: 'Mesa 1 - Blackjack', estado: 'activa', jugadores: 3 },
    { id: 2, nombre: 'Mesa 2 - Ruleta', estado: 'activa', jugadores: 5 },
    { id: 3, nombre: 'Mesa 3 - Poker', estado: 'inactiva', jugadores: 0 }
  ]);
});

app.get('/api/caja', (req, res) => {
  res.json({ total: 154200, ingresos: 200000, egresos: 45800, fecha: new Date().toISOString() });
});

app.get('/api/usuarios', (req, res) => {
  res.json([{ id: 1, username: 'admin', role: 'admin' }]);
});

// Catch all
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.path });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Casino Control Pro Backend corriendo en puerto ${PORT}`);
});
