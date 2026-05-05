const express = require('express');
const router = express.Router();

// GET /api/husky/search?q=
router.get('/search', async (req, res) => {
  const huskyUrl = process.env.HUSKY_URL || 'http://localhost:3000';
  const q = req.query.q || '';
  if (!q.trim()) return res.json([]);
  try {
    const r = await fetch(`${huskyUrl}/api/search?q=${encodeURIComponent(q)}`);
    if (!r.ok) return res.json([]);
    res.json(await r.json());
  } catch {
    res.json([]);
  }
});

module.exports = router;
