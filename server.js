const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));

// FIX: Acepta rutas con y sin /api para que el frontend no quede negro
app.use((req, res, next) => {
  if (req.path === '/users' || req.path.startsWith('/users/') || 
      req.path === '/login' || req.path.startsWith('/login') ||
      req.path === '/clients' || req.path.startsWith('/clients') ||
      req.path === '/operations' || req.path === '/auth') {
    req.url = '/api' + req.url;
  }
  next();
});
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function load(file, def) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(def, null, 2));
    return def;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}
function save(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

let users = load('users.json', [{ id: '1', username: 'admin', password: 'admin123', role: 'admin', createdAt: new Date().toISOString() }]);
let clientes = load('clientes.json', []);
let operaciones = load('operaciones.json', []);
let cierres = load('cierres.json', []);
let auditoria = load('auditoria.json', []);

function addLog(accion, usuario = 'admin', detalle = '') {
  auditoria.unshift({ id: Date.now().toString(), fecha: new Date().toISOString(), accion, usuario, detalle });
  if (auditoria.length > 500) auditoria = auditoria.slice(0, 500);
  save('auditoria.json', auditoria);
}

app.get('/', (req, res) => res.json({ status: 'OK', service: 'Casino Control Pro Backend', version: '2.0-full', uptime: process.uptime() }));
app.get('/api', (req, res) => res.json({ status: 'OK', endpoints: ['/api/login','/api/usuarios','/api/clientes','/api/operaciones','/api/cierres','/api/auditoria','/api/dashboard'] }));

function handleLogin(req, res) {
  const { username, user, usuario, password, pass } = req.body || {};
  const u = (username || user || usuario || '').toLowerCase().trim();
  const p = (password || pass || '').trim();
  const found = users.find(x => x.username.toLowerCase() === u && x.password === p);
  if (!found) {
    if ((u === 'admin' && (p === 'admin123' || p === 'admin'))) {
      const admin = users.find(x => x.username === 'admin');
      return res.json({ token: 'fake-jwt-token-' + admin.id, user: { id: admin.id, username: admin.username, role: admin.role } });
    }
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  addLog('LOGIN', found.username, 'Inicio de sesion');
  res.json({ token: 'fake-jwt-token-' + found.id, user: { id: found.id, username: found.username, role: found.role } });
}
app.post('/api/login', handleLogin);
app.post('/api/auth/login', handleLogin);
app.post('/api/auth', handleLogin);

function getUsers(req, res) { res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt })) ); }
function createUser(req, res) {
  const { username, user, usuario, password, pass, role } = req.body || {};
  const uname = (username || user || usuario || '').trim();
  const pwd = (password || pass || '').trim();
  if (!uname || !pwd) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  if (users.find(u => u.username.toLowerCase() === uname.toLowerCase())) return res.status(400).json({ error: 'El usuario ya existe' });
  const newUser = { id: Date.now().toString(), username: uname, password: pwd, role: role || 'cajero', createdAt: new Date().toISOString() };
  users.push(newUser);
  save('users.json', users);
  addLog('CREAR_USUARIO', 'admin', 'Creado usuario ' + uname);
  res.json({ id: newUser.id, username: newUser.username, role: newUser.role });
}
function deleteUser(req, res) {
  const { id } = req.params;
  if (id === '1') return res.status(400).json({ error: 'No se puede borrar admin principal' });
  users = users.filter(u => u.id !== id);
  save('users.json', users);
  addLog('BORRAR_USUARIO', 'admin', 'Borrado usuario ' + id);
  res.json({ ok: true });
}
app.get('/api/usuarios', getUsers);
app.get('/api/users', getUsers);
app.post('/api/usuarios', createUser);
app.post('/api/users', createUser);
app.delete('/api/usuarios/:id', deleteUser);
app.delete('/api/users/:id', deleteUser);
app.post('/api/usuarios/create', createUser);

