const express = require('express');
const router = express.Router();
const { getDb, generateOTNumber } = require('../database');

const ALL_ESTADOS = [
  'ingresada', 'en_diagnostico', 'presupuestada', 'aprobada',
  'en_reparacion', 'esperando_repuesto', 'lista', 'entregada', 'cancelada'
];

// GET /api/ordenes?estado=&mecanico_id=&q=&fecha_desde=&fecha_hasta=
router.get('/ordenes', (req, res) => {
  const db = getDb();
  const { estado, mecanico_id, q, fecha_desde, fecha_hasta } = req.query;

  let where = [];
  let params = [];

  // Mecánicos solo ven sus OT
  if (req.session.role === 'mecanico') {
    const mec = db.prepare('SELECT id FROM mecanicos WHERE LOWER(nombre) = LOWER(?) AND activo = 1').get(req.session.displayName);
    const mecId = mec?.id;
    if (mecId) { where.push('ot.mecanico_id = ?'); params.push(mecId); }
    else { return res.json([]); }
  } else if (mecanico_id) {
    where.push('ot.mecanico_id = ?'); params.push(Number(mecanico_id));
  }

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
    SELECT ot.*, m.patente, m.marca, m.modelo, m.color,
           c.nombre as cliente_nombre, c.telefono as cliente_telefono,
           mec.nombre as mecanico_nombre
    FROM ordenes_trabajo ot
    JOIN motos m ON m.id = ot.moto_id
    JOIN clientes c ON c.id = m.cliente_id
    LEFT JOIN mecanicos mec ON mec.id = ot.mecanico_id
    ${whereClause}
    ORDER BY
      CASE WHEN ot.estado = 'lista' THEN 0 ELSE 1 END,
      CASE WHEN ot.fecha_prometida IS NOT NULL AND ot.fecha_prometida < datetime('now') THEN 0 ELSE 1 END,
      ot.fecha_ingreso DESC
    LIMIT 200
  `).all(...params);

  res.json(ordenes);
});

// POST /api/ordenes
router.post('/ordenes', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const { moto_id, mecanico_id, km_ingreso = 0, problema_declarado = '', observaciones_internas = '', fecha_prometida, cedula, prioridad } = req.body;
  if (!moto_id) return res.status(400).json({ error: 'La moto es requerida.' });
  if (!cedula || !['fisica','digital'].includes(cedula)) return res.status(400).json({ error: 'Indicá si la cédula es física o digital.' });
  if (!prioridad || !['en_el_dia','manana','esta_semana','sin_apuro','fecha_especifica'].includes(prioridad)) return res.status(400).json({ error: 'Indicá el apuro del cliente.' });

  const db = getDb();
  const moto = db.prepare('SELECT id FROM motos WHERE id = ?').get(Number(moto_id));
  if (!moto) return res.status(404).json({ error: 'Moto no encontrada.' });

  const numero = generateOTNumber(db);

  let ordenId;
  try {
    db.exec('BEGIN');
    const result = db.prepare(`
      INSERT INTO ordenes_trabajo
        (numero, moto_id, mecanico_id, km_ingreso, problema_declarado, observaciones_internas, fecha_prometida, cedula, prioridad, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      numero, Number(moto_id), mecanico_id ? Number(mecanico_id) : null,
      Number(km_ingreso), problema_declarado, observaciones_internas,
      fecha_prometida || null, cedula, prioridad, req.session.userId
    );

    ordenId = result.lastInsertRowid;

    db.prepare(`
      INSERT INTO ot_estado_historial (orden_id, estado_anterior, estado_nuevo, cambiado_por, display_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(ordenId, '', 'ingresada', req.session.userId, req.session.displayName);

    db.exec('COMMIT');
  } catch (err) {
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
    SELECT estado, COUNT(*) as count FROM ordenes_trabajo
    WHERE estado NOT IN ('entregada','cancelada')
    GROUP BY estado
  `).all();

  const vencidas = db.prepare(`
    SELECT ot.id, ot.numero, ot.estado, ot.fecha_prometida,
           m.patente, m.marca, m.modelo,
           c.nombre as cliente_nombre,
           mec.nombre as mecanico_nombre,
           CAST((julianday('now') - julianday(ot.fecha_prometida)) AS INTEGER) as dias_retraso
    FROM ordenes_trabajo ot
    JOIN motos m ON m.id = ot.moto_id
    JOIN clientes c ON c.id = m.cliente_id
    LEFT JOIN mecanicos mec ON mec.id = ot.mecanico_id
    WHERE ot.fecha_prometida IS NOT NULL
      AND ot.fecha_prometida < datetime('now')
      AND ot.estado NOT IN ('entregada','cancelada')
    ORDER BY ot.fecha_prometida ASC
    LIMIT 20
  `).all();

  const listas = db.prepare(`
    SELECT ot.id, ot.numero, ot.fecha_ingreso,
           m.patente, m.marca, m.modelo,
           c.nombre as cliente_nombre, c.telefono as cliente_telefono
    FROM ordenes_trabajo ot
    JOIN motos m ON m.id = ot.moto_id
    JOIN clientes c ON c.id = m.cliente_id
    WHERE ot.estado = 'lista'
    ORDER BY ot.updated_at ASC
  `).all();

  res.json({ por_estado: porEstado, vencidas, listas });
});

