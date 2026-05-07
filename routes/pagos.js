const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

const MEDIOS = ['efectivo','mercadopago','puente','credito','debito'];
const MEDIO_LABELS = {
  efectivo: 'Efectivo',
  mercadopago: 'Transferencia MercadoPago',
  puente: 'Transferencia Puente',
  credito: 'Tarjeta de crédito',
  debito: 'Tarjeta de débito'
};

// GET /api/ordenes/:id/pagos
router.get('/ordenes/:id/pagos', (req, res) => {
  const db = getDb();
  const pagos = db.prepare(
    'SELECT * FROM pagos WHERE orden_id = ? ORDER BY created_at DESC'
  ).all(Number(req.params.id));
  res.json(pagos);
});

// POST /api/ordenes/:id/pagos
router.post('/ordenes/:id/pagos', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const db = getDb();
  const id = Number(req.params.id);
  const ot = db.prepare('SELECT id FROM ordenes_trabajo WHERE id = ?').get(id);
  if (!ot) return res.status(404).json({ error: 'Orden no encontrada.' });

  const { medio, proveedor = '', monto, notas = '' } = req.body;
  if (!MEDIOS.includes(medio)) return res.status(400).json({ error: 'Medio de pago inválido.' });
  if (medio === 'puente' && !proveedor.trim()) return res.status(400).json({ error: 'Indicá el proveedor de la transferencia puente.' });
  if (!monto || Number(monto) <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });

  const result = db.prepare(
    'INSERT INTO pagos (orden_id, medio, proveedor, monto, notas) VALUES (?, ?, ?, ?, ?)'
  ).run(id, medio, proveedor.trim(), Number(monto), notas.trim());

  res.json(db.prepare('SELECT * FROM pagos WHERE id = ?').get(result.lastInsertRowid));
});

// DELETE /api/ordenes/:id/pagos/:pagoId
router.delete('/ordenes/:id/pagos/:pagoId', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });
  const db = getDb();
  const pago = db.prepare('SELECT * FROM pagos WHERE id = ? AND orden_id = ?')
    .get(Number(req.params.pagoId), Number(req.params.id));
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado.' });
  db.prepare('DELETE FROM pagos WHERE id = ?').run(pago.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.MEDIO_LABELS = MEDIO_LABELS;