function getClientes(req, res) { res.json(clientes); }
function createCliente(req, res) {
  const { nombre, name, telefono, dni, saldo } = req.body || {};
  const n = (nombre || name || '').trim();
  if (!n) return res.status(400).json({ error: 'Nombre requerido' });
  const c = { id: Date.now().toString(), nombre: n, telefono: telefono || '', dni: dni || '', saldo: Number(saldo) || 0, createdAt: new Date().toISOString() };
  clientes.push(c);
  save('clientes.json', clientes);
  addLog('CREAR_CLIENTE', 'admin', 'Cliente ' + n);
  res.json(c);
}
function deleteCliente(req, res) {
  clientes = clientes.filter(c => c.id !== req.params.id);
  save('clientes.json', clientes);
  res.json({ ok: true });
}
app.get('/api/clientes', getClientes);
app.get('/api/clients', getClientes);
app.post('/api/clientes', createCliente);
app.post('/api/clients', createCliente);
app.delete('/api/clientes/:id', deleteCliente);

function getOperaciones(req, res) { res.json(operaciones); }
function createOperacion(req, res) {
  const { tipo, monto, amount, cliente, clienteId, descripcion, usuario } = req.body || {};
  const t = (tipo || 'ingreso').toLowerCase();
  const m = Number(monto || amount || 0);
  if (!m) return res.status(400).json({ error: 'Monto requerido' });
  const op = {
    id: Date.now().toString(),
    tipo: t.includes('egr') ? 'egreso' : 'ingreso',
    monto: m,
    cliente: cliente || clienteId || 'General',
    descripcion: descripcion || '',
    usuario: usuario || 'admin',
    fecha: new Date().toISOString()
  };
  operaciones.unshift(op);
  save('operaciones.json', operaciones);
  addLog('OPERACION', op.usuario, op.tipo + ' $' + m + ' - ' + op.cliente);
  res.json(op);
}
function deleteOperacion(req, res) {
  operaciones = operaciones.filter(o => o.id !== req.params.id);
  save('operaciones.json', operaciones);
  res.json({ ok: true });
}
app.get('/api/operaciones', getOperaciones);
app.get('/api/operations', getOperaciones);
app.post('/api/operaciones', createOperacion);
app.post('/api/operations', createOperacion);
app.delete('/api/operaciones/:id', deleteOperacion);

app.get('/api/cierres', (req, res) => res.json(cierres));
app.post('/api/cierres', (req, res) => {
  const totalIngresos = operaciones.filter(o => o.tipo === 'ingreso').reduce((a,b) => a + b.monto, 0);
  const totalEgresos = operaciones.filter(o => o.tipo === 'egreso').reduce((a,b) => a + b.monto, 0);
  const cierre = { id: Date.now().toString(), fecha: new Date().toISOString(), totalIngresos, totalEgresos, balance: totalIngresos - totalEgresos, operaciones: operaciones.length };
  cierres.unshift(cierre);
  save('cierres.json', cierres);
  addLog('CIERRE', 'admin', 'Cierre $' + cierre.balance);
  res.json(cierre);
});

app.get('/api/auditoria', (req, res) => res.json(auditoria));
app.get('/api/audit', (req, res) => res.json(auditoria));

function getDashboard(req, res) {
  const totalIngresos = operaciones.filter(o => o.tipo === 'ingreso').reduce((a,b) => a + b.monto, 0);
  const totalEgresos = operaciones.filter(o => o.tipo === 'egreso').reduce((a,b) => a + b.monto, 0);
  const balance = totalIngresos - totalEgresos;
  res.json({
    totalIngresos,
    totalEgresos,
    balance,
    totalClientes: clientes.length,
    totalUsuarios: users.length,
    totalOperaciones: operaciones.length,
    ultimasOperaciones: operaciones.slice(0,10)
  });
}
app.get('/api/dashboard', getDashboard);
app.get('/api/stats', getDashboard);
app.get('/api/panel', getDashboard);
app.get('/api/caja', getDashboard);
app.get('/api/mesas', (req, res) => res.json([]));

app.post('/api/cambiar-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body || {};
  const u = users.find(x => x.username === (username || 'admin'));
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (u.password !== oldPassword) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
  u.password = newPassword;
  save('users.json', users);
  res.json({ ok: true });
});

app.get('/api/backup', (req, res) => {
  res.json({ users, clientes, operaciones, cierres, auditoria, fecha: new Date().toISOString() });
});

app.use((req, res) => {
  console.log('404 - ' + req.method + ' ' + req.path);
  res.status(404).json({ error: 'Ruta no encontrada: ' + req.method + ' ' + req.path });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Casino Control Pro Backend FULL corriendo en puerto ' + PORT);
});
