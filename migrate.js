// ============================================================
//  MHFCS Database Migration Script
//  Run ONCE: node migrate.js
//  This adds missing columns to your existing database
//  WITHOUT deleting any of your data
// ============================================================

const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');

const DB_FILE = path.join(__dirname, 'mhfcs.db');

async function migrate() {
  console.log('\n🔧 MHFCS Database Migration Tool\n');

  if (!fs.existsSync(DB_FILE)) {
    console.log('❌ mhfcs.db not found in this folder.');
    console.log('   Make sure you run this from C:\\mhfcs\\');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const db  = new SQL.Database(fs.readFileSync(DB_FILE));

  // ── Helper: get existing columns of a table ──────────────
  function getColumns(table) {
    try {
      const stmt = db.prepare(`PRAGMA table_info(${table})`);
      const cols = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        cols.push(row.name);
      }
      stmt.free();
      return cols;
    } catch(e) {
      return [];
    }
  }
app.get('/', (req, res) => {
  res.send('MHFC Server is running successfully 🚀');
});
  // ── Helper: add column if missing ────────────────────────
  function addColIfMissing(table, col, type, defaultVal) {
    const cols = getColumns(table);
    if (!cols.includes(col)) {
      const def = defaultVal !== undefined ? ` DEFAULT '${defaultVal}'` : '';
      db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}${def}`);
      console.log(`  ✅ Added column: ${table}.${col}`);
    } else {
      console.log(`  ✓  Already exists: ${table}.${col}`);
    }
  }

  // ── Migrate certificates table ────────────────────────────
  console.log('📋 Checking certificates table...');
  const certCols = getColumns('certificates');

  if (certCols.length === 0) {
    // Table doesn't exist at all — create it fresh
    console.log('  Creating certificates table fresh...');
    db.run(`CREATE TABLE IF NOT EXISTS certificates (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      c_no       TEXT DEFAULT '',
      agent_name TEXT NOT NULL DEFAULT '',
      cf_agent   TEXT DEFAULT '',
      vessel     TEXT DEFAULT '',
      slip_no    TEXT DEFAULT '',
      cert_date  TEXT DEFAULT '',
      cargo      TEXT DEFAULT '',
      bundles    TEXT DEFAULT '',
      remarks    TEXT DEFAULT '',
      grand_cbm  REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } else {
    // Table exists — add any missing columns
    // If old column was called 'agent', copy data to 'agent_name'
    if (certCols.includes('agent') && !certCols.includes('agent_name')) {
      console.log('  📦 Found old "agent" column — migrating to "agent_name"...');
      db.run(`ALTER TABLE certificates ADD COLUMN agent_name TEXT DEFAULT ''`);
      db.run(`UPDATE certificates SET agent_name = agent WHERE agent_name = '' OR agent_name IS NULL`);
      console.log('  ✅ Copied agent → agent_name');
    } else {
      addColIfMissing('certificates', 'agent_name', 'TEXT', '');
    }

    addColIfMissing('certificates', 'c_no',       'TEXT', '');
    addColIfMissing('certificates', 'cf_agent',   'TEXT', '');
    addColIfMissing('certificates', 'vessel',     'TEXT', '');
    addColIfMissing('certificates', 'slip_no',    'TEXT', '');
    addColIfMissing('certificates', 'cert_date',  'TEXT', '');
    addColIfMissing('certificates', 'cargo',      'TEXT', '');
    addColIfMissing('certificates', 'bundles',    'TEXT', '');
    addColIfMissing('certificates', 'remarks',    'TEXT', '');
    addColIfMissing('certificates', 'grand_cbm',  'REAL DEFAULT 0', undefined);
    addColIfMissing('certificates', 'created_at', 'TEXT', '');
  }

  // ── Migrate agents table ──────────────────────────────────
  console.log('\n👤 Checking agents table...');
  const agentCols = getColumns('agents');
  if (agentCols.length === 0) {
    db.run(`CREATE TABLE IF NOT EXISTS agents (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL UNIQUE,
      cf_agent   TEXT DEFAULT '',
      vessel     TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    console.log('  ✅ Created agents table');
  } else {
    addColIfMissing('agents', 'agent_name', 'TEXT', '');
    addColIfMissing('agents', 'cf_agent',   'TEXT', '');
    addColIfMissing('agents', 'vessel',     'TEXT', '');
    addColIfMissing('agents', 'created_at', 'TEXT', '');
  }

  // ── Migrate measurement_rows table ────────────────────────
  console.log('\n📐 Checking measurement_rows table...');
  const rowCols = getColumns('measurement_rows');
  if (rowCols.length === 0) {
    db.run(`CREATE TABLE IF NOT EXISTS measurement_rows (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_id INTEGER NOT NULL,
      row_order      INTEGER DEFAULT 0,
      marks          TEXT,
      number         TEXT,
      length_m       REAL,
      breadth_m      REAL,
      depth_m        REAL,
      total_cbm      REAL,
      row_remarks    TEXT
    )`);
    console.log('  ✅ Created measurement_rows table');
  } else {
    addColIfMissing('measurement_rows', 'row_order',   'INTEGER', '0');
    addColIfMissing('measurement_rows', 'marks',       'TEXT', '');
    addColIfMissing('measurement_rows', 'number',      'TEXT', '');
    addColIfMissing('measurement_rows', 'length_m',    'REAL', '');
    addColIfMissing('measurement_rows', 'breadth_m',   'REAL', '');
    addColIfMissing('measurement_rows', 'depth_m',     'REAL', '');
    addColIfMissing('measurement_rows', 'total_cbm',   'REAL', '');
    // Handle old 'remarks' column renamed to 'row_remarks'
    if (rowCols.includes('remarks') && !rowCols.includes('row_remarks')) {
      db.run(`ALTER TABLE measurement_rows ADD COLUMN row_remarks TEXT DEFAULT ''`);
      db.run(`UPDATE measurement_rows SET row_remarks = remarks`);
      console.log('  ✅ Copied remarks → row_remarks');
    } else {
      addColIfMissing('measurement_rows', 'row_remarks', 'TEXT', '');
    }
  }

  // ── Count existing records ────────────────────────────────
  console.log('\n📊 Your data summary:');
  try {
    const agents = db.prepare('SELECT COUNT(*) as n FROM agents').getAsObject();
    const certs  = db.prepare('SELECT COUNT(*) as n FROM certificates').getAsObject();
    const rows   = db.prepare('SELECT COUNT(*) as n FROM measurement_rows').getAsObject();
    console.log(`  Agents:            ${agents.n}`);
    console.log(`  Certificates:      ${certs.n}`);
    console.log(`  Measurement rows:  ${rows.n}`);
  } catch(e) {
    console.log('  (Could not count records)');
  }

  // ── Save ──────────────────────────────────────────────────
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
  console.log('\n✅ Migration complete! Your data is safe.');
  console.log('   Now run: node cert-server.js\n');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
