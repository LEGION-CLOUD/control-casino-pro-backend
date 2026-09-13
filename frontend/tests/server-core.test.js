import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import {
  createOperationDelta,
  validateSaldoInput,
  validateRole,
  buildAuthToken,
  createApp,
} from '../src/server.js';

function createServerContext() {
  const db = new Database(':memory:');
  const app = createApp({ db });
  return { app, db };
}

async function request(app, path, init = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      fetch(`http://127.0.0.1:${port}${path}`, init)
        .then(async (response) => {
          const text = await response.text();
          let body = null;
          if (text) {
            try {
              body = JSON.parse(text);
            } catch {
              body = text;
            }
          }
          resolve({ status: response.status, body, headers: response.headers });
        })
        .catch(reject)
        .finally(() => {
          server.close();
        });
    });
  });
}

test('validateSaldoInput rejects invalid amounts', () => {
  assert.throws(() => validateSaldoInput(0, 'ingreso'));
  assert.throws(() => validateSaldoInput(-10, 'egreso'));
  assert.throws(() => validateSaldoInput('abc', 'ingreso'));
});

test('createOperationDelta applies ingreso and egreso correctly', () => {
  assert.equal(createOperationDelta(1000, 'ingreso', 250), 1250);
  assert.equal(createOperationDelta(1000, 'egreso', 250), 750);
});

test('validateRole enforces admin or cajero', () => {
  assert.equal(validateRole('admin'), true);
  assert.equal(validateRole('cajero'), true);
  assert.equal(validateRole('invitado'), false);
});

test('buildAuthToken includes role and user id', () => {
  const token = buildAuthToken({ id: 3, username: 'maria', rol: 'cajero' });
  const [, payload] = token.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  assert.equal(decoded.id, 3);
  assert.equal(decoded.rol, 'cajero');
  assert.ok(token.length > 20);
});

test('login correcto, login incorrecto y acceso sin autenticación', async () => {
  const { app } = createServerContext();

  const ok = await request(app, '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  const bad = await request(app, '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'mal' }),
  });
  assert.equal(bad.status, 401);

  const forbidden = await request(app, '/api/dashboard', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  assert.equal(forbidden.status, 401);
});

test('crear cliente OK y DNI duplicado', async () => {
  const { app } = createServerContext();

  const login = await request(app, '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });

  assert.equal(login.status, 200);

  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': '1',
    'x-user-role': 'admin',
    'x-user-name': 'admin',
  };

  const created = await request(app, '/api/clientes', {
    method: 'POST',
    headers,
    body: JSON.stringify({ nombre: 'Ana', apellido: 'García', dni: '30111222', telefono: '555123', saldo: 0 }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.ok, true);

  const duplicate = await request(app, '/api/clientes', {
    method: 'POST',
    headers,
    body: JSON.stringify({ nombre: 'Ana', apellido: 'García', dni: '30111222', telefono: '555123', saldo: 0 }),
  });

  assert.equal(duplicate.status, 400);
  assert.match(String(duplicate.body.error || ''), /DNI ya existe|ya existe/i);
});

test('borrar cliente con operaciones debe fallar 400', async () => {
  const { app } = createServerContext();
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': '1',
    'x-user-role': 'admin',
    'x-user-name': 'admin',
  };

  const client = await request(app, '/api/clientes', {
    method: 'POST',
    headers,
    body: JSON.stringify({ nombre: 'Pedro', apellido: 'López', dni: '33445566', telefono: '555111', saldo: 0 }),
  });
  assert.equal(client.status, 201);

  const op = await request(app, '/api/operaciones', {
    method: 'POST',
    headers,
    body: JSON.stringify({ cliente_id: 1, tipo: 'ingreso', monto: 100, descripcion: 'Primera operación', referencia: 'efectivo' }),
  });
  assert.equal(op.status, 201);

  const deleted = await request(app, '/api/clientes/1', {
    method: 'DELETE',
    headers,
  });

  assert.equal(deleted.status, 400);
  assert.match(String(deleted.body.error || ''), /operaciones/i);
});

test('borrar auditoria como cajero debe fallar 403', async () => {
  const { app, db } = createServerContext();
  db.prepare('INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)')
    .run('cajero1', '$2a$10$5Yw.9T7C3O5e9kGxYr.nBu1QfT3tE9gWI0u/SyV0J0Qngw0w4eV6W', 'Cajero', 'cajero');

  const deleted = await request(app, '/api/auditoria', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '2',
      'x-user-role': 'cajero',
      'x-user-name': 'cajero1',
    },
    body: JSON.stringify({ confirmacion: 'BORRAR AUDITORIA' }),
  });

  assert.equal(deleted.status, 403);
  assert.match(String(deleted.body.error || ''), /Permiso|denegado/i);
});

test('dashboard debe devolver resumen total_ingresos y no flat', async () => {
  const { app } = createServerContext();

  const login = await request(app, '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });

  assert.equal(login.status, 200);
  const token = login.body.token;
  assert.ok(token);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  await request(app, '/api/clientes', {
    method: 'POST',
    headers,
    body: JSON.stringify({ nombre: 'Luis', apellido: 'Pérez', dni: '44332211', telefono: '555222', saldo: 0 }),
  });

  await request(app, '/api/operaciones', {
    method: 'POST',
    headers,
    body: JSON.stringify({ cliente_id: 1, tipo: 'ingreso', monto: 250, descripcion: 'Pago', referencia: 'efectivo' }),
  });

  await request(app, '/api/operaciones', {
    method: 'POST',
    headers,
    body: JSON.stringify({ cliente_id: 1, tipo: 'egreso', monto: 50, descripcion: 'Gasto', referencia: 'efectivo' }),
  });

  const dashboard = await request(app, '/api/dashboard', { method: 'GET', headers });
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.body && dashboard.body.resumen);
  assert.equal(dashboard.body.resumen.total_ingresos, 250);
  assert.equal(dashboard.body.resumen.total_egresos, 50);
  assert.equal(dashboard.body.resumen.saldo, 200);
});
