const { app: electronApp, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const nodemailer = require('nodemailer');
const { sendEmail } = require('./email-service');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const port = 3000;

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
    role TEXT,
    email TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    user TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recovery_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    token TEXT UNIQUE,
    expires DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Express setup
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Add verification endpoint
app.get('/verify-permit', async (req, res) => {
    const permitCode = req.query.code;
    if (!permitCode) {
        return res.json({ valid: false, error: 'No permit code provided' });
    }

    try {
        const result = await verifyPermit(permitCode);
        res.json(result);
    } catch (error) {
        res.json({ valid: false, error: error.message });
    }
});

// Start the server
server.listen(port, () => {
    console.log(`Verification server running at http://localhost:${port}`);
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

electronApp.whenReady().then(createWindow);

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    electronApp.quit();
  }
});

electronApp.on('activate', () => {
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
        // Generate QR Code with verification URL
        const verificationUrl = `http://localhost:${port}/verify.html?code=${permitCode}`;
        const qrCode = await QRCode.toDataURL(verificationUrl);
        
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

async function verifyPermit(permitCode) {
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
}

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
    db.all(`
      SELECT 
        s.student_id, 
        s.name, 
        s.email, 
        s.course, 
        s.level, 
        s.number, 
        s.amount_paid, 
        s.status, 
        s.original_code, 
        s.validity_period,
        s.created_at,
        u.username as creator 
      FROM students s 
      LEFT JOIN users u ON s.created_by = u.id 
      WHERE 
        s.student_id LIKE ? OR 
        s.name LIKE ? OR 
        s.email LIKE ? OR 
        s.course LIKE ? OR 
        s.level LIKE ? OR
        s.number LIKE ?
      ORDER BY s.created_at DESC
    `, 
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`], 
    (err, rows) => {
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

// Get statistics
ipcMain.handle('get-statistics', async () => {
    try {
        // Get total permits
        const totalPermits = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM students', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Get active permits
        const activePermits = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM students WHERE status = "active"', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Get total students
        const totalStudents = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(DISTINCT student_id) as count FROM students', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Get revoked permits
        const revokedPermits = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM students WHERE status = "revoked"', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Get expired permits
        const expiredPermits = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM students WHERE status = "expired"', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Get total revenue
        const totalRevenue = await new Promise((resolve, reject) => {
            db.get('SELECT SUM(amount_paid) as total FROM students', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Get course distribution
        const courseDistribution = await new Promise((resolve, reject) => {
            db.all(`
                SELECT course, COUNT(*) as count 
                FROM students 
                GROUP BY course 
                ORDER BY count DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        return {
            totalPermits: totalPermits.count || 0,
            activePermits: activePermits.count || 0,
            totalStudents: totalStudents.count || 0,
            revokedPermits: revokedPermits.count || 0,
            expiredPermits: expiredPermits.count || 0,
            totalRevenue: totalRevenue.total || 0,
            courseDistribution
        };
    } catch (error) {
        console.error('Error getting statistics:', error);
        throw error;
    }
});

// Delete all data
ipcMain.handle('deleteAllData', async () => {
    try {
        // Start a transaction
        db.run('BEGIN TRANSACTION');
        
        try {
            // Delete all permits
            db.run('DELETE FROM permits');
            
            // Delete all students
            db.run('DELETE FROM students');
            
            // Reset the auto-increment counters
            db.run('DELETE FROM sqlite_sequence WHERE name IN ("permits", "students")');
            
            // Commit the transaction
            db.run('COMMIT');
            
            return { success: true, message: 'All permits and student data have been deleted successfully.' };
        } catch (error) {
            // Rollback in case of error
            db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error deleting data:', error);
        return { success: false, message: 'Error deleting data: ' + error.message };
    }
});

// Check permit validity
ipcMain.handle('check-permit-validity', async (event, studentId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT *, (julianday("now") - julianday(created_at)) as days_elapsed FROM students WHERE student_id = ?', [studentId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (!row) {
                resolve({ exists: false });
                return;
            }

            const daysElapsed = Math.floor(row.days_elapsed);
            const isExpired = daysElapsed > row.validity_period;
            const daysRemaining = Math.max(0, row.validity_period - daysElapsed);
            
            resolve({
                exists: true,
                student: row,
                daysElapsed,
                daysRemaining,
                isExpired,
                status: isExpired ? 'expired' : row.status
            });
        });
    });
});

