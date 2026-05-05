const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');

router.get('/status', (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  res.json({
    hasUsers: count > 0,
    loggedIn: !!(req.session?.userId),
    displayName: req.session?.displayName || null,
    role: req.session?.role || null
  });
});

router.post('/setup', (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (count > 0) return res.status(403).json({ error: 'Ya existe al menos un usuario.' });

  const { username, password, display_name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)').run(
    username.toLowerCase().trim(), hash, display_name || username, 'admin'
  );
  res.json({ ok: true });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.displayName = user.display_name || user.username;
  req.session.role = user.role;

  res.json({ ok: true, displayName: user.display_name || user.username, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  // AUTH DESHABILITADA — devuelve usuario de desarrollo
  if (!req.session?.userId) {
    return res.json({ userId: 0, username: 'dev', displayName: 'Desarrollo', role: 'admin', mecanico_id: null });
  }
  const db = getDb();
  const user = db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session = null;
    return res.status(401).json({ error: 'No autenticado.' });
  }

  // Si el usuario es mecánico, buscar su mecanico_id por nombre
  let mecanico_id = null;
  if (user.role === 'mecanico') {
    const mec = db.prepare('SELECT id FROM mecanicos WHERE LOWER(nombre) = LOWER(?) AND activo = 1').get(user.display_name || user.username);
    mecanico_id = mec?.id || null;
  }

  res.json({
    userId: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    role: user.role,
    mecanico_id
  });
});

function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'No autenticado.' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Solo administradores.' });
  next();
}

router.get('/users', requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

router.post('/users', requireAdmin, (req, res) => {
  const { username, password, display_name, role = 'recepcion' } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  if (!['admin', 'mecanico', 'recepcion'].includes(role)) return res.status(400).json({ error: 'Rol inválido.' });

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)').run(
    username.toLowerCase().trim(), hash, display_name || username, role
  );
  res.json({ ok: true, id: result.lastInsertRowid });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.userId) return res.status(400).json({ error: 'No podés eliminarte a vos mismo.' });
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.patch('/users/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  const hash = bcrypt.hashSync(password, 10);
  const db = getDb();
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, Number(req.params.id));
  res.json({ ok: true });
});

router.patch('/users/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'mecanico', 'recepcion'].includes(role)) return res.status(400).json({ error: 'Rol inválido.' });
  const id = Number(req.params.id);
  if (id === req.session.userId) return res.status(400).json({ error: 'No podés cambiar tu propio rol.' });
  const db = getDb();
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  res.json({ ok: true });
});

module.exports = router;
