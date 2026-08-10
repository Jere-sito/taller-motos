const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/admin/stats?desde=&hasta=
router.get('/stats', (req, res) => {
  const db = getDb();
  const { desde, hasta } = req.query;
  let where = '';
  const params = [];
  if (desde) { where += ' AND ot.fecha_ingreso >= ?'; params.push(desde); }
  if (hasta) { where += ' AND ot.fecha_ingreso <= ?'; params.push(hasta + ' 23:59:59'); }

  const totales = db.prepare(`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN estado = 'entregada' THEN 1 END) as entregadas,
           COUNT(CASE WHEN estado = 'cancelada' THEN 1 END) as canceladas,
           AVG(CASE WHEN estado = 'entregada' AND fecha_entrega_real IS NOT NULL
               THEN julianday(fecha_entrega_real) - julianday(fecha_ingreso) END) as promedio_dias
    FROM ordenes_trabajo ot WHERE 1=1 ${where}
  `).get(...params);

  const porMecanico = db.prepare(`
    SELECT mec.nombre, COUNT(ot.id) as total,
           COUNT(CASE WHEN ot.estado = 'entregada' THEN 1 END) as entregadas
    FROM mecanicos mec
    LEFT JOIN ordenes_trabajo ot ON ot.mecanico_id = mec.id AND 1=1 ${where}
    WHERE mec.activo = 1
    GROUP BY mec.id ORDER BY total DESC
  `).all(...params);

  res.json({ totales, por_mecanico: porMecanico });
});

// GET /api/admin/facturacion?desde=&hasta= — solo lectura
router.get('/facturacion', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });

  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).json({ error: 'Los parámetros desde y hasta son requeridos.' });

  const db = getDb();
  const filas = db.prepare(`
    SELECT
      o.id as orden_id,
      date(o.fecha_entrega_real) as fecha,
      COALESCE(p.descuento, 0) as descuento,
      COALESCE(SUM(CASE WHEN pi.tipo = 'mano_obra' THEN pi.cantidad * pi.precio_unitario ELSE 0 END), 0) as bruto_mano_obra,
      COALESCE(SUM(CASE WHEN pi.tipo = 'repuesto'  THEN pi.cantidad * pi.precio_unitario ELSE 0 END), 0) as bruto_repuestos
    FROM ordenes_trabajo o
    LEFT JOIN presupuestos p ON p.orden_id = o.id
    LEFT JOIN presupuesto_items pi ON pi.presupuesto_id = p.id
    WHERE o.estado = 'entregada'
      AND o.fecha_entrega_real >= ?
      AND o.fecha_entrega_real <= ?
    GROUP BY o.id
  `).all(desde, hasta + ' 23:59:59');

  const porDia = new Map();
  for (const fila of filas) {
    const factor = 1 - (fila.descuento || 0) / 100;
    const manoObra = fila.bruto_mano_obra * factor;
    const repuestos = fila.bruto_repuestos * factor;

    if (!porDia.has(fila.fecha)) {
      porDia.set(fila.fecha, { fecha: fila.fecha, mano_obra: 0, repuestos: 0, cantidad_ordenes: 0 });
    }
    const acc = porDia.get(fila.fecha);
    acc.mano_obra += manoObra;
    acc.repuestos += repuestos;
    acc.cantidad_ordenes += 1;
  }

  const dias = Array.from(porDia.values())
    .map(d => ({ ...d, mano_obra: Math.round(d.mano_obra), repuestos: Math.round(d.repuestos) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  res.json({ dias });
});

module.exports = router;
