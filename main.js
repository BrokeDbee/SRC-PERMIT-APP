const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const nodemailer = require('nodemailer');

let mainWindow;
// Update database path to a separate folder
const dbPath = path.join(__dirname, 'database', 'permits.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE,
    name TEXT,
    email TEXT,
    course TEXT,
    level TEXT,
    number TEXT,
    amount_paid REAL,
    permit_code TEXT UNIQUE,
    original_code TEXT,
    status TEXT DEFAULT 'active',
    validity_period INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    user TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Uncomment for development
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('create-permit', async (event, studentData) => {
  const permitCode = generatePermitCode();
  const hashedCode = await bcrypt.hash(permitCode, 10);
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO students (student_id, name, email, course, level, number, amount_paid, permit_code, original_code, validity_period, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [studentData.studentId, studentData.name, studentData.email, studentData.course, studentData.level, studentData.number, studentData.amountPaid, hashedCode, permitCode, studentData.validityPeriod, studentData.createdBy],
      async function(err) {
        if (err) {
          reject(err);
          return;
        }
        // Generate QR Code
        const qrCode = await QRCode.toDataURL(permitCode);
        // Log the action with creator info
        db.get('SELECT username FROM users WHERE id = ?', [studentData.createdBy], (err, user) => {
          if (err) {
            console.error('Error fetching creator:', err);
          } else {
            logAudit('create-permit', `Student ID: ${studentData.studentId}, Created by: ${user ? user.username : 'Unknown'}`);
          }
        });
        resolve({ success: true, permitCode, qrCode });
      }
    );
  });
});

ipcMain.handle('verify-permit', async (event, permitCode) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM students WHERE status = "active"', [], async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const row of rows) {
        const isValid = await bcrypt.compare(permitCode, row.permit_code);
        if (isValid) {
          logAudit('verify-permit', row.student_id);
          resolve({ valid: true, student: row });
          return;
        }
      }
      
      resolve({ valid: false });
    });
  });
});

ipcMain.handle('revoke-permit', async (event, studentId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE students SET status = "revoked" WHERE student_id = ?',
      [studentId],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        logAudit('revoke-permit', studentId);
        resolve({ success: true });
      }
    );
  });
});

// Bulk Import
ipcMain.handle('import-students', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        db.serialize(() => {
          const stmt = db.prepare('INSERT INTO students (student_id, name, email, permit_code) VALUES (?, ?, ?, ?)');
          results.forEach((row) => {
            const permitCode = generatePermitCode();
            const hashedCode = bcrypt.hashSync(permitCode, 10);
            stmt.run(row.student_id, row.name, row.email, hashedCode);
          });
          stmt.finalize();
          logAudit('import-students', `Imported ${results.length} students`);
          resolve({ success: true, count: results.length });
        });
      })
      .on('error', (error) => reject(error));
  });
});

// Bulk Export
ipcMain.handle('export-students', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM students', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'student_id', title: 'Student ID' },
          { id: 'name', title: 'Name' },
          { id: 'email', title: 'Email' },
          { id: 'status', title: 'Status' }
        ]
      });
      csvWriter.writeRecords(rows)
        .then(() => {
          logAudit('export-students', `Exported ${rows.length} students`);
          resolve({ success: true, count: rows.length });
        })
        .catch((error) => reject(error));
    });
  });
});

// User Authentication
ipcMain.handle('login', async (event, credentials) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [credentials.username], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (row && bcrypt.compareSync(credentials.password, row.password)) {
        resolve({ success: true, role: row.role, userId: row.id });
      } else {
        resolve({ success: false });
      }
    });
  });
});

// Sign Up
ipcMain.handle('signup', async (event, userData) => {
  return new Promise((resolve, reject) => {
    const hashedPassword = bcrypt.hashSync(userData.password, 10);
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [userData.username, hashedPassword, userData.role], function(err) {
      if (err) {
        reject(err);
        return;
      }
      logAudit('signup', `New user registered: ${userData.username}`);
      resolve({ success: true, userId: this.lastID });
      resolve({ success: true });
    });
  });
});

