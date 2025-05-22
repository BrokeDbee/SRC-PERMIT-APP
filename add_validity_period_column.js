const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'permits.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(students)", (err, columns) => {
  if (err) {
    console.error('Error reading table info:', err);
    db.close();
    return;
  }
  const hasValidityPeriod = columns.some(col => col.name === 'validity_period');
  if (!hasValidityPeriod) {
    db.run('ALTER TABLE students ADD COLUMN validity_period INTEGER', (err) => {
      if (err) console.error('Migration error:', err);
      else console.log('validity_period column added to students table.');
      db.close();
    });
  } else {
    console.log('validity_period column already exists.');
    db.close();
  }
}); 