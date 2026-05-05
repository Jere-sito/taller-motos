const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'taller.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      role TEXT DEFAULT 'recepcion' CHECK(role IN ('admin','mecanico','recepcion')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mecanicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT DEFAULT '',
      especialidad TEXT DEFAULT '',
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT DEFAULT '',
      email TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS motos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patente TEXT NOT NULL UNIQUE,
      marca TEXT DEFAULT '',
      modelo TEXT DEFAULT '',
      anio INTEGER,
      color TEXT DEFAULT '',
      cliente_id INTEGER NOT NULL,
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS ordenes_trabajo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      moto_id INTEGER NOT NULL,
      mecanico_id INTEGER,
      estado TEXT DEFAULT 'ingresada' CHECK(estado IN (
        'ingresada','en_diagnostico','presupuestada','aprobada',
        'en_reparacion','esperando_repuesto','lista','entregada','cancelada'
      )),
      fecha_ingreso TEXT DEFAULT (datetime('now')),
      km_ingreso INTEGER DEFAULT 0,
      problema_declarado TEXT DEFAULT '',
      observaciones_internas TEXT DEFAULT '',
      fecha_prometida TEXT,
      fecha_entrega_real TEXT,
      created_by INTEGER,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (moto_id) REFERENCES motos(id) ON DELETE RESTRICT,
      FOREIGN KEY (mecanico_id) REFERENCES mecanicos(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ot_estado_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orden_id INTEGER NOT NULL,
      estado_anterior TEXT NOT NULL,
      estado_nuevo TEXT NOT NULL,
      cambiado_por INTEGER,
      display_name TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
      FOREIGN KEY (cambiado_por) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ot_fotos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orden_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT DEFAULT '',
      mimetype TEXT DEFAULT '',
      size_bytes INTEGER DEFAULT 0,
      uploaded_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orden_id INTEGER NOT NULL UNIQUE,
      estado TEXT DEFAULT 'borrador' CHECK(estado IN ('borrador','presentado','aprobado','rechazado')),
      descuento REAL DEFAULT 0,
      notas_cliente TEXT DEFAULT '',
      aprobado_por TEXT DEFAULT '',
      aprobado_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS presupuesto_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presupuesto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('repuesto','mano_obra')),
      descripcion TEXT NOT NULL,
      cantidad REAL DEFAULT 1,
      precio_unitario REAL DEFAULT 0,
      husky_item_id INTEGER,
      husky_item_ref TEXT DEFAULT '',
      orden_pos INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE
    );
  `);

  // Índices
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(LOWER(nombre))`); } catch (_) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono)`); } catch (_) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_motos_cliente ON motos(cliente_id)`); } catch (_) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_ot_moto ON ordenes_trabajo(moto_id)`); } catch (_) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_ot_mecanico ON ordenes_trabajo(mecanico_id)`); } catch (_) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_ot_estado ON ordenes_trabajo(estado)`); } catch (_) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_ot_fecha_prometida ON ordenes_trabajo(fecha_prometida)`); } catch (_) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_presupuesto_items ON presupuesto_items(presupuesto_id)`); } catch (_) {}
}

function generateOTNumber(db) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `OT-${today}-`;
  const last = db.prepare(
    "SELECT numero FROM ordenes_trabajo WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1"
  ).get(prefix + '%');
  const lastN = last ? parseInt(last.numero.split('-')[2]) : 0;
  return `${prefix}${String(lastN + 1).padStart(3, '0')}`;
}

module.exports = { getDb, generateOTNumber };
