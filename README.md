# SRC Permit Management System

A comprehensive permit management system for the Student Representative Council (SRC) to manage and track student permits.

## Features

### User Management
- Secure login system with role-based access
- SRC-specific roles (President, Vice President, Treasurer, etc.)
- Session persistence (automatic login after app restart)
- Account management (create, login, logout, delete)

### Permit Management
- Create student permits with detailed information
- Generate unique permit codes with QR codes
- Set validity periods for permits
- Automatic permit expiration
- Verify permit authenticity
- Revoke permits when necessary
- Delete permits with confirmation

### Student Information
- Comprehensive student details:
  - Student ID
  - Full Name
  - Email
  - Course
  - Level
  - Contact Number
  - Amount Paid
  - Permit Status
  - Validity Period
  - Permit Code
  - Creator Information

### Search and Verification
- Advanced search functionality
- Complete student information display
- Permit verification system
- Creator tracking for accountability

### Additional Features
- Bulk import/export of student data
- Audit logging for all actions
- Database backup and restore
- Statistical reporting
- QR code generation for permits

## Installation

1. Ensure you have Node.js installed (version 14 or higher)
2. Clone the repository
3. Install dependencies:
```bash
npm install
```

## Setup

1. Install required dependencies:
```bash
npm install electron sqlite3 bcryptjs qrcode nodemailer csv-parser
```

2. Create a `database` folder in the project root:
```bash
mkdir database
```

3. Start the application:
```bash
npm start
```

## Usage

### First-Time Setup
1. Launch the application
2. Create an account using the Sign Up form
3. Select your SRC role
4. Log in with your credentials

### Creating Permits
1. Navigate to the "Create Permit" tab
2. Fill in the student's information:
   - Student ID
   - Full Name
   - Email
   - Course
   - Level
   - Contact Number
   - Amount Paid
   - Validity Period (in days)
3. Submit the form to generate the permit
4. The system will display the permit code and QR code

### Verifying Permits
1. Go to the "Verify Permit" tab
2. Enter the permit code
3. The system will display the student's information if the permit is valid

### Searching Students
1. Use the "Search" tab
2. Enter any search criteria (ID, name, course, etc.)
3. View complete student information including permit details

### Managing Permits
- Revoke permits from the "Revoke Permit" tab
- Delete permits from the "Delete Student" tab
- View permit statistics in the "Reports" tab

### Data Management
- Import student data using CSV files
- Export student data to CSV
- Backup and restore the database
- View audit logs

## Security Features
- Secure password hashing
- Session persistence
- Role-based access control
- Audit logging for accountability
- Automatic permit expiration

## Technical Details

### Database Structure
- SQLite database for data storage
- Tables:
  - students (permit information)
  - users (SRC member accounts)
  - audit_logs (action tracking)

### File Structure
```
src-permit/
├── database/
│   └── permits.db
├── main.js
├── renderer.js
├── index.html
├── package.json
└── README.md
```

## Support

For technical support or questions, please contact the SRC IT team.

## License

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited. 