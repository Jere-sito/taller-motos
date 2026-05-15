const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/motos?q=&cliente_id=
router.get('/', (req, res) => {
  const db = getDb();
  const { q = '', cliente_id } = req.query;
  let motos;
  if (cliente_id) {
    motos = db.prepare(`
      SELECT m.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
             COUNT(ot.id) as cant_ot
      FROM motos m
      JOIN clientes c ON c.id = m.cliente_id
      LEFT JOIN ordenes_trabajo ot ON ot.moto_id = m.id
      WHERE m.cliente_id = ?
      GROUP BY m.id
      ORDER BY m.patente
    `).all(Number(cliente_id));
  } else if (q.trim()) {
    const term = `%${q.trim().toUpperCase()}%`;
    motos = db.prepare(`
      SELECT m.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
             COUNT(ot.id) as cant_ot
      FROM motos m
      JOIN clientes c ON c.id = m.cliente_id
      LEFT JOIN ordenes_trabajo ot ON ot.moto_id = m.id
      WHERE m.patente LIKE ? OR UPPER(m.marca) LIKE ? OR UPPER(m.modelo) LIKE ?
         OR UPPER(c.nombre) LIKE ?
      GROUP BY m.id
      ORDER BY m.patente
      LIMIT 50
    `).all(term, term, term, `%${q.trim().toUpperCase()}%`);
  } else {
    motos = db.prepare(`
      SELECT m.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
             COUNT(ot.id) as cant_ot
      FROM motos m
      JOIN clientes c ON c.id = m.cliente_id
      LEFT JOIN ordenes_trabajo ot ON ot.moto_id = m.id
      GROUP BY m.id
      ORDER BY m.patente
      LIMIT 100
    `).all();
  }
  res.json(motos);
});

// GET /api/motos/patente/:patente  — lookup exacto por patente
router.get('/patente/:patente', (req, res) => {
  const db = getDb();
  const patente = req.params.patente.toUpperCase().replace(/\s+/g, '');
  const moto = db.prepare(`
    SELECT m.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.id as cliente_id
    FROM motos m
    JOIN clientes c ON c.id = m.cliente_id
    WHERE m.patente = ?
  `).get(patente);
  if (!moto) return res.status(404).json({ error: 'Moto no encontrada.' });

  // Últimas 3 OT
  const ots = db.prepare(`
    SELECT id, numero, estado, fecha_ingreso, problema_declarado
    FROM ordenes_trabajo WHERE moto_id = ? ORDER BY fecha_ingreso DESC LIMIT 3
  `).all(moto.id);

  res.json({ ...moto, ots_recientes: ots });
});

// POST /api/motos
router.post('/', (req, res) => {
  const { patente, marca = '', modelo = '', anio, color = '', cliente_id, notas = '' } = req.body;
  if (!patente?.trim()) return res.status(400).json({ error: 'La patente es requerida.' });
  if (!cliente_id) return res.status(400).json({ error: 'El cliente es requerido.' });

  const normalizada = patente.trim().toUpperCase().replace(/\s+/g, '');
  const db = getDb();
  const existe = db.prepare('SELECT id FROM motos WHERE patente = ?').get(normalizada);
  if (existe) return res.status(409).json({ error: `La patente ${normalizada} ya está registrada.` });

  const result = db.prepare(`
    INSERT INTO motos (patente, marca, modelo, anio, color, cliente_id, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(normalizada, marca, modelo, anio || null, color, Number(cliente_id), notas);

  const moto = db.prepare(`
    SELECT m.*, c.nombre as cliente_nombre FROM motos m
    JOIN clientes c ON c.id = m.cliente_id WHERE m.id = ?
  `).get(result.lastInsertRowid);
  res.json(moto);
});

// GET /api/motos/sugerencias?q=AB — prefijo para dropdown de patente
router.get('/sugerencias', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const db = getDb();
  const motos = db.prepare(`
    SELECT m.id, m.patente, m.marca, m.modelo, c.nombre as cliente_nombre
    FROM motos m JOIN clientes c ON c.id = m.cliente_id
    WHERE m.patente LIKE ?
    LIMIT 8
  `).all(`${q.toUpperCase()}%`);
  res.json(motos);
});

// GET /api/motos/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const moto = db.prepare(`
    SELECT m.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
    FROM motos m JOIN clientes c ON c.id = m.cliente_id WHERE m.id = ?
  `).get(Number(req.params.id));
  if (!moto) return res.status(404).json({ error: 'Moto no encontrada.' });

  const ots = db.prepare(`
    SELECT ot.*, mec.nombre as mecanico_nombre
    FROM ordenes_trabajo ot
    LEFT JOIN mecanicos mec ON mec.id = ot.mecanico_id
    WHERE ot.moto_id = ? ORDER BY ot.fecha_ingreso DESC
  `).all(moto.id);

  res.json({ ...moto, ordenes: ots });
});

// PATCH /api/motos/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const moto = db.prepare('SELECT id FROM motos WHERE id = ?').get(Number(req.params.id));
  if (!moto) return res.status(404).json({ error: 'Moto no encontrada.' });

  const { marca, modelo, anio, color, notas, cliente_id } = req.body;
  db.prepare(`
    UPDATE motos SET
      marca = COALESCE(?, marca),
      modelo = COALESCE(?, modelo),
      anio = COALESCE(?, anio),
      color = COALESCE(?, color),
      notas = COALESCE(?, notas),
      cliente_id = COALESCE(?, cliente_id),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(marca, modelo, anio, color, notas, cliente_id, Number(req.params.id));

  res.json(db.prepare(`
    SELECT m.*, c.nombre as cliente_nombre FROM motos m
    JOIN clientes c ON c.id = m.cliente_id WHERE m.id = ?
  `).get(Number(req.params.id)));
});

// DELETE /api/motos/:id  — cascade: elimina OTs (y su historial/presupuestos/pagos) y la moto
router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const moto = db.prepare('SELECT id FROM motos WHERE id = ?').get(id);
  if (!moto) return res.status(404).json({ error: 'Moto no encontrada.' });
  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM ordenes_trabajo WHERE moto_id = ?').run(id);
    db.prepare('DELETE FROM motos WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    return res.status(500).json({ error: 'Error al eliminar.' });
  }
  res.json({ ok: true });
});

module.exports = router;
