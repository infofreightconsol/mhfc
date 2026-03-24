// ============================================================
//  MHFCS Certificate System — Express + sql.js
//  Run: node cert-server.js  →  http://localhost:PORT
// ============================================================
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const initSqlJs = require('sql.js');
const os        = require('os');

const app     = express();
const PORT    = process.env.PORT || 4000;  // Use Render's assigned port or 4000 locally
const DB_FILE = path.join(__dirname, 'mhfcs.db');

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.options('*', cors());
app.use(express.json());

// Serve all your static frontend files (HTML, CSS, JS) from current directory
app.use(express.static(__dirname));

// DB and utility functions (no change here)
let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
    console.log('✅ Loaded existing database: mhfcs.db');
  } else {
    db = new SQL.Database();
    console.log('✅ Created new database: mhfcs.db');
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS agents (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL UNIQUE,
      cf_agent   TEXT DEFAULT '',
      vessel     TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS certificates (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      c_no       TEXT DEFAULT '',
      agent      TEXT NOT NULL DEFAULT '',
      cf_agent   TEXT DEFAULT '',
      vessel     TEXT DEFAULT '',
      slip_no    TEXT DEFAULT '',
      cert_date  TEXT DEFAULT '',
      cargo      TEXT DEFAULT '',
      bundles    TEXT DEFAULT '',
      remarks    TEXT DEFAULT '',
      grand_cbm  REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS measurement_rows (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_id INTEGER NOT NULL,
      row_order      INTEGER DEFAULT 0,
      marks          TEXT,
      number         TEXT,
      length_m       REAL,
      breadth_m      REAL,
      depth_m        REAL,
      total_cbm      REAL,
      remarks        TEXT
    );
  `);
  saveDB();
  seedUsers();
  console.log('✅ Tables ready.');
}

function saveDB() { fs.writeFileSync(DB_FILE, Buffer.from(db.export())); }

function queryAll(sql, params=[]) {
  const stmt = db.prepare(sql); stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free(); return rows;
}
function queryOne(sql, params=[]) { return queryAll(sql,params)[0]||null; }

// ── SEED DEFAULT USERS ───────────────────────────────────────
function seedUsers() {
  const existing = queryOne('SELECT COUNT(*) as n FROM users');
  if (existing && existing.n > 0) return;
  db.run("INSERT INTO users (username,password,role) VALUES (?,?,?)", ['administrator','@dm!n@2026','superadmin']);
  db.run("INSERT INTO users (username,password,role) VALUES (?,?,?)", ['MHFC','Mhfc@321','user']);
  saveDB();
  console.log('✅ Default users created.');
}

// ── LOGIN ────────────────────────────────────────────────────
app.post('/api/login', (req,res) => {
  const {username, password} = req.body;
  const user = queryOne('SELECT * FROM users WHERE username=? AND password=?', [username, password]);
  if (user) {
    res.json({ success: true, role: user.role, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// ── USER MANAGEMENT (superadmin only) ────────────────────────
app.get('/api/users', (req,res) => {
  const users = queryAll('SELECT id,username,password,role,created_at FROM users ORDER BY id ASC');
  res.json(users);
});

app.post('/api/users', (req,res) => {
  const {username, password, role} = req.body;
  if (!username || !password) return res.status(400).json({error:'Username and password are required.'});
  if (!['superadmin','user'].includes(role)) return res.status(400).json({error:'Role must be superadmin or user.'});
  try {
    db.run('INSERT INTO users (username,password,role) VALUES (?,?,?)', [username.trim(), password, role||'user']);
    const id = queryOne('SELECT last_insert_rowid() as id').id;
    saveDB();
    res.status(201).json({success:true, id});
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({error:'Username already exists.'});
    res.status(500).json({error:e.message});
  }
});

app.put('/api/users/:id', (req,res) => {
  const {username, password, role} = req.body;
  if (!username) return res.status(400).json({error:'Username is required.'});
  const u = queryOne('SELECT * FROM users WHERE id=?',[req.params.id]);
  if (!u) return res.status(404).json({error:'User not found.'});
  if (u.username === 'administrator' && username !== 'administrator')
    return res.status(403).json({error:'Cannot change administrator username.'});
  const newPass = password && password.trim() ? password : u.password;
  db.run('UPDATE users SET username=?,password=?,role=? WHERE id=?',
    [username.trim(), newPass, role||u.role, req.params.id]);
  saveDB();
  res.json({success:true});
});

app.delete('/api/users/:id', (req,res) => {
  const u = queryOne('SELECT * FROM users WHERE id=?',[req.params.id]);
  if (!u) return res.status(404).json({error:'User not found.'});
  if (u.username === 'administrator') return res.status(403).json({error:'Cannot delete administrator account.'});
  db.run('DELETE FROM users WHERE id=?',[req.params.id]);
  saveDB();
  res.json({success:true});
});

// ── AGENTS ───────────────────────────────────────────────────
app.get('/api/agents', (req,res) => {
  res.json(queryAll('SELECT * FROM agents ORDER BY agent_name ASC'));
});
app.get('/api/agents/:id', (req,res) => {
  const a = queryOne('SELECT * FROM agents WHERE id=?',[req.params.id]);
  if (!a) return res.status(404).json({error:'Not found.'});
  res.json(a);
});
app.post('/api/agents', (req,res) => {
  const {agent_name, cf_agent, vessel} = req.body;
  if (!agent_name) return res.status(400).json({error:'Agent name is required.'});
  try {
    db.run('INSERT INTO agents (agent_name,cf_agent,vessel) VALUES (?,?,?)',
      [agent_name.trim(), cf_agent||'', vessel||'']);
    const id = queryOne('SELECT last_insert_rowid() as id').id;
    saveDB();
    res.status(201).json({success:true, id});
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({error:'Agent already exists.'});
    res.status(500).json({error:e.message});
  }
});
app.put('/api/agents/:id', (req,res) => {
  const {agent_name, cf_agent, vessel} = req.body;
  if (!agent_name) return res.status(400).json({error:'Agent name is required.'});
  db.run('UPDATE agents SET agent_name=?,cf_agent=?,vessel=? WHERE id=?',
    [agent_name.trim(), cf_agent||'', vessel||'', req.params.id]);
  saveDB();
  res.json({success:true});
});
app.delete('/api/agents/:id', (req,res) => {
  db.run('DELETE FROM agents WHERE id=?',[req.params.id]);
  saveDB(); res.json({success:true});
});

// ── CERTIFICATES ─────────────────────────────────────────────
app.get('/api/certificates', (req,res) => {
  res.json(queryAll('SELECT * FROM certificates ORDER BY id DESC'));
});
app.get('/api/certificates/:id', (req,res) => {
  const cert = queryOne('SELECT * FROM certificates WHERE id=?',[req.params.id]);
  if (!cert) return res.status(404).json({error:'Not found.'});
  const rows = queryAll('SELECT * FROM measurement_rows WHERE certificate_id=? ORDER BY row_order ASC',[req.params.id]);
  res.json({cert, rows});
});
app.post('/api/certificates', (req,res) => {
  const {c_no,agent_name,cf_agent,vessel,slip_no,cert_date,cargo,bundles,remarks,grand_cbm,rows} = req.body;
  if (!agent_name) return res.status(400).json({error:'Please select an Agent.'});
  db.run(
    'INSERT INTO certificates (c_no,agent,cf_agent,vessel,slip_no,cert_date,cargo,bundles,remarks,grand_cbm) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [c_no||'', agent_name, cf_agent||'', vessel||'', slip_no||'', cert_date||'', cargo||'', bundles||'', remarks||'', grand_cbm||0]
  );
  const certId = queryOne('SELECT last_insert_rowid() as id').id;
  if (Array.isArray(rows)) {
    rows.forEach((r,i) => {
      db.run(
        'INSERT INTO measurement_rows (certificate_id,row_order,marks,number,length_m,breadth_m,depth_m,total_cbm,remarks) VALUES (?,?,?,?,?,?,?,?,?)',
        [certId, i, r.marks||null, r.number||null, r.length_m||null, r.breadth_m||null, r.depth_m||null, r.total_cbm||null, r.row_remarks||r.remarks||null]
      );
    });
  }
  saveDB();
  res.status(201).json({success:true, id:certId});
});
app.delete('/api/certificates/:id', (req,res) => {
  db.run('DELETE FROM measurement_rows WHERE certificate_id=?',[req.params.id]);
  db.run('DELETE FROM certificates WHERE id=?',[req.params.id]);
  saveDB(); res.json({success:true});
});
app.get('/api/search', (req,res) => {
  const q = `%${req.query.q||''}%`;
  res.json(queryAll(
    'SELECT * FROM certificates WHERE agent LIKE ? OR vessel LIKE ? OR c_no LIKE ? OR cargo LIKE ? ORDER BY id ASC',
    [q,q,q,q]
  ));
});

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Make sure to serve all other static files correctly
app.use(express.static(__dirname));

// Initialize DB and start server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    // Get local IP for logs
    const nets = os.networkInterfaces();
    let localIP = 'YOUR-PC-IP';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIP = net.address;
        }
      }
    }
    console.log('\n🚢 MHFCS Certificate System is RUNNING\n');
    console.log('  Local (this PC)  →  http://localhost:' + PORT);
    console.log('  Network (others) →  http://' + localIP + ':' + PORT);
    console.log('\n  Share this address with other laptops on same WiFi:');
    console.log('  👉  http://' + localIP + ':' + PORT + '\n');
    console.log('  Available at your primary URL https://mhfc.onrender.com\n');
  });
});
