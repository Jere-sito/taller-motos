require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// SSE broadcast bus
const sseClients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(payload); } catch (_) { sseClients.delete(client); }
  });
}
app.locals.broadcast = broadcast;

// Multer para fotos de motos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ot-${req.params.id}-${Date.now()}${ext}`);
  }
});
app.locals.upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// Sesión simulada con usuario de desarrollo (auth deshabilitada)
app.use((req, _res, next) => {
  req.session = { userId: 1, username: 'dev', displayName: 'Desarrollo', role: 'admin' };
  next();
});

app.use(express.json());

app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Páginas
app.get('/',          (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/ordenes',   (_req, res) => res.sendFile(path.join(__dirname, 'public', 'ordenes.html')));
app.get('/ot-detalle',(_req, res) => res.sendFile(path.join(__dirname, 'public', 'ot-detalle.html')));
app.get('/clientes',  (_req, res) => res.sendFile(path.join(__dirname, 'public', 'clientes.html')));
app.get('/motos',     (_req, res) => res.sendFile(path.join(__dirname, 'public', 'motos.html')));
app.get('/mecanicos', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'mecanicos.html')));
app.get('/usuarios',  (_req, res) => res.sendFile(path.join(__dirname, 'public', 'usuarios.html')));
app.get('/login',     (_req, res) => res.redirect('/'));

// SSE
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { clearInterval(ping); }
  }, 25000);
  sseClients.add(res);
  req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
});

// Backup
app.get('/api/backup', (req, res) => {
  const dbPath = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'taller.db');
  const date = new Date().toISOString().slice(0, 10);
  res.download(dbPath, `taller-backup-${date}.db`);
});

// API auth — /me siempre devuelve usuario de desarrollo
app.get('/api/auth/me', (_req, res) => {
  res.json({ userId: 1, username: 'dev', displayName: 'Desarrollo', role: 'admin', mecanico_id: null });
});
app.get('/api/auth/status', (_req, res) => {
  res.json({ hasUsers: true, loggedIn: true, displayName: 'Desarrollo', role: 'admin' });
});
app.post('/api/auth/logout', (_req, res) => res.json({ ok: true }));

// Rutas API
app.use('/api/clientes',  require('./routes/clientes'));
app.use('/api/motos',     require('./routes/motos'));
app.use('/api/mecanicos', require('./routes/mecanicos'));
app.use('/api',           require('./routes/ordenes'));
app.use('/api',           require('./routes/presupuestos'));
app.use('/api/husky',     require('./routes/husky'));
app.use('/api/admin',     require('./routes/admin'));

getDb();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Taller Motos corriendo en http://localhost:${PORT}`);
  console.log('⚠️  Autenticación deshabilitada — modo desarrollo');
});
