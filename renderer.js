const { ipcRenderer } = require('electron');

let loggedInUserId = null;

// Function to save login state
function saveLoginState(userId, username, role) {
    localStorage.setItem('loggedInUserId', userId);
    localStorage.setItem('username', username);
    localStorage.setItem('role', role);
}

// Function to clear login state
function clearLoginState() {
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
}

// Function to restore login state
function restoreLoginState() {
    const userId = localStorage.getItem('loggedInUserId');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    
    if (userId && username && role) {
        loggedInUserId = userId;
        // Show app content and hide login/signup
        document.getElementById('login-tab').style.display = 'none';
        document.getElementById('signup-tab').style.display = 'none';
        document.getElementById('create-tab').style.display = 'block';
        document.getElementById('verify-tab').style.display = 'block';
        document.getElementById('revoke-tab').style.display = 'block';
        document.getElementById('import-tab').style.display = 'block';
        document.getElementById('export-tab').style.display = 'block';
        document.getElementById('search-tab').style.display = 'block';
        document.getElementById('audit-tab').style.display = 'block';
        document.getElementById('backup-tab').style.display = 'block';
        document.getElementById('delete-tab').style.display = 'block';
        document.getElementById('report-tab').style.display = 'block';
        document.getElementById('bulk-tab').style.display = 'block';
        document.getElementById('print-tab').style.display = 'block';
        document.getElementById('userActions').style.display = 'block';
        
        // Update UI to show logged in state
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.textContent = `Logged in as: ${username} (${role})`;
        }
    }
}

// Call restoreLoginState when the page loads
document.addEventListener('DOMContentLoaded', restoreLoginState);

// Create Permit Form Handler
document.getElementById('createPermitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('createResult');
    
    // Check if user is logged in
    if (!loggedInUserId) {
        resultDiv.innerHTML = `
            <div class="alert alert-warning">
                Please log in or sign up before creating a permit.
                <br>
                <a href="#" onclick="document.getElementById('login-tab').click()">Click here to log in</a>
                or
                <a href="#" onclick="document.getElementById('signup-tab').click()">sign up</a>
            </div>
        `;
        return;
    }
    
    const studentData = {
        studentId: document.getElementById('studentId').value,
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        course: document.getElementById('course').value,
        level: document.getElementById('level').value,
        number: document.getElementById('number').value,
        amountPaid: document.getElementById('amountPaid').value,
        validityPeriod: document.getElementById('validityPeriod').value,
        createdBy: loggedInUserId
    };

    try {
        const result = await ipcRenderer.invoke('create-permit', studentData);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h4>Permit Created Successfully!</h4>
                    <p>Permit Code: <strong>${result.permitCode}</strong></p>
                    <div class="qr-code text-center">
                        <img src="${result.qrCode}" alt="Permit QR Code" />
                    </div>
                </div>
            `;
            document.getElementById('createPermitForm').reset();
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error creating permit: ${error.message}
            </div>
        `;
    }
});

// Verify Permit Form Handler
document.getElementById('verifyPermitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('verifyResult');
    const permitCode = document.getElementById('permitCode').value;

    try {
        const result = await ipcRenderer.invoke('verify-permit', permitCode);
        if (result.valid) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h4>Permit Valid!</h4>
                    <p>Student ID: ${result.student.student_id}</p>
                    <p>Name: ${result.student.name}</p>
                    <p>Email: ${result.student.email}</p>
                    <p>Course: ${result.student.course}</p>
                    <p>Level: ${result.student.level}</p>
                    <p>Number: ${result.student.number}</p>
                    <p>Amount Paid: ${result.student.amount_paid}</p>
                    <p>Status: ${result.student.status}</p>
                    <p>Validity Period: ${result.student.validity_period} days</p>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    Invalid or revoked permit code
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error verifying permit: ${error.message}
            </div>
        `;
    }
});

// Revoke Permit Form Handler
document.getElementById('revokePermitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('revokeResult');
    const studentId = document.getElementById('revokeStudentId').value;

    try {
        const result = await ipcRenderer.invoke('revoke-permit', studentId);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Permit has been successfully revoked
                </div>
            `;
            document.getElementById('revokePermitForm').reset();
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error revoking permit: ${error.message}
            </div>
        `;
    }
});

// Bulk Import Form Handler
document.getElementById('importForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('importResult');
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    if (!file) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Please select a CSV file
            </div>
        `;
        return;
    }
    try {
        const result = await ipcRenderer.invoke('import-students', file.path);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Successfully imported ${result.count} students
                </div>
            `;
            fileInput.value = '';
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error importing students: ${error.message}
            </div>
        `;
    }
});

