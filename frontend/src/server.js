import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function validateRole(role) {
  return ['admin', 'cajero'].includes(String(role || '').trim().toLowerCase());
}

export function validateSaldoInput(amount, tipo) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Monto inválido');
  }
  if (tipo !== 'ingreso' && tipo !== 'egreso') {
    throw new Error('Tipo inválido');
  }
  return value;
}

export function createOperationDelta(saldoAnterior, tipo, monto) {
  const value = validateSaldoInput(monto, tipo);
  const anterior = Number(saldoAnterior) || 0;
  return tipo === 'ingreso' ? anterior + value : anterior - value;
}

export function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000';
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

export function buildAuthToken(user) {
  const secret = process.env.JWT_SECRET || 'casino-control-local-dev-secret';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ ...user, iat: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyAuthToken(token) {
  const value = String(token || '').trim();
  if (!value) {
    return null;
  }

  const parts = value.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const secret = process.env.JWT_SECRET || 'casino-control-local-dev-secret';
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return {
        id: Number(decoded.id),
        username: decoded.username,
        nombre: decoded.nombre || decoded.username,
        rol: validateRole(decoded.rol) ? decoded.rol : 'cajero',
      };
    } catch {
      return null;
    }
  }

  return null;
}

function resolveDatabasePath() {
  const override = process.env.DB_PATH || process.env.SQLITE_PATH || process.env.DATABASE_URL;
  if (override && String(override).trim()) {
    return override;
  }
  return process.env.NODE_ENV === 'production' ? '/tmp/casino.db' : path.join(__dirname, '..', 'casino.db');
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT NOT NULL,
      nombre TEXT,
      rol TEXT DEFAULT 'cajero',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT,
      dni TEXT UNIQUE,
      telefono TEXT,
      email TEXT,
      saldo REAL DEFAULT 0,
      creado_por INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      monto REAL NOT NULL,
      descripcion TEXT,
      referencia TEXT,
      usuario_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cierres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      arqueo_real REAL,
      diferencia REAL,
      estado TEXT,
      observaciones TEXT,
      total REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      usuario TEXT,
      accion TEXT,
      detalle TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const admin = db.prepare('SELECT * FROM usuarios WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)')
      .run('admin', hash, 'Administrador', 'admin');
    console.log('Admin creado: admin / admin123');
  }
}

function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const user = verifyAuthToken(authHeader.replace(/^Bearer\s+/i, ''));
    if (user) {
      return user;
    }
  }

  const idHeader = req.headers['x-user-id'];
  const roleHeader = req.headers['x-user-role'];
  const nameHeader = req.headers['x-user-name'] || req.headers['x-user'];

  const id = idHeader !== undefined && idHeader !== null && String(idHeader).trim() !== '' ? Number(idHeader) : null;
  const role = String(roleHeader || '').trim().toLowerCase();
  const userName = String(nameHeader || '').trim();

  if (!id && !userName && !role) {
    return null;
  }

  return {
    id: Number.isFinite(id) ? id : null,
    username: userName || 'usuario',
    rol: validateRole(role) ? role : 'cajero',
  };
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  req.user = user;
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const user = getUserFromRequest(req) || req.user || null;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const role = String(user.rol || '').trim().toLowerCase();
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Permiso denegado' });
    }

    req.user = user;
    next();
  };
}

function addAudit(db, user, accion, detalle = '') {
  const username = user && user.username ? user.username : 'sistema';
  const userId = user && user.id ? user.id : null;
  db.prepare('INSERT INTO auditoria (usuario_id, usuario, accion, detalle) VALUES (?, ?, ?, ?)')
    .run(userId, username, accion, detalle || '');
}

