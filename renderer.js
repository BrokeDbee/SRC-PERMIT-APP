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

// Function to update UI based on login state
function updateUIForLoginState(userId, username, role) {
    const userInfo = document.getElementById('userInfo');
    const userInfoText = document.getElementById('userInfoText');
    const authButtons = document.getElementById('authButtons');
    const userActions = document.getElementById('userActions');
    
    if (userId && username && role) {
        // Show user info and actions
        userInfo.style.display = 'block';
        userInfoText.textContent = `${username} (${role})`;
        authButtons.style.display = 'none';
        userActions.style.display = 'block';
        
        // Hide login and signup tabs
        document.getElementById('login-tab').style.display = 'none';
        document.getElementById('signup-tab').style.display = 'none';
        
        // Show app content tabs
        const appTabs = ['create', 'verify', 'revoke', 'import', 'export', 'search', 
                        'audit', 'backup', 'delete', 'report', 'bulk', 'print', 'dashboard'];
        appTabs.forEach(tab => {
            document.getElementById(`${tab}-tab`).style.display = 'block';
        });
    } else {
        // Hide user info and actions
        userInfo.style.display = 'none';
        authButtons.style.display = 'block';
        userActions.style.display = 'none';
        
        // Show login and signup tabs
        document.getElementById('login-tab').style.display = 'block';
        document.getElementById('signup-tab').style.display = 'block';
        
        // Hide app content tabs
        const appTabs = ['create', 'verify', 'revoke', 'import', 'export', 'search', 
                        'audit', 'backup', 'delete', 'report', 'bulk', 'print', 'dashboard'];
        appTabs.forEach(tab => {
            document.getElementById(`${tab}-tab`).style.display = 'none';
        });
    }
}

// Function to restore login state
function restoreLoginState() {
    const userId = localStorage.getItem('loggedInUserId');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    
    if (userId && username && role) {
        loggedInUserId = userId;
        updateUIForLoginState(userId, username, role);
        
        // Switch to dashboard tab
        document.getElementById('dashboard-tab').click();
        // Load dashboard data
        loadDashboard();
    } else {
        updateUIForLoginState(null, null, null);
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
            // Generate receipt
            const receipt = await ipcRenderer.invoke('generate-receipt', studentData.studentId);
            
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h4>Permit Created Successfully!</h4>
                    <p>Permit Code: <strong>${result.permitCode}</strong></p>
                    <div class="qr-code text-center">
                        <img src="${result.qrCode}" alt="Permit QR Code" />
                    </div>
                    <div class="receipt mt-4">
                        <h5>Payment Receipt</h5>
                        <div class="card">
                            <div class="card-body">
                                <p><strong>Receipt No:</strong> ${receipt.receiptNumber}</p>
                                <p><strong>Date:</strong> ${receipt.date}</p>
                                <p><strong>Time:</strong> ${receipt.time}</p>
                                <p><strong>Student ID:</strong> ${receipt.studentId}</p>
                                <p><strong>Name:</strong> ${receipt.name}</p>
                                <p><strong>Course:</strong> ${receipt.course}</p>
                                <p><strong>Level:</strong> ${receipt.level}</p>
                                <p><strong>Amount Paid:</strong> GHS ${receipt.amountPaid}</p>
                                <p><strong>Permit Code:</strong> ${receipt.permitCode}</p>
                                <p><strong>Validity Period:</strong> ${receipt.validityPeriod} days</p>
                                <p><strong>Created By:</strong> ${receipt.createdBy}</p>
                                <p><strong>Status:</strong> ${receipt.status}</p>
                            </div>
                        </div>
                        <button class="btn btn-primary mt-3" onclick="window.print()">Print Receipt</button>
                    </div>
                </div>
            `;
            document.getElementById('createPermitForm').reset();
        }
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Student ID Already Exists</h4>
                    <p>A permit with Student ID "${studentData.studentId}" already exists in the system.</p>
                    <p>Please use a different Student ID or check the existing permit.</p>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    Error creating permit: ${error.message}
                </div>
            `;
        }
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
            
            // Update UI
            updateUIForLoginState(result.userId, credentials.username, result.role);
            
            // Switch to dashboard tab
            document.getElementById('dashboard-tab').click();
            // Load dashboard data
            loadDashboard();
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
            const loginResult = await ipcRenderer.invoke('login', { 
                username: userData.username, 
                password: userData.password 
            });
            
            if (loginResult.success) {
                // Save login state
                saveLoginState(loginResult.userId, userData.username, userData.role);
                loggedInUserId = loginResult.userId;
                
                // Update UI
                updateUIForLoginState(loginResult.userId, userData.username, userData.role);
                
                // Switch to dashboard tab
                document.getElementById('dashboard-tab').click();
                // Load dashboard data
                loadDashboard();
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
    updateUIForLoginState(null, null, null);
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
            updateUIForLoginState(null, null, null);
        }
    } catch (error) {
        alert('Error deleting account: ' + error.message);
    }
});