// Bulk Export Form Handler
document.getElementById('exportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('exportResult');
    const filePath = document.getElementById('exportFile').value;
    if (!filePath) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Please enter a file path
            </div>
        `;
        return;
    }
    try {
        const result = await ipcRenderer.invoke('export-students', filePath);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Successfully exported ${result.count} students
                </div>
            `;
            document.getElementById('exportFile').value = '';
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error exporting students: ${error.message}
            </div>
        `;
    }
});

// Search Form Handler
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('searchResult');
    const query = document.getElementById('searchQuery').value;
    if (!query) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Please enter a search query
            </div>
        `;
        return;
    }
    try {
        const results = await ipcRenderer.invoke('search-students', query);
        if (results.length > 0) {
            let html = '<div class="alert alert-success"><h4>Search Results:</h4><ul>';
            results.forEach(student => {
                html += `
                    <li>
                        <p>Student ID: ${student.student_id}</p>
                        <p>Name: ${student.name}</p>
                        <p>Email: ${student.email}</p>
                        <p>Course: ${student.course}</p>
                        <p>Level: ${student.level}</p>
                        <p>Number: ${student.number}</p>
                        <p>Amount Paid: ${student.amount_paid}</p>
                        <p>Status: ${student.status}</p>
                        <p>Validity Period: ${student.validity_period} days</p>
                        <p><strong>Permit Code:</strong> ${student.original_code ? student.original_code : 'N/A'}</p>
                        <p><strong>Created by:</strong> ${student.creator ? student.creator : 'Unknown'}</p>
                    </li>
                `;
            });
            html += '</ul></div>';
            resultDiv.innerHTML = html;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-warning">
                    No results found
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error searching students: ${error.message}
            </div>
        `;
    }
});

// Backup Form Handler
document.getElementById('backupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('backupResult');
    const backupPath = document.getElementById('backupPath').value;
    if (!backupPath) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Please enter a backup path
            </div>
        `;
        return;
    }
    try {
        const result = await ipcRenderer.invoke('backup-database', backupPath);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Database backed up successfully
                </div>
            `;
            document.getElementById('backupPath').value = '';
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error backing up database: ${error.message}
            </div>
        `;
    }
});

// Restore Form Handler
document.getElementById('restoreForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('backupResult');
    const restorePath = document.getElementById('restorePath').value;
    if (!restorePath) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Please enter a restore path
            </div>
        `;
        return;
    }
    try {
        const result = await ipcRenderer.invoke('restore-database', restorePath);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Database restored successfully
                </div>
            `;
            document.getElementById('restorePath').value = '';
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error restoring database: ${error.message}
            </div>
        `;
    }
});

// Delete Student Form Handler
document.getElementById('deleteStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('deleteResult');
    const studentId = document.getElementById('deleteStudentId').value;

    try {
        const studentInfo = await ipcRenderer.invoke('fetch-student-info', studentId);
        if (studentInfo) {
            resultDiv.innerHTML = `
                <div class="alert alert-info">
                    <h4>Student Information:</h4>
                    <p>Student ID: ${studentInfo.student_id}</p>
                    <p>Name: ${studentInfo.name}</p>
                    <p>Email: ${studentInfo.email}</p>
                    <p>Course: ${studentInfo.course}</p>
                    <p>Level: ${studentInfo.level}</p>
                    <p>Number: ${studentInfo.number}</p>
                    <p>Amount Paid: ${studentInfo.amount_paid}</p>
                    <p>Status: ${studentInfo.status}</p>
                    <button id="confirmDelete" class="btn btn-danger">Confirm Delete</button>
                </div>
            `;
            document.getElementById('confirmDelete').addEventListener('click', async () => {
                const result = await ipcRenderer.invoke('delete-student', studentId);
                if (result.success) {
                    resultDiv.innerHTML = `
                        <div class="alert alert-success">
                            Student has been successfully deleted
                        </div>
                    `;
                    document.getElementById('deleteStudentForm').reset();
                }
            });
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-warning">
                    No student found with the given ID
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error fetching student information: ${error.message}
            </div>
        `;
    }
});