export function createApp({ db: providedDb } = {}) {
  const app = express();
  const db = providedDb || new Database(resolveDatabasePath());
  ensureSchema(db);

  const allowedOrigins = getAllowedOrigins();

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-User-Role', 'X-User-Name'],
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.get('/', (req, res) => res.json({ status: 'OK', proyecto: 'CASINO CONTROL PRO - COMPLETO' }));
  app.get('/api', (req, res) => res.json({ status: 'OK', api: 'FUNCIONANDO' }));

  app.get('/api/dashboard', requireAuth, (req, res) => {
    const desde = req.query.desde ? String(req.query.desde) : null;
    const hasta = req.query.hasta ? String(req.query.hasta) : null;

    const whereClauses = [];
    const params = [];
    if (desde) {
      whereClauses.push('DATE(created_at) >= DATE(?)');
      params.push(desde);
    }
    if (hasta) {
      whereClauses.push('DATE(created_at) <= DATE(?)');
      params.push(hasta);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const operaciones = db.prepare(`SELECT * FROM operaciones ${whereSql} ORDER BY created_at DESC`).all(...params);
    const resumen = {
      total_ingresos: 0,
      total_egresos: 0,
      saldo: 0,
      cantidad_operaciones: operaciones.length,
    };

    for (const op of operaciones) {
      const monto = Number(op.monto) || 0;
      if (op.tipo === 'ingreso') {
        resumen.total_ingresos += monto;
      } else if (op.tipo === 'egreso') {
        resumen.total_egresos += monto;
      }
    }
    resumen.saldo = resumen.total_ingresos - resumen.total_egresos;

    const porMetodo = db.prepare(`
      SELECT COALESCE(NULLIF(referencia, ''), 'efectivo') AS metodo_pago, SUM(monto) AS total
      FROM operaciones
      ${whereSql}
      GROUP BY COALESCE(NULLIF(referencia, ''), 'efectivo')
      ORDER BY total DESC
    `).all(...params);

    const graficoDiario = db.prepare(`
      SELECT DATE(created_at) AS dia,
        SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END) AS ingresos,
        SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END) AS egresos
      FROM operaciones
      ${whereSql}
      GROUP BY DATE(created_at)
      ORDER BY dia ASC
    `).all(...params);

    const topClientes = db.prepare(`
      SELECT c.id, c.nombre, c.apellido, SUM(o.monto) AS movimiento_total
      FROM clientes c
      LEFT JOIN operaciones o ON o.cliente_id = c.id
      ${whereSql.replace('operaciones', 'o')} 
      GROUP BY c.id, c.nombre, c.apellido
      ORDER BY movimiento_total DESC
      LIMIT 5
    `).all(...params);

    res.json({
      resumen,
      por_metodo: porMetodo,
      grafico_diario: graficoDiario,
      top_clientes: topClientes,
    });
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña obligatorios' });
    }

    const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(String(username).trim());
    if (!user || !bcrypt.compareSync(String(password), user.password)) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const userPayload = {
      id: user.id,
      username: user.username,
      nombre: user.nombre || user.username,
      rol: user.rol || 'cajero',
    };

    const token = buildAuthToken(userPayload);
    addAudit(db, userPayload, 'LOGIN', `Usuario ${user.username} inició sesión`);
    res.json({ ok: true, token, user: userPayload });
  });

  app.post('/api/logout', requireAuth, (req, res) => {
    addAudit(db, req.user, 'LOGOUT', 'Sesión cerrada');
    res.json({ ok: true, message: 'Sesión cerrada' });
  });

  app.get('/api/users', requireRole(['admin', 'cajero']), (req, res) => {
    const users = db.prepare('SELECT id, username, nombre, rol, created_at FROM usuarios ORDER BY id ASC').all();
    res.json(users);
  });

  app.post('/api/users', requireRole(['admin']), (req, res) => {
    const { username, password, nombre, rol } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña obligatorios' });
    }

    const normalizedRole = validateRole(rol) ? String(rol).toLowerCase() : 'cajero';
    try {
      const hash = bcrypt.hashSync(String(password), 10);
      const info = db.prepare('INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)')
        .run(String(username).trim(), hash, String(nombre || '').trim(), normalizedRole);
      addAudit(db, req.user, 'CREAR_USUARIO', `Creó usuario ${username}`);
      res.status(201).json({ ok: true, id: info.lastInsertRowid, username: String(username).trim(), rol: normalizedRole });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        return res.status(400).json({ error: 'El usuario ya existe' });
      }
      return res.status(500).json({ error: 'Error creando usuario' });
    }
  });

  app.delete('/api/users/:id', requireRole(['admin']), (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    if (targetId === 1) {
      return res.status(400).json({ error: 'No se puede eliminar al administrador principal' });
    }

    const row = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(targetId);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    db.prepare('DELETE FROM usuarios WHERE id = ?').run(targetId);
    addAudit(db, req.user, 'ELIMINAR_USUARIO', `Eliminó usuario #${targetId}`);
    res.json({ ok: true });
  });

  app.get('/api/clientes', requireRole(['admin', 'cajero']), (req, res) => {
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY id DESC').all();
    res.json(clientes.map((cliente) => ({ ...cliente, fecha: cliente.created_at })));
  });

  app.post('/api/clientes', requireRole(['admin', 'cajero']), (req, res) => {
    try {
      const { nombre, apellido, dni, telefono, email, saldo, creado_por } = req.body || {};
      if (!nombre || !dni) {
        return res.status(400).json({ error: 'Nombre y DNI obligatorios' });
      }

      const trimmedDni = String(dni).trim();
      const current = Number(saldo || 0);
      const authorId = Number(creado_por || req.user?.id || 1);

      const info = db.prepare('INSERT INTO clientes (nombre, apellido, dni, telefono, email, saldo, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(String(nombre).trim(), String(apellido || '').trim(), trimmedDni, String(telefono || '').trim(), String(email || '').trim(), current, authorId);

      addAudit(db, req.user, 'CREAR_CLIENTE', `Creó cliente ${trimmedDni}`);
      res.status(201).json({ ok: true, id: info.lastInsertRowid, dni: trimmedDni });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        return res.status(400).json({ error: 'DNI ya existe' });
      }
      return res.status(500).json({ error: error.message || 'Error creando cliente' });
    }
  });

  app.delete('/api/clientes/:id', requireRole(['admin', 'cajero']), (req, res) => {
    const clientId = Number(req.params.id);
    if (!Number.isFinite(clientId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const hasOperations = db.prepare('SELECT COUNT(*) AS total FROM operaciones WHERE cliente_id = ?').get(clientId)?.total || 0;
    if (hasOperations > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un cliente con operaciones registradas' });
    }

    const deleted = db.prepare('DELETE FROM clientes WHERE id = ?').run(clientId);
    if (deleted.changes === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    addAudit(db, req.user, 'ELIMINAR_CLIENTE', `Eliminó cliente #${clientId}`);
    res.json({ ok: true });
  });

  app.get('/api/clientes/:id/ficha', requireRole(['admin', 'cajero']), (req, res) => {
    const clientId = Number(req.params.id);
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clientId);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const historial = db.prepare('SELECT * FROM operaciones WHERE cliente_id = ? ORDER BY created_at DESC').all(clientId);
    res.json({ cliente: { ...cliente, fecha: cliente.created_at }, historial: historial.map((op) => ({ ...op, fecha: op.created_at })) });
  });

  app.get('/api/operaciones', requireRole(['admin', 'cajero']), (req, res) => {
    const rows = db.prepare(`
      SELECT o.*, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, u.username AS cajero_nombre
      FROM operaciones o
      LEFT JOIN clientes c ON c.id = o.cliente_id
      LEFT JOIN usuarios u ON u.id = o.usuario_id
      ORDER BY o.created_at DESC
    `).all();

    res.json(rows.map((op) => ({
      ...op,
      fecha: op.created_at,
      cliente_nombre: op.cliente_nombre && op.cliente_apellido ? `${op.cliente_nombre} ${op.cliente_apellido}` : (op.cliente_nombre || 'Cliente'),
    })));
  });

  app.post('/api/operaciones', requireRole(['admin', 'cajero']), (req, res) => {
    try {
      const { cliente_id, tipo, monto, descripcion, referencia, usuario_id } = req.body || {};
      if (!cliente_id || !tipo || !monto) {
        return res.status(400).json({ error: 'Cliente, tipo y monto son obligatorios' });
      }

      const normalizedTipo = String(tipo).trim().toLowerCase();
      const value = validateSaldoInput(monto, normalizedTipo);
      const targetClient = db.prepare('SELECT * FROM clientes WHERE id = ?').get(Number(cliente_id));
      if (!targetClient) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      const saldoActual = Number(targetClient.saldo) || 0;
      const siguienteSaldo = createOperationDelta(saldoActual, normalizedTipo, value);
      if (normalizedTipo === 'egreso' && saldoActual < value) {
        return res.status(400).json({ error: 'El egreso supera el saldo actual del cliente' });
      }

      const responsableId = Number(usuario_id || req.user?.id || 1);

      const result = db.transaction(() => {
        const info = db.prepare('INSERT INTO operaciones (cliente_id, tipo, monto, descripcion, referencia, usuario_id) VALUES (?, ?, ?, ?, ?, ?)')
          .run(Number(cliente_id), normalizedTipo, value, String(descripcion || '').trim(), String(referencia || '').trim(), responsableId);

        db.prepare('UPDATE clientes SET saldo = ? WHERE id = ?').run(siguienteSaldo, Number(cliente_id));
        return { id: info.lastInsertRowid, saldo: siguienteSaldo };
      })();

      addAudit(db, req.user, normalizedTipo.toUpperCase(), `Operación ${normalizedTipo} de $${value} sobre cliente #${cliente_id}`);
      res.status(201).json({ ok: true, id: result.id, saldo: result.saldo, tipo: normalizedTipo, monto: value });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Error registrando operación' });
    }
  });

  app.delete('/api/operaciones/:id', requireRole(['admin', 'cajero']), (req, res) => {
    const operationId = Number(req.params.id);
    if (!Number.isFinite(operationId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const operation = db.prepare('SELECT * FROM operaciones WHERE id = ?').get(operationId);
    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(operation.cliente_id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const nuevoSaldo = Number(cliente.saldo) - (operation.tipo === 'ingreso' ? Number(operation.monto) : -Number(operation.monto));
    db.prepare('UPDATE clientes SET saldo = ? WHERE id = ?').run(nuevoSaldo, operation.cliente_id);
    db.prepare('DELETE FROM operaciones WHERE id = ?').run(operationId);
    addAudit(db, req.user, 'ELIMINAR_OPERACION', `Eliminó operación #${operationId}`);
    res.json({ ok: true, saldo: nuevoSaldo });
  });

  app.get('/api/cierres', requireRole(['admin', 'cajero']), (req, res) => {
    const rows = db.prepare(`
      SELECT c.*, u.username AS usuario, u.nombre AS nombre_usuario
      FROM cierres c
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      ORDER BY c.created_at DESC
    `).all();

    res.json(rows.map((row) => ({
      ...row,
      fecha_cierre: row.created_at,
      fecha: row.created_at,
      usuario: row.usuario || 'sistema',
      estado: row.estado || 'OK',
    })));
  });

  app.post('/api/cierres', requireRole(['admin', 'cajero']), (req, res) => {
    const { usuario_id, arqueo_real, observaciones } = req.body || {};
    const real = Number(arqueo_real);
    if (!Number.isFinite(real) || real < 0) {
      return res.status(400).json({ error: 'Arqueo real inválido' });
    }

    const flujo = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS recibido,
        COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS entregado,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0) AS saldo_esperado
      FROM operaciones
    `).get();

    const recibido = Number(flujo.recibido) || 0;
    const entregado = Number(flujo.entregado) || 0;
    const saldoEsperado = Number(flujo.saldo_esperado) || 0;
    const diferencia = real - saldoEsperado;
    const estado = diferencia === 0 ? 'OK' : diferencia > 0 ? 'SOBRANTE' : 'FALTANTE';
    const responsableId = Number(usuario_id || req.user?.id || 1);

    const info = db.transaction(() => {
      const result = db.prepare('INSERT INTO cierres (usuario_id, arqueo_real, diferencia, estado, observaciones, total) VALUES (?, ?, ?, ?, ?, ?)')
        .run(responsableId, real, diferencia, estado, String(observaciones || '').trim(), saldoEsperado);
      return result;
    })();

    addAudit(db, req.user, 'CIERRE_CAJA', `Cierre de caja: recibido ${recibido}, entregado ${entregado}, diferencia ${diferencia}, estado ${estado}`);
    res.status(201).json({
      ok: true,
      id: info.lastInsertRowid,
      arqueo_real: real,
      recibido,
      entregado,
      saldo: saldoEsperado,
      diferencia,
      estado,
      total: saldoEsperado,
      fecha: new Date().toISOString(),
    });
  });

  app.get('/api/auditoria', requireRole(['admin', 'cajero']), (req, res) => {
    const rows = db.prepare('SELECT * FROM auditoria ORDER BY id DESC LIMIT 300').all();
    res.json(rows.map((row) => ({ ...row, fecha: row.created_at, username: row.usuario })));
  });

  app.delete('/api/auditoria', requireRole(['admin']), (req, res) => {
    const confirmation = String(req.body?.confirmacion || '');
    if (confirmation !== 'BORRAR AUDITORIA') {
      return res.status(400).json({ error: 'Confirmación requerida' });
    }

    db.prepare('DELETE FROM auditoria').run();
    addAudit(db, req.user, 'BORRAR_AUDITORIA', 'Se borró el historial de auditoría');
    res.json({ ok: true });
  });

  app.get('/api/backup', requireRole(['admin']), (req, res) => {
    const source = resolveDatabasePath();
    const fileName = `backup_casino_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.db`;
    const copyPath = path.join(__dirname, '..', 'backups', fileName);
    try {
      require('fs').mkdirSync(path.dirname(copyPath), { recursive: true });
      require('fs').copyFileSync(source, copyPath);
      return res.json({ ok: true, archivo: fileName, path: copyPath });
    } catch (error) {
      return res.status(500).json({ error: 'No se pudo crear backup: ' + error.message });
    }
  });

  return app;
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename;
const app = createApp();

if (isDirectExecution) {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => console.log(`CASINO PRO EN PUERTO ${PORT}`));
}

export default app;