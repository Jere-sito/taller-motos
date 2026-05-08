const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/ordenes/:id/presupuesto
router.get('/ordenes/:id/presupuesto', (req, res) => {
  const db = getDb();
  const pres = db.prepare('SELECT * FROM presupuestos WHERE orden_id = ?').get(Number(req.params.id));
  if (!pres) return res.status(404).json({ error: 'Sin presupuesto aún.' });
  pres.items = db.prepare('SELECT * FROM presupuesto_items WHERE presupuesto_id = ? ORDER BY orden_pos, id').all(pres.id);
  res.json(pres);
});

// POST /api/ordenes/:id/presupuesto — crear presupuesto vacío
router.post('/ordenes/:id/presupuesto', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const db = getDb();
  const existe = db.prepare('SELECT id FROM presupuestos WHERE orden_id = ?').get(Number(req.params.id));
  if (existe) return res.status(409).json({ error: 'Ya existe un presupuesto para esta orden.' });

  const result = db.prepare('INSERT INTO presupuestos (orden_id) VALUES (?)').run(Number(req.params.id));
  const pres = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get(result.lastInsertRowid);
  pres.items = [];
  res.json(pres);
});

// PATCH /api/presupuestos/:id
router.patch('/presupuestos/:id', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const db = getDb();
  const { estado, descuento, notas_cliente, aprobado_por } = req.body;

  const pres = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get(Number(req.params.id));
  if (!pres) return res.status(404).json({ error: 'Presupuesto no encontrado.' });

  const aprobado_at = estado === 'aprobado' && pres.estado !== 'aprobado' ? `datetime('now')` : null;

  db.prepare(`
    UPDATE presupuestos SET
      estado = COALESCE(?, estado),
      descuento = COALESCE(?, descuento),
      notas_cliente = COALESCE(?, notas_cliente),
      aprobado_por = COALESCE(?, aprobado_por),
      aprobado_at = CASE WHEN ? IS NOT NULL THEN datetime('now') ELSE aprobado_at END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(estado ?? null, descuento ?? null, notas_cliente ?? null, aprobado_por ?? null,
         (estado === 'aprobado' && pres.estado !== 'aprobado') ? 1 : null,
         Number(req.params.id));

  const actualizado = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get(Number(req.params.id));
  actualizado.items = db.prepare('SELECT * FROM presupuesto_items WHERE presupuesto_id = ? ORDER BY orden_pos, id').all(actualizado.id);
  res.json(actualizado);
});

// POST /api/presupuestos/:id/items
router.post('/presupuestos/:id/items', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const { tipo, descripcion, cantidad = 1, precio_unitario = 0, husky_item_id, husky_item_ref = '' } = req.body;
  if (!['repuesto', 'mano_obra'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });
  if (!descripcion?.trim()) return res.status(400).json({ error: 'La descripción es requerida.' });

  const db = getDb();
  const pres = db.prepare('SELECT id FROM presupuestos WHERE id = ?').get(Number(req.params.id));
  if (!pres) return res.status(404).json({ error: 'Presupuesto no encontrado.' });

  const maxPos = db.prepare('SELECT MAX(orden_pos) as m FROM presupuesto_items WHERE presupuesto_id = ?').get(pres.id);
  const orden_pos = (maxPos?.m ?? -1) + 1;

  const result = db.prepare(`
    INSERT INTO presupuesto_items
      (presupuesto_id, tipo, descripcion, cantidad, precio_unitario, husky_item_id, husky_item_ref, orden_pos)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pres.id, tipo, descripcion.trim(), Number(cantidad), Number(precio_unitario),
         husky_item_id || null, husky_item_ref, orden_pos);

  res.json(db.prepare('SELECT * FROM presupuesto_items WHERE id = ?').get(result.lastInsertRowid));
});

// PATCH /api/presupuestos/:id/items/:itemId
router.patch('/presupuestos/:id/items/:itemId', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const db = getDb();
  const { tipo, descripcion, cantidad, precio_unitario } = req.body;
  if (tipo && !['repuesto', 'mano_obra'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });
  db.prepare(`
    UPDATE presupuesto_items SET
      tipo = COALESCE(?, tipo),
      descripcion = COALESCE(?, descripcion),
      cantidad = COALESCE(?, cantidad),
      precio_unitario = COALESCE(?, precio_unitario)
    WHERE id = ? AND presupuesto_id = ?
  `).run(tipo ?? null, descripcion ?? null, cantidad ?? null, precio_unitario ?? null,
         Number(req.params.itemId), Number(req.params.id));
  res.json(db.prepare('SELECT * FROM presupuesto_items WHERE id = ?').get(Number(req.params.itemId)));
});