// Statistics functionality
let courseChart = null;

async function loadStatistics() {
    try {
        const stats = await ipcRenderer.invoke('get-statistics');
        
        // Update statistics cards
        document.getElementById('totalPermits').textContent = stats.totalPermits;
        document.getElementById('activePermits').textContent = stats.activePermits;
        document.getElementById('totalStudents').textContent = stats.totalStudents;
        document.getElementById('revokedPermits').textContent = stats.revokedPermits;
        document.getElementById('expiredPermits').textContent = stats.expiredPermits;
        document.getElementById('totalRevenue').textContent = `GHS ${stats.totalRevenue.toFixed(2)}`;

        // Update course distribution chart
        if (courseChart) {
            courseChart.destroy();
        }

        const ctx = document.getElementById('courseChart').getContext('2d');
        courseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: stats.courseDistribution.map(item => item.course),
                datasets: [{
                    label: 'Number of Permits',
                    data: stats.courseDistribution.map(item => item.count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(255, 206, 86, 0.5)',
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(153, 102, 255, 0.5)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Load statistics when the stats tab is shown
document.getElementById('stats-tab').addEventListener('shown.bs.tab', loadStatistics);

// Delete all data button handler
document.getElementById('deleteAllDataBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all permits and student data? This action cannot be undone. User accounts will be preserved.')) {
        try {
            const result = await ipcRenderer.invoke('deleteAllData');
            if (result.success) {
                showNotification('Success', result.message, 'success');
                // Refresh the dashboard if it's currently shown
                if (document.getElementById('dashboard').classList.contains('show')) {
                    loadDashboard();
                }
            } else {
                showNotification('Error', result.message, 'error');
            }
        } catch (error) {
            showNotification('Error', 'Failed to delete data: ' + error.message, 'error');
        }
    }
});

// Check validity form handler
document.getElementById('checkValidityForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('checkStudentId').value;
    const resultDiv = document.getElementById('validityResult');
    
    try {
        const result = await ipcRenderer.invoke('check-permit-validity', studentId);
        
        if (!result.exists) {
            resultDiv.innerHTML = `
                <div class="alert alert-warning">
                    <h4>No Permit Found</h4>
                    <p>No permit found with Student ID: ${studentId}</p>
                </div>
            `;
            return;
        }

        const statusClass = result.status === 'active' ? 'success' : 
                          result.status === 'expired' ? 'danger' : 
                          result.status === 'revoked' ? 'danger' : 'warning';
        
        const statusText = result.status.charAt(0).toUpperCase() + result.status.slice(1);
        
        resultDiv.innerHTML = `
            <div class="alert alert-${statusClass}">
                <h4>Permit Status: ${statusText}</h4>
                <div class="mt-3">
                    <p><strong>Student Name:</strong> ${result.student.name}</p>
                    <p><strong>Course:</strong> ${result.student.course}</p>
                    <p><strong>Created Date:</strong> ${new Date(result.student.created_at).toLocaleDateString()}</p>
                    <p><strong>Validity Period:</strong> ${result.student.validity_period} days</p>
                    <p><strong>Days Elapsed:</strong> ${result.daysElapsed} days</p>
                    <p><strong>Days Remaining:</strong> ${result.daysRemaining} days</p>
                    ${result.status === 'active' ? '<p class="text-success">This permit is currently valid.</p>' : ''}
                    ${result.status === 'expired' ? '<p class="text-danger">This permit has expired.</p>' : ''}
                    ${result.status === 'revoked' ? '<p class="text-danger">This permit has been revoked.</p>' : ''}
                </div>
            </div>
        `;
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <h4>Error</h4>
                <p>Failed to check permit validity: ${error.message}</p>
            </div>
        `;
    }
});

// Dashboard functionality
let revenueChart = null;

async function loadDashboard() {
    try {
        // Load recent activity
        const activities = await ipcRenderer.invoke('get-recent-activity');
        const activityList = document.getElementById('recentActivity');
        activityList.innerHTML = activities.map(activity => `
            <div class="list-group-item">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${activity.action}</h6>
                    <small>${new Date(activity.timestamp).toLocaleString()}</small>
                </div>
                <p class="mb-1">${activity.details}</p>
            </div>
        `).join('') || '<div class="text-center py-3">No recent activity</div>';

        // Load expiring permits
        const expiringPermits = await ipcRenderer.invoke('get-expiring-permits');
        const expiringList = document.getElementById('expiringPermits');
        expiringList.innerHTML = expiringPermits.map(permit => {
            const daysRemaining = Math.ceil(permit.validity_period - (new Date() - new Date(permit.created_at)) / (1000 * 60 * 60 * 24));
            return `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${permit.name}</h6>
                        <small class="text-warning">${daysRemaining} days remaining</small>
                    </div>
                    <p class="mb-1">Student ID: ${permit.student_id}</p>
                    <small>Course: ${permit.course}</small>
                </div>
            `;
        }).join('') || '<div class="text-center py-3">No permits expiring soon</div>';

        // Load revenue overview
        const revenue = await ipcRenderer.invoke('get-revenue-overview');
        document.getElementById('todayRevenue').textContent = `GHS ${revenue.todayRevenue.toFixed(2)}`;
        document.getElementById('monthRevenue').textContent = `GHS ${revenue.monthRevenue.toFixed(2)}`;

        // Update revenue chart
        if (revenueChart) {
            revenueChart.destroy();
        }

        const ctx = document.getElementById('revenueChart').getContext('2d');
        revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: revenue.dailyRevenue.map(item => new Date(item.date).toLocaleDateString()),
                datasets: [{
                    label: 'Daily Revenue',
                    data: revenue.dailyRevenue.map(item => item.amount),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => `GHS ${value.toFixed(2)}`
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load dashboard when the tab is shown
document.getElementById('dashboard-tab').addEventListener('shown.bs.tab', loadDashboard);

// Notification System
function showNotification(title, message, type = 'info') {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    notificationDiv.style.zIndex = '9999';
    notificationDiv.innerHTML = `
        <strong>${title}</strong>
        <p class="mb-0">${message}</p>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(notificationDiv);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        notificationDiv.remove();
    }, 5000);
}

// Add notification for expiring permits
async function checkExpiringPermits() {
    try {
        const expiringPermits = await ipcRenderer.invoke('get-expiring-permits');
        if (expiringPermits.length > 0) {
            showNotification(
                'Expiring Permits Alert',
                `${expiringPermits.length} permit(s) will expire within 7 days. Check the dashboard for details.`,
                'warning'
            );
        }
    } catch (error) {
        console.error('Error checking expiring permits:', error);
    }
}

// Add notification for new revenue
async function checkNewRevenue() {
    try {
        const revenue = await ipcRenderer.invoke('get-revenue-overview');
        if (revenue.todayRevenue > 0) {
            showNotification(
                'Today\'s Revenue Update',
                `Today's revenue: GHS ${revenue.todayRevenue.toFixed(2)}`,
                'success'
            );
        }
    } catch (error) {
        console.error('Error checking revenue:', error);
    }
}

// Check for notifications every hour
setInterval(() => {
    checkExpiringPermits();
    checkNewRevenue();
}, 3600000); // 1 hour

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + D for dashboard
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        document.getElementById('dashboard-tab').click();
    }
    // Ctrl/Cmd + N for new permit
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('create-tab').click();
    }
    // Ctrl/Cmd + S for search
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('search-tab').click();
    }
    // Ctrl/Cmd + Q for quick actions
    if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        const quickActions = document.querySelector('.quick-actions');
        if (quickActions) {
            quickActions.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Add a "Back to Top" button
const backToTopBtn = document.createElement('button');
backToTopBtn.innerHTML = '↑';
backToTopBtn.className = 'btn btn-primary position-fixed bottom-0 end-0 m-3';
backToTopBtn.style.display = 'none';
backToTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
document.body.appendChild(backToTopBtn);

window.addEventListener('scroll', () => {
    backToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
});

// Add a "Quick Actions" menu to the dashboard
function addQuickActionsMenu() {
    const quickActionsDiv = document.createElement('div');
    quickActionsDiv.className = 'quick-actions position-fixed start-0 top-50 translate-middle-y ms-3';
    quickActionsDiv.innerHTML = `
        <div class="btn-group-vertical">
            <button class="btn btn-primary mb-2" onclick="document.getElementById('create-tab').click()">
                <i class="fas fa-plus"></i> New Permit
            </button>
            <button class="btn btn-success mb-2" onclick="document.getElementById('verify-tab').click()">
                <i class="fas fa-check"></i> Verify
            </button>
            <button class="btn btn-info mb-2" onclick="document.getElementById('search-tab').click()">
                <i class="fas fa-search"></i> Search
            </button>
            <button class="btn btn-warning mb-2" onclick="document.getElementById('stats-tab').click()">
                <i class="fas fa-chart-bar"></i> Stats
            </button>
        </div>
    `;
    document.body.appendChild(quickActionsDiv);
}

// Add quick actions menu when dashboard loads
document.getElementById('dashboard-tab').addEventListener('shown.bs.tab', () => {
    if (!document.querySelector('.quick-actions')) {
        addQuickActionsMenu();
    }
});

// Add a "Recent Searches" feature
const recentSearches = new Set();

function addToRecentSearches(query) {
    if (query && query.trim()) {
        recentSearches.add(query.trim());
        if (recentSearches.size > 5) {
            const firstItem = recentSearches.values().next().value;
            recentSearches.delete(firstItem);
        }
        updateRecentSearchesUI();
    }
}

function updateRecentSearchesUI() {
    const searchInput = document.getElementById('searchQuery');
    if (searchInput) {
        const datalist = document.createElement('datalist');
        datalist.id = 'recentSearches';
        recentSearches.forEach(search => {
            const option = document.createElement('option');
            option.value = search;
            datalist.appendChild(option);
        });
        
        const existingDatalist = document.getElementById('recentSearches');
        if (existingDatalist) {
            existingDatalist.remove();
        }
        document.body.appendChild(datalist);
        searchInput.setAttribute('list', 'recentSearches');
    }
}

// Update search form handler to include recent searches
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('searchQuery').value;
    addToRecentSearches(query);
    // ... rest of the existing search handler code ...
});

