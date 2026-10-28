const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '../../alfaaz_data.db');
try {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('Found tables:', tables.length);
  for (const t of tables) {
    if (t.name.startsWith('sqlite_')) continue;
    const count = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get();
    console.log(`Table: ${t.name} (${count.count} rows)`);
    console.log(t.sql);
    console.log('---');
  }
} catch (e) {
  console.error('Recon error:', e.message);
}
