const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/clientes?q=&limit=20&offset=0
router.get('/', (req, res) => {
  const db = getDb();
  const { q = '', limit = 20, offset = 0 } = req.query;
  let clientes;
  if (q.trim()) {
    const term = `%${q.trim()}%`;
    clientes = db.prepare(`
      SELECT c.*, COUNT(m.id) as cant_motos
      FROM clientes c
      LEFT JOIN motos m ON m.cliente_id = c.id
      WHERE c.nombre LIKE ? OR c.telefono LIKE ? OR c.email LIKE ?
      GROUP BY c.id
      ORDER BY c.nombre
      LIMIT ? OFFSET ?
    `).all(term, term, term, Number(limit), Number(offset));
  } else {
    clientes = db.prepare(`
      SELECT c.*, COUNT(m.id) as cant_motos
      FROM clientes c
      LEFT JOIN motos m ON m.cliente_id = c.id
      GROUP BY c.id
      ORDER BY c.nombre
      LIMIT ? OFFSET ?
    `).all(Number(limit), Number(offset));
  }
  res.json(clientes);
});

// POST /api/clientes
router.post('/', (req, res) => {
  const { nombre, telefono = '', email = '', direccion = '', notas = '' } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO clientes (nombre, telefono, email, direccion, notas)
    VALUES (?, ?, ?, ?, ?)
  `).run(nombre.trim(), telefono, email, direccion, notas);
  res.json(db.prepare('SELECT *, 0 as cant_motos FROM clientes WHERE id = ?').get(result.lastInsertRowid));
});

// GET /api/clientes/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(Number(req.params.id));
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const motos = db.prepare(`
    SELECT m.*, COUNT(ot.id) as cant_ot
    FROM motos m
    LEFT JOIN ordenes_trabajo ot ON ot.moto_id = m.id
    WHERE m.cliente_id = ?
    GROUP BY m.id
    ORDER BY m.patente
  `).all(cliente.id);
  res.json({ ...cliente, motos });
});

// PATCH /api/clientes/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(Number(req.params.id));
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const { nombre, telefono, email, direccion, notas } = req.body;
  db.prepare(`
    UPDATE clientes SET
      nombre = COALESCE(?, nombre),
      telefono = COALESCE(?, telefono),
      email = COALESCE(?, email),
      direccion = COALESCE(?, direccion),
      notas = COALESCE(?, notas),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(nombre, telefono, email, direccion, notas, Number(req.params.id));

  res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(Number(req.params.id)));
});

// DELETE /api/clientes/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const moto = db.prepare('SELECT id FROM motos WHERE cliente_id = ? LIMIT 1').get(Number(req.params.id));
  if (moto) return res.status(409).json({ error: 'El cliente tiene motos registradas. Eliminá las motos primero.' });
  db.prepare('DELETE FROM clientes WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