// Audit Logs
function logAudit(action, details) {
  db.run('INSERT INTO audit_logs (action, details) VALUES (?, ?)', [action, details]);
}

// Reporting and Analytics
ipcMain.handle('get-permit-stats', async (event) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT status, COUNT(*) as count FROM students GROUP BY status', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
});

// Bulk Operations
ipcMain.handle('bulk-delete', async (event, studentIds) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('DELETE FROM students WHERE student_id = ?');
    studentIds.forEach(id => stmt.run(id));
    stmt.finalize();
    logAudit('bulk-delete', `Deleted ${studentIds.length} students`);
    resolve({ success: true });
  });
});

// Printing Permits
ipcMain.handle('print-permit', async (event, studentId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM students WHERE student_id = ?', [studentId], async (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      const qrCode = await QRCode.toDataURL(row.permit_code);
      resolve({ student: row, qrCode });
    });
  });
});

// Backup and Restore
ipcMain.handle('backup-database', async (event, backupPath) => {
  return new Promise((resolve, reject) => {
    fs.copyFile(dbPath, backupPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      logAudit('backup-database', `Backup created at ${backupPath}`);
      resolve({ success: true });
    });
  });
});

ipcMain.handle('restore-database', async (event, backupPath) => {
  return new Promise((resolve, reject) => {
    fs.copyFile(backupPath, dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      logAudit('restore-database', `Database restored from ${backupPath}`);
      resolve({ success: true });
    });
  });
});

// Search and Filter Enhancements
ipcMain.handle('search-students', async (event, query) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT s.student_id, s.name, s.email, s.course, s.level, s.number, s.amount_paid, s.status, s.original_code, u.username as creator FROM students s LEFT JOIN users u ON s.created_by = u.id WHERE s.student_id LIKE ? OR s.name LIKE ? OR s.email LIKE ? OR s.course LIKE ? OR s.level LIKE ?', [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
});

function generatePermitCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let code = '';
  
  // Ensure at least one letter and one number
  code += letters.charAt(Math.floor(Math.random() * letters.length));
  code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  
  // Fill the remaining 2 characters randomly
  const chars = letters + numbers;
  for (let i = 0; i < 2; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Shuffle the code to randomize the order
  return code.split('').sort(() => 0.5 - Math.random()).join('');
}

// Function to delete expired permits
function deleteExpiredPermits() {
  const currentDate = new Date();
  db.run('DELETE FROM students WHERE created_at + validity_period * 86400000 < ?', [currentDate.getTime()], function(err) {
    if (err) {
      console.error('Error deleting expired permits:', err);
    } else {
      console.log('Expired permits deleted successfully');
    }
  });
}

// Schedule the deletion of expired permits every day
setInterval(deleteExpiredPermits, 86400000); // 86400000 ms = 1 day

// Delete Account
ipcMain.handle('delete-account', async (event, userId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        reject(err);
        return;
      }
      logAudit('delete-account', `User deleted: ${userId}`);
      resolve({ success: true });
    });
  });
});

// Migration: Ensure original_code column exists
function ensureOriginalCodeColumn() {
  db.get("PRAGMA table_info(students)", (err, row) => {
    if (err) return;
    db.all("PRAGMA table_info(students)", (err, columns) => {
      if (err) return;
      const hasOriginalCode = columns.some(col => col.name === 'original_code');
      if (!hasOriginalCode) {
        db.run('ALTER TABLE students ADD COLUMN original_code TEXT', (err) => {
          if (err) console.error('Migration error:', err);
          else console.log('original_code column added to students table.');
        });
      }
    });
  });
}

// Migration: Ensure created_by column exists
function ensureCreatedByColumn() {
  db.all("PRAGMA table_info(students)", (err, columns) => {
    if (err) return;
    const hasCreatedBy = columns.some(col => col.name === 'created_by');
    if (!hasCreatedBy) {
      db.run('ALTER TABLE students ADD COLUMN created_by INTEGER', (err) => {
        if (err) console.error('Migration error:', err);
        else console.log('created_by column added to students table.');
      });
    }
  });
}

// Call migration at startup
ensureOriginalCodeColumn();
ensureCreatedByColumn(); 