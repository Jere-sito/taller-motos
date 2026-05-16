const express = require('express');
const router = express.Router();
const { getDb, generateOTNumber } = require('../database');

const ALL_ESTADOS = ['recibida', 'en_reparacion', 'entregada'];
const TRANSICIONES = {
  recibida:      ['en_reparacion'],
  en_reparacion: ['entregada', 'recibida'],
  entregada:     ['en_reparacion']
};

// GET /api/ordenes
router.get('/ordenes', (req, res) => {
  const db = getDb();
  const { estado, q, fecha_desde, fecha_hasta } = req.query;

  let where = [];
  let params = [];

  if (estado) { where.push('ot.estado = ?'); params.push(estado); }
  if (q?.trim()) {
    where.push('(m.patente LIKE ? OR UPPER(c.nombre) LIKE ? OR ot.numero LIKE ?)');
    const t = `%${q.trim().toUpperCase()}%`;
    params.push(t, t, t);
  }
  if (fecha_desde) { where.push('ot.fecha_ingreso >= ?'); params.push(fecha_desde); }
  if (fecha_hasta) { where.push('ot.fecha_ingreso <= ?'); params.push(fecha_hasta + ' 23:59:59'); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const ordenes = db.prepare(`
    SELECT ot.id, ot.numero, ot.estado, ot.fecha_ingreso, ot.fecha_prometida, ot.prioridad,
           m.patente, m.marca, m.modelo,
           c.nombre as cliente_nombre, c.telefono as cliente_telefono
    FROM ordenes_trabajo ot
    JOIN motos m ON m.id = ot.moto_id
    JOIN clientes c ON c.id = m.cliente_id
    ${whereClause}
    ORDER BY ot.fecha_ingreso DESC
    LIMIT 200
  `).all(...params);

  res.json(ordenes);
});

// POST /api/ordenes
router.post('/ordenes', (req, res) => {
  const { moto_id, problema_declarado = '', observaciones_internas = '', fecha_prometida, cedula, prioridad, fecha_ingreso } = req.body;
  if (!moto_id) return res.status(400).json({ error: 'La moto es requerida.' });
  if (!cedula || !['fisica','digital'].includes(cedula.toLowerCase())) return res.status(400).json({ error: 'Indicá si la cédula es física o digital.' });
  if (!prioridad || !['en_el_dia','manana','esta_semana','sin_apuro','fecha_especifica'].includes(prioridad.toLowerCase())) return res.status(400).json({ error: 'Indicá el apuro del cliente.' });

  const db = getDb();
  const moto = db.prepare('SELECT id FROM motos WHERE id = ?').get(Number(moto_id));
  if (!moto) return res.status(404).json({ error: 'Moto no encontrada.' });

  const numero = generateOTNumber(db);

  let ordenId;
  try {
    db.exec('BEGIN');
    const result = db.prepare(`
      INSERT INTO ordenes_trabajo
        (numero, moto_id, problema_declarado, observaciones_internas, fecha_ingreso, fecha_prometida, cedula, prioridad, created_by)
      VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?)
    `).run(
      numero, Number(moto_id),
      problema_declarado, observaciones_internas,
      fecha_ingreso || null, fecha_prometida || null, cedula.toLowerCase(), prioridad.toLowerCase(), req.session.userId
    );

    ordenId = result.lastInsertRowid;

    db.prepare(`
      INSERT INTO ot_estado_historial (orden_id, estado_anterior, estado_nuevo, cambiado_por, display_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(ordenId, '', 'recibida', req.session.userId, req.session.displayName);

    db.prepare(`INSERT INTO presupuestos (orden_id) VALUES (?)`).run(ordenId);

    db.exec('COMMIT');
  } catch (err) {
    console.error('[ordenes] crear orden:', err);
    try { db.exec('ROLLBACK'); } catch (_) {}
    return res.status(500).json({ error: 'Error al crear la orden.' });
  }

  const ot = _getOTCompleta(db, ordenId);
  try { req.app.locals.broadcast('ot_created', ot); } catch (_) {}
  res.json(ot);
});

// GET /api/ordenes/dashboard
router.get('/ordenes/dashboard', (req, res) => {
  const db = getDb();
  const porEstado = db.prepare(`
    SELECT estado, COUNT(*) as count FROM ordenes_trabajo GROUP BY estado
  `).all();
  res.json({ por_estado: porEstado });
});

// GET /api/ordenes/:id
router.get('/ordenes/:id', (req, res) => {
  const db = getDb();
  const ot = _getOTCompleta(db, Number(req.params.id));
  if (!ot) return res.status(404).json({ error: 'Orden no encontrada.' });
  res.json(ot);
});

// PATCH /api/ordenes/:id
router.patch('/ordenes/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { fecha_prometida, problema_declarado, observaciones_internas, prioridad } = req.body;

  db.prepare(`
    UPDATE ordenes_trabajo SET
      fecha_prometida = ?,
      problema_declarado = ?,
      observaciones_internas = ?,
      prioridad = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    fecha_prometida || null,
    problema_declarado ?? '',
    observaciones_internas ?? '',
    prioridad || null,
    id
  );

  const ot = _getOTCompleta(db, id);
  try { req.app.locals.broadcast('ot_updated', ot); } catch (_) {}
  res.json(ot);
});

// PATCH /api/ordenes/:id/estado
router.patch('/ordenes/:id/estado', (req, res) => {
  const db = getDb();
  const { estado } = req.body;
  const id = Number(req.params.id);

  const ot = db.prepare('SELECT * FROM ordenes_trabajo WHERE id = ?').get(id);
  if (!ot) return res.status(404).json({ error: 'Orden no encontrada.' });
  if (!ALL_ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });

  const posibles = TRANSICIONES[ot.estado] || [];
  if (!posibles.includes(estado)) {
    return res.status(400).json({ error: `No se puede pasar de "${ot.estado}" a "${estado}".` });
  }

  try {
    db.exec('BEGIN');
    const extra = estado === 'entregada' ? `, fecha_entrega_real = datetime('now')` : '';
    db.prepare(`UPDATE ordenes_trabajo SET estado = ?, updated_at = datetime('now')${extra} WHERE id = ?`).run(estado, id);
    db.prepare(`
      INSERT INTO ot_estado_historial (orden_id, estado_anterior, estado_nuevo, cambiado_por, display_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, ot.estado, estado, req.session.userId, req.session.displayName);
    db.exec('COMMIT');
  } catch (err) {
    console.error('[ordenes] cambiar estado:', err);
    try { db.exec('ROLLBACK'); } catch (_) {}
    return res.status(500).json({ error: 'Error al cambiar el estado.' });
  }

  const otActualizada = _getOTCompleta(db, id);
  try { req.app.locals.broadcast('ot_updated', otActualizada); } catch (_) {}
  res.json(otActualizada);
});

function _getOTCompleta(db, id) {
  const ot = db.prepare(`
    SELECT ot.*,
           m.patente, m.marca, m.modelo, m.color,
           c.id as cliente_id, c.nombre as cliente_nombre,
           c.telefono as cliente_telefono, c.email as cliente_email
    FROM ordenes_trabajo ot
    JOIN motos m ON m.id = ot.moto_id
    JOIN clientes c ON c.id = m.cliente_id
    WHERE ot.id = ?
  `).get(id);
  if (!ot) return null;

  ot.transiciones_validas = TRANSICIONES[ot.estado] || [];
  return ot;
}

module.exports = router;