// Login Form Handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('loginResult');
    const credentials = {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
    };

    try {
        const result = await ipcRenderer.invoke('login', credentials);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Login successful. Role: ${result.role}
                </div>
            `;
            document.getElementById('loginForm').reset();
            // Save login state
            saveLoginState(result.userId, credentials.username, result.role);
            loggedInUserId = result.userId;
            
            // Hide the login and signup tabs
            document.getElementById('login-tab').style.display = 'none';
            document.getElementById('signup-tab').style.display = 'none';
            // Show the app content
            document.getElementById('create-tab').style.display = 'block';
            document.getElementById('verify-tab').style.display = 'block';
            document.getElementById('revoke-tab').style.display = 'block';
            document.getElementById('import-tab').style.display = 'block';
            document.getElementById('export-tab').style.display = 'block';
            document.getElementById('search-tab').style.display = 'block';
            document.getElementById('audit-tab').style.display = 'block';
            document.getElementById('backup-tab').style.display = 'block';
            document.getElementById('delete-tab').style.display = 'block';
            document.getElementById('report-tab').style.display = 'block';
            document.getElementById('bulk-tab').style.display = 'block';
            document.getElementById('print-tab').style.display = 'block';
            document.getElementById('userActions').style.display = 'block';
            
            // Update UI to show logged in state
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                userInfo.textContent = `Logged in as: ${credentials.username} (${result.role})`;
            }
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    Invalid username or password
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error during login: ${error.message}
            </div>
        `;
    }
});

// Reports Form Handler
document.getElementById('reportStats').addEventListener('click', async () => {
    const resultDiv = document.getElementById('reportStats');
    try {
        const stats = await ipcRenderer.invoke('get-permit-stats');
        let html = '<div class="alert alert-info"><h4>Permit Statistics:</h4><ul>';
        stats.forEach(stat => {
            html += `<li>Status: ${stat.status}, Count: ${stat.count}</li>`;
        });
        html += '</ul></div>';
        resultDiv.innerHTML = html;
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error fetching statistics: ${error.message}
            </div>
        `;
    }
});

// Bulk Delete Form Handler
document.getElementById('bulkDeleteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('bulkResult');
    const studentIds = document.getElementById('studentIds').value.split(',').map(id => id.trim());

    try {
        const result = await ipcRenderer.invoke('bulk-delete', studentIds);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Successfully deleted ${studentIds.length} students
                </div>
            `;
            document.getElementById('bulkDeleteForm').reset();
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error during bulk delete: ${error.message}
            </div>
        `;
    }
});

// Print Permit Form Handler
document.getElementById('printPermitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('printResult');
    const studentId = document.getElementById('printStudentId').value;

    try {
        const result = await ipcRenderer.invoke('print-permit', studentId);
        if (result.student) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h4>Permit Details:</h4>
                    <p>Student ID: ${result.student.student_id}</p>
                    <p>Name: ${result.student.name}</p>
                    <p>Email: ${result.student.email}</p>
                    <p>Course: ${result.student.course}</p>
                    <p>Level: ${result.student.level}</p>
                    <p>Number: ${result.student.number}</p>
                    <p>Amount Paid: ${result.student.amount_paid}</p>
                    <p>Status: ${result.student.status}</p>
                    <p>Validity Period: ${result.student.validity_period} days</p>
                    <div class="qr-code text-center">
                        <img src="${result.qrCode}" alt="Permit QR Code" />
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-warning">
                    No student found with the given ID
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error printing permit: ${error.message}
            </div>
        `;
    }
});