// Generate receipt
ipcMain.handle('generate-receipt', async (event, studentId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT s.*, u.username as creator_name FROM students s LEFT JOIN users u ON s.created_by = u.id WHERE s.student_id = ?', [studentId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (!row) {
                reject(new Error('Student not found'));
                return;
            }

            const receipt = {
                receiptNumber: `REC-${Date.now()}`,
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                studentId: row.student_id,
                name: row.name,
                course: row.course,
                level: row.level,
                amountPaid: row.amount_paid,
                permitCode: row.original_code,
                validityPeriod: row.validity_period,
                createdBy: row.creator_name,
                status: 'PAID'
            };

            resolve(receipt);
        });
    });
});

// Fetch student info
ipcMain.handle('fetch-student-info', async (event, studentId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM students WHERE student_id = ?', [studentId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
});

// Delete student
ipcMain.handle('delete-student', async (event, studentId) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM students WHERE student_id = ?', [studentId], function(err) {
            if (err) {
                reject(err);
                return;
            }
            logAudit('delete-student', studentId);
            resolve({ success: true });
        });
    });
});

// Get recent activity
ipcMain.handle('get-recent-activity', async () => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM audit_logs 
            ORDER BY timestamp DESC 
            LIMIT 10
        `, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
});

// Get expiring permits
ipcMain.handle('get-expiring-permits', async () => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM students 
            WHERE status = 'active' 
            AND julianday(created_at) + validity_period <= julianday('now') + 7
            AND julianday(created_at) + validity_period > julianday('now')
            ORDER BY julianday(created_at) + validity_period ASC
            LIMIT 5
        `, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
});

// Get revenue overview
ipcMain.handle('get-revenue-overview', async () => {
    return new Promise((resolve, reject) => {
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        
        db.all(`
            SELECT 
                SUM(CASE WHEN date(created_at) = ? THEN amount_paid ELSE 0 END) as today_revenue,
                SUM(CASE WHEN date(created_at) >= ? THEN amount_paid ELSE 0 END) as month_revenue,
                date(created_at) as date,
                SUM(amount_paid) as daily_revenue
            FROM students 
            WHERE date(created_at) >= date('now', '-30 days')
            GROUP BY date(created_at)
            ORDER BY date(created_at) ASC
        `, [today, firstDayOfMonth], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            const result = {
                todayRevenue: rows[0]?.today_revenue || 0,
                monthRevenue: rows[0]?.month_revenue || 0,
                dailyRevenue: rows.map(row => ({
                    date: row.date,
                    amount: row.daily_revenue
                }))
            };
            
            resolve(result);
        });
    });
});

// Add these new IPC handlers
ipcMain.handle('validate-user', async (event, { username, email, role }) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ? AND email = ? AND role = ?', 
            [username, email, role], 
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ exists: !!row });
            }
        );
    });
});

ipcMain.handle('store-recovery-token', async (event, { username, token }) => {
    return new Promise((resolve, reject) => {
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        db.run('INSERT INTO recovery_tokens (username, token, expires) VALUES (?, ?, ?)',
            [username, token, expires.toISOString()],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ success: true });
            }
        );
    });
});

// Add this with your other IPC handlers
ipcMain.handle('send-recovery-email', async (event, emailData) => {
    try {
        const result = await sendEmail(emailData);
        return result;
    } catch (error) {
        console.error('Error in send-recovery-email handler:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
});

// Add IPC handler for sending permit emails
ipcMain.handle('send-permit-email', async (event, emailData) => {
    try {
        const result = await sendEmail(emailData);
        return result;
    } catch (error) {
        console.error('Error sending permit email:', error);
        throw error;
    }
}); 