// DELETE /api/presupuestos/:id/items/:itemId
router.delete('/presupuestos/:id/items/:itemId', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const db = getDb();
  db.prepare('DELETE FROM presupuesto_items WHERE id = ? AND presupuesto_id = ?').run(
    Number(req.params.itemId), Number(req.params.id)
  );
  res.json({ ok: true });
});

// POST /api/presupuestos/:id/items/reorder
router.post('/presupuestos/:id/items/reorder', (req, res) => {
  const { orden } = req.body; // [{id, orden_pos}]
  if (!Array.isArray(orden)) return res.status(400).json({ error: 'Se esperaba un array.' });
  const db = getDb();
  const stmt = db.prepare('UPDATE presupuesto_items SET orden_pos = ? WHERE id = ? AND presupuesto_id = ?');
  for (const { id, orden_pos } of orden) stmt.run(Number(orden_pos), Number(id), Number(req.params.id));
  res.json({ ok: true });
});

// GET /api/presupuestos/:id/whatsapp — genera texto del mensaje
router.get('/presupuestos/:id/whatsapp', (req, res) => {
  const db = getDb();
  const pres = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get(Number(req.params.id));
  if (!pres) return res.status(404).json({ error: 'Presupuesto no encontrado.' });

  const ot = db.prepare(`
    SELECT ot.numero, m.patente, m.marca, m.modelo, c.nombre as cliente_nombre
    FROM ordenes_trabajo ot
    JOIN motos m ON m.id = ot.moto_id
    JOIN clientes c ON c.id = m.cliente_id
    WHERE ot.id = ?
  `).get(pres.orden_id);

  const items = db.prepare('SELECT * FROM presupuesto_items WHERE presupuesto_id = ? ORDER BY orden_pos, id').all(pres.id);

  const fmt = n => '$' + Math.round(n).toLocaleString('es-AR');

  const repuestos = items.filter(i => i.tipo === 'repuesto');
  const manoObra  = items.filter(i => i.tipo === 'mano_obra');

  const subtotalRep = repuestos.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const subtotalMO  = manoObra.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const subtotal = subtotalRep + subtotalMO;
  const descuentoMonto = (subtotal * (pres.descuento || 0)) / 100;
  const total = subtotal - descuentoMonto;

  let lineas = [];
  lineas.push(`*PRESUPUESTO ${ot.numero}*`);
  lineas.push(`Moto: ${ot.marca} ${ot.modelo} (${ot.patente})`);
  lineas.push(`Cliente: ${ot.cliente_nombre}`);

  if (repuestos.length) {
    lineas.push('');
    lineas.push('🔩 *REPUESTOS:*');
    for (const item of repuestos) {
      lineas.push(`- ${item.descripcion} x${item.cantidad} - ${fmt(item.cantidad * item.precio_unitario)}`);
    }
    if (manoObra.length) lineas.push(`*Subtotal: ${fmt(subtotalRep)}*`);
  }

  if (manoObra.length) {
    lineas.push('');
    lineas.push('🔧 *MANO DE OBRA:*');
    for (const item of manoObra) {
      lineas.push(`- ${item.descripcion} - ${fmt(item.cantidad * item.precio_unitario)}`);
    }
    if (repuestos.length) lineas.push(`*Subtotal: ${fmt(subtotalMO)}*`);
  }

  lineas.push('');
  if (pres.descuento > 0) {
    lineas.push(`Subtotal general: ${fmt(subtotal)}`);
    lineas.push(`Descuento (${pres.descuento}%): -${fmt(descuentoMonto)}`);
  }
  lineas.push(`*TOTAL: ${fmt(total)}*`);
  if (pres.notas_cliente) { lineas.push(''); lineas.push(pres.notas_cliente); }

  res.json({ texto: lineas.join('\n'), total, subtotal });
});

module.exports = router;
