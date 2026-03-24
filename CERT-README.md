# MHFCS Certificate Measurement System
### Replacing your FoxPro software with a modern Web + SQLite solution

---

## 📁 Files

```
mhfcs/
├── cert-server.js       ← Express backend (API + serve frontend)
├── cert-package.json    ← rename to package.json
├── mhfcs.db             ← SQLite database (auto-created on first run)
└── public/
    └── certificate.html ← The certificate form (your new software!)
```

---

## 🚀 Setup (One Time)

### 1. Install Node.js
Download from → https://nodejs.org  (choose LTS)

### 2. Create project folder & copy files
```bash
mkdir mhfcs-cert
cd mhfcs-cert

# Copy cert-server.js, cert-package.json, certificate.html here
# Rename cert-package.json → package.json
# Create a public folder and move certificate.html into it:
mkdir public
mv certificate.html public/
```

### 3. Install dependencies
```bash
npm install
```

### 4. Start the server
```bash
node cert-server.js
```

You'll see:
```
✅ Database ready: mhfcs.db
🚢 MHFCS Certificate Server running at http://localhost:3000
```

### 5. Open your browser
Go to → **http://localhost:3000/certificate.html**

---

## 🗄️ Database Tables

### `certificates`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto ID |
| c_no | TEXT | Certificate Number |
| agent | TEXT | Agent name |
| vessel | TEXT | Name of vessel |
| slip_no | TEXT | Measurer's slip number |
| cf_agent | TEXT | C&F Agent |
| cert_date | DATE | Certificate date |
| cargo | TEXT | Cargo description |
| bundles | TEXT | Number of bundles |
| remarks | TEXT | General remarks |
| grand_cbm | REAL | Grand total CBM |
| created_at | DATETIME | Record creation time |

### `measurement_rows`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto ID |
| certificate_id | INTEGER | Links to certificates |
| row_order | INTEGER | Row sequence |
| marks | TEXT | Bundle marks |
| number | TEXT | Bundle number |
| length_m | REAL | Length in metres |
| breadth_m | REAL | Breadth in metres |
| depth_m | REAL | Depth in metres |
| total_cbm | REAL | L × B × D (auto calculated) |
| remarks | TEXT | Row remarks |

---

## ✨ Features vs FoxPro

| Feature | Old FoxPro | New System |
|---------|-----------|------------|
| Interface | DOS/text based | Modern web browser |
| Auto CBM calculation | Manual | ✅ Automatic |
| Save & retrieve records | File-based | ✅ SQLite database |
| Search certificates | Limited | ✅ Search by agent/vessel/cargo |
| Print certificate | Dot matrix | ✅ Modern print layout |
| Add/remove rows | Fixed | ✅ Dynamic rows |
| Access | Single PC | ✅ Any device on your network |
| Backup | Manual | ✅ Single .db file to copy |

---

## 🖨 Printing
Click **Print** button or press `Ctrl+P`. The print style hides all buttons and shows only the clean certificate layout.

## 💾 Backup
Just copy the `mhfcs.db` file to a USB or cloud storage — it contains all your records.

## 🌐 Network Access (optional)
To access from other computers on your office network, change this line in `cert-server.js`:
```js
app.listen(PORT, () => { ... })
// to:
app.listen(PORT, '0.0.0.0', () => { ... })
```
Then other PCs can open: `http://YOUR-PC-IP:3000/certificate.html`
