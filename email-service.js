const nodemailer = require('nodemailer');

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'knutsforduniversitysrc@gmail.com',
        pass: 'krfp zrac sudd tprt'    // Your Gmail App Password
    },
    tls: {
        rejectUnauthorized: false
    }
});

async function sendEmail({ to, subject, text, html }) {
    try {
        const mailOptions = {
            from: {
                name: 'Knutsford University SRC',
                address: 'knutsforduniversitysrc@gmail.com'
            },
            to,
            subject,
            text,
            html,
            headers: {
                'X-Entity-Ref-ID': Date.now().toString(),
                'X-Auto-Response-Suppress': 'OOF, AutoReply',
                'Precedence': 'bulk'
            },
            priority: 'high',
            date: new Date()
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Error sending email:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

module.exports = { sendEmail }; 