// Theme Management
function setTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeButtons(theme);
}

function updateThemeButtons(activeTheme) {
    const buttons = {
        light: document.getElementById('lightThemeBtn'),
        dark: document.getElementById('darkThemeBtn'),
        system: document.getElementById('systemThemeBtn')
    };

    Object.entries(buttons).forEach(([theme, button]) => {
        if (theme === activeTheme) {
            button.classList.remove('btn-outline-primary');
            button.classList.add('btn-primary');
        } else {
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline-primary');
        }
    });
}

function handleSystemThemeChange(e) {
    if (localStorage.getItem('theme') === 'system') {
        setTheme(e.matches ? 'dark' : 'light');
    }
}

// Initialize theme
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    if (savedTheme === 'system') {
        setTheme(systemDark.matches ? 'dark' : 'light');
        systemDark.addEventListener('change', handleSystemThemeChange);
    } else {
        setTheme(savedTheme);
    }
}

// Theme button event listeners
document.getElementById('lightThemeBtn').addEventListener('click', () => {
    setTheme('light');
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', handleSystemThemeChange);
});

document.getElementById('darkThemeBtn').addEventListener('click', () => {
    setTheme('dark');
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', handleSystemThemeChange);
});

document.getElementById('systemThemeBtn').addEventListener('click', () => {
    setTheme('system');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(systemDark.matches ? 'dark' : 'light');
    systemDark.addEventListener('change', handleSystemThemeChange);
});

// Initialize theme when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    // ... rest of your existing DOMContentLoaded code ...
});