// Sign Up Form Handler
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('signupResult');
    const userData = {
        username: document.getElementById('signupUsername').value,
        password: document.getElementById('signupPassword').value,
        role: document.getElementById('signupRole').value
    };

    try {
        const result = await ipcRenderer.invoke('signup', userData);
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Sign up successful. You are now logged in.
                </div>
            `;
            document.getElementById('signupForm').reset();
            // Automatically log in the user
            const loginResult = await ipcRenderer.invoke('login', { username: userData.username, password: userData.password });
            if (loginResult.success) {
                // Save login state
                saveLoginState(loginResult.userId, userData.username, userData.role);
                loggedInUserId = loginResult.userId;
                
                document.getElementById('login-tab').style.display = 'none';
                document.getElementById('signup-tab').style.display = 'none';
                // Show the app content
                document.getElementById('create-tab').style.display = 'block';
                document.getElementById('verify-tab').style.display = 'block';
                document.getElementById('revoke-tab').style.display = 'block';
                document.getElementById('import-tab').style.display = 'block';
                document.getElementById('export-tab').style.display = 'block';
                document.getElementById('search-tab').style.display = 'block';
                document.getElementById('audit-tab').style.display = 'block';
                document.getElementById('backup-tab').style.display = 'block';
                document.getElementById('delete-tab').style.display = 'block';
                document.getElementById('report-tab').style.display = 'block';
                document.getElementById('bulk-tab').style.display = 'block';
                document.getElementById('print-tab').style.display = 'block';
                document.getElementById('userActions').style.display = 'block';
                
                // Update UI to show logged in state
                const userInfo = document.getElementById('userInfo');
                if (userInfo) {
                    userInfo.textContent = `Logged in as: ${userData.username} (${userData.role})`;
                }
            }
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                Error during sign up: ${error.message}
            </div>
        `;
    }
});

// Logout Handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    loggedInUserId = null;
    clearLoginState();
    // Hide app tabs and show login/signup
    document.getElementById('userActions').style.display = 'none';
    document.getElementById('login-tab').style.display = 'block';
    document.getElementById('signup-tab').style.display = 'block';
    document.getElementById('create-tab').style.display = 'none';
    document.getElementById('verify-tab').style.display = 'none';
    document.getElementById('revoke-tab').style.display = 'none';
    document.getElementById('import-tab').style.display = 'none';
    document.getElementById('export-tab').style.display = 'none';
    document.getElementById('search-tab').style.display = 'none';
    document.getElementById('audit-tab').style.display = 'none';
    document.getElementById('backup-tab').style.display = 'none';
    document.getElementById('delete-tab').style.display = 'none';
    document.getElementById('report-tab').style.display = 'none';
    document.getElementById('bulk-tab').style.display = 'none';
    document.getElementById('print-tab').style.display = 'none';
    
    // Clear user info display
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.textContent = '';
    }
});

// Delete Account Handler
document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
    if (!loggedInUserId) return;
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    try {
        const result = await ipcRenderer.invoke('delete-account', loggedInUserId);
        if (result.success) {
            alert('Account deleted successfully.');
            loggedInUserId = null;
            clearLoginState();
            // Log out and show login/signup
            document.getElementById('userActions').style.display = 'none';
            document.getElementById('login-tab').style.display = 'block';
            document.getElementById('signup-tab').style.display = 'block';
            document.getElementById('create-tab').style.display = 'none';
            document.getElementById('verify-tab').style.display = 'none';
            document.getElementById('revoke-tab').style.display = 'none';
            document.getElementById('import-tab').style.display = 'none';
            document.getElementById('export-tab').style.display = 'none';
            document.getElementById('search-tab').style.display = 'none';
            document.getElementById('audit-tab').style.display = 'none';
            document.getElementById('backup-tab').style.display = 'none';
            document.getElementById('delete-tab').style.display = 'none';
            document.getElementById('report-tab').style.display = 'none';
            document.getElementById('bulk-tab').style.display = 'none';
            document.getElementById('print-tab').style.display = 'none';
            
            // Clear user info display
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                userInfo.textContent = '';
            }
        }
    } catch (error) {
        alert('Error deleting account: ' + error.message);
    }
}); 