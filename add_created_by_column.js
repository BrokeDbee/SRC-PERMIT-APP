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
  const hasCreatedBy = columns.some(col => col.name === 'created_by');
  if (!hasCreatedBy) {
    db.run('ALTER TABLE students ADD COLUMN created_by INTEGER', (err) => {
      if (err) console.error('Migration error:', err);
      else console.log('created_by column added to students table.');
      db.close();
    });
  } else {
    console.log('created_by column already exists.');
    db.close();
  }
}); 