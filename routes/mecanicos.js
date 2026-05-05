const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/mecanicos
router.get('/', (req, res) => {
  const db = getDb();
  const mecanicos = db.prepare(`
    SELECT mec.*,
           COUNT(CASE WHEN ot.estado NOT IN ('entregada','cancelada') THEN 1 END) as ot_activas
    FROM mecanicos mec
    LEFT JOIN ordenes_trabajo ot ON ot.mecanico_id = mec.id
    WHERE mec.activo = 1
    GROUP BY mec.id
    ORDER BY mec.nombre
  `).all();
  res.json(mecanicos);
});

// POST /api/mecanicos
router.post('/', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Solo administradores.' });
  const { nombre, telefono = '', especialidad = '' } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
  const db = getDb();
  const result = db.prepare('INSERT INTO mecanicos (nombre, telefono, especialidad) VALUES (?, ?, ?)').run(nombre.trim(), telefono, especialidad);
  res.json(db.prepare('SELECT *, 0 as ot_activas FROM mecanicos WHERE id = ?').get(result.lastInsertRowid));
});

// GET /api/mecanicos/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const mec = db.prepare('SELECT * FROM mecanicos WHERE id = ?').get(Number(req.params.id));
  if (!mec) return res.status(404).json({ error: 'Mecánico no encontrado.' });

  const ots = db.prepare(`
    SELECT ot.id, ot.numero, ot.estado, ot.fecha_ingreso, ot.fecha_prometida,
           m.patente, m.marca, m.modelo, c.nombre as cliente_nombre
    FROM ordenes_trabajo ot
    JOIN motos m ON m.id = ot.moto_id
    JOIN clientes c ON c.id = m.cliente_id
    WHERE ot.mecanico_id = ? AND ot.estado NOT IN ('entregada','cancelada')
    ORDER BY ot.fecha_ingreso DESC
  `).all(mec.id);

  res.json({ ...mec, ots_activas: ots });
});

// PATCH /api/mecanicos/:id
router.patch('/:id', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Solo administradores.' });
  const db = getDb();
  const mec = db.prepare('SELECT id FROM mecanicos WHERE id = ?').get(Number(req.params.id));
  if (!mec) return res.status(404).json({ error: 'Mecánico no encontrado.' });

  const { nombre, telefono, especialidad } = req.body;
  db.prepare(`
    UPDATE mecanicos SET
      nombre = COALESCE(?, nombre),
      telefono = COALESCE(?, telefono),
      especialidad = COALESCE(?, especialidad)
    WHERE id = ?
  `).run(nombre, telefono, especialidad, Number(req.params.id));

  res.json(db.prepare('SELECT * FROM mecanicos WHERE id = ?').get(Number(req.params.id)));
});

// PATCH /api/mecanicos/:id/activo — soft delete
router.patch('/:id/activo', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Solo administradores.' });
  const { activo } = req.body;
  const db = getDb();
  db.prepare('UPDATE mecanicos SET activo = ? WHERE id = ?').run(activo ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
