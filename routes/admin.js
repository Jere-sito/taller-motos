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

module.exports = router;