// GET /api/ordenes/:id
router.get('/ordenes/:id', (req, res) => {
  const db = getDb();
  const ot = _getOTCompleta(db, Number(req.params.id));
  if (!ot) return res.status(404).json({ error: 'Orden no encontrada.' });
  res.json(ot);
});

// PATCH /api/ordenes/:id — editar campos generales
router.patch('/ordenes/:id', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const db = getDb();
  const { mecanico_id, fecha_prometida, km_ingreso, problema_declarado, observaciones_internas, prioridad } = req.body;
  db.prepare(`
    UPDATE ordenes_trabajo SET
      mecanico_id = COALESCE(?, mecanico_id),
      fecha_prometida = COALESCE(?, fecha_prometida),
      km_ingreso = COALESCE(?, km_ingreso),
      problema_declarado = COALESCE(?, problema_declarado),
      observaciones_internas = COALESCE(?, observaciones_internas),
      prioridad = COALESCE(?, prioridad),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(mecanico_id ?? null, fecha_prometida ?? null, km_ingreso ?? null,
         problema_declarado ?? null, observaciones_internas ?? null,
         prioridad ?? null, Number(req.params.id));

  const ot = _getOTCompleta(db, Number(req.params.id));
  req.app.locals.broadcast('ot_updated', ot);
  res.json(ot);
});

// PATCH /api/ordenes/:id/estado
router.patch('/ordenes/:id/estado', (req, res) => {
  const db = getDb();
  const { estado, notas = '' } = req.body;
  const id = Number(req.params.id);

  const ot = db.prepare('SELECT * FROM ordenes_trabajo WHERE id = ?').get(id);
  if (!ot) return res.status(404).json({ error: 'Orden no encontrada.' });

  // Mecánicos solo pueden cambiar sus propias OT
  if (req.session.role === 'mecanico') {
    const mec = db.prepare('SELECT id FROM mecanicos WHERE LOWER(nombre) = LOWER(?) AND activo = 1').get(req.session.displayName);
    if (!mec || ot.mecanico_id !== mec.id) return res.status(403).json({ error: 'Solo podés cambiar estados de tus propias órdenes.' });
  }

  if (!ALL_ESTADOS.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  try {
    db.exec('BEGIN');
    const extra = estado === 'entregada' ? ', fecha_entrega_real = datetime(\'now\')' : '';
    db.prepare(`UPDATE ordenes_trabajo SET estado = ?, updated_at = datetime('now')${extra} WHERE id = ?`).run(estado, id);
    db.prepare(`
      INSERT INTO ot_estado_historial (orden_id, estado_anterior, estado_nuevo, cambiado_por, display_name, notas)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, ot.estado, estado, req.session.userId, req.session.displayName, notas);
    db.exec('COMMIT');
  } catch (err) {
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
           m.patente, m.marca, m.modelo, m.color, m.anio,
           c.id as cliente_id, c.nombre as cliente_nombre,
           c.telefono as cliente_telefono, c.email as cliente_email,
           mec.nombre as mecanico_nombre
    FROM ordenes_trabajo ot
    JOIN motos m ON m.id = ot.moto_id
    JOIN clientes c ON c.id = m.cliente_id
    LEFT JOIN mecanicos mec ON mec.id = ot.mecanico_id
    WHERE ot.id = ?
  `).get(id);
  if (!ot) return null;

  ot.historial = db.prepare(`
    SELECT * FROM ot_estado_historial WHERE orden_id = ? ORDER BY created_at DESC
  `).all(id);

  ot.transiciones_validas = ALL_ESTADOS.filter(e => e !== ot.estado);

  return ot;
}

module.exports = router;
