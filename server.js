const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// SendGrid Setup (we'll use environment variable)
// For now, use a placeholder - you need to set SENDGRID_API_KEY in .env
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'your-sendgrid-api-key-here';
sgMail.setApiKey(SENDGRID_API_KEY);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB Schemas
const AdminAccountSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    createdDate: { type: Date, default: Date.now }
});

const VerificationCodeSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, default: () => new Date(+new Date() + 15*60000) }, // 15 minutes
    attempts: { type: Number, default: 0 }
});

const AdminAccount = mongoose.model('AdminAccount', AdminAccountSchema);
const VerificationCode = mongoose.model('VerificationCode', VerificationCodeSchema);

// Approved Teachers List
const APPROVED_TEACHERS = [
    'surugi64@gmail.com'
];

// Helper function to generate 6-digit code
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Path to enrollment database file (keep for backward compatibility)
const enrollmentDbPath = path.join(__dirname, 'enrollments.json');

// Initialize database file if it doesn't exist
if (!fs.existsSync(enrollmentDbPath)) {
    fs.writeFileSync(enrollmentDbPath, JSON.stringify({ enrollments: [] }, null, 2));
}

// Helper function to read enrollment data
function readEnrollments() {
    try {
        const data = fs.readFileSync(enrollmentDbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading enrollments:', error);
        return { enrollments: [] };
    }
}

// Helper function to write enrollment data
function writeEnrollments(data) {
    try {
        fs.writeFileSync(enrollmentDbPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing enrollments:', error);
        return false;
    }
}

// Save enrollment data
app.post('/api/enroll', (req, res) => {
    try {
        const enrollmentData = req.body;
        
        // Validate request data
        if (!enrollmentData || typeof enrollmentData !== 'object') {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid request data' 
            });
        }
        
        const db = readEnrollments();
        
        // Ensure enrollments array exists
        if (!db.enrollments || !Array.isArray(db.enrollments)) {
            console.error('Invalid database structure:', db);
            return res.status(500).json({ 
                success: false, 
                message: 'Database error' 
            });
        }
        
        // Add timestamp and unique ID
        enrollmentData.id = Date.now();
        enrollmentData.enrollmentDate = new Date().toISOString();
        
        // Generate formatted enrollment ID: YYYY-000001
        const currentYear = new Date().getFullYear();
        const enrollmentsThisYear = db.enrollments.filter(e => {
            try {
                const eYear = new Date(e.enrollmentDate).getFullYear();
                return eYear === currentYear;
            } catch (e) {
                return false;
            }
        }).length;
        const sequentialNumber = String(enrollmentsThisYear + 1).padStart(6, '0');
        enrollmentData.enrollmentID = `${currentYear}-${sequentialNumber}`;
        
        // Add to enrollments array
        db.enrollments.push(enrollmentData);
        
        // Write to file
        const success = writeEnrollments(db);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Enrollment saved successfully',
                enrollmentId: enrollmentData.enrollmentID
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to save enrollment to database' 
            });
        }
    } catch (error) {
        console.error('Error processing enrollment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error: ' + error.message 
        });
    }
});

// Get all enrollments
app.get('/api/enrollments', (req, res) => {
    try {
        const db = readEnrollments();
        res.json(db.enrollments);
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching enrollments' 
        });
    }
});

// Get enrollment by ID
app.get('/api/enrollments/:id', (req, res) => {
    try {
        const db = readEnrollments();
        const enrollment = db.enrollments.find(e => e.id === parseInt(req.params.id));
        
        if (enrollment) {
            res.json(enrollment);
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Enrollment not found' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching enrollment' 
        });
    }
});

// Update enrollment
app.put('/api/enrollments/:id', (req, res) => {
    try {
        const db = readEnrollments();
        const index = db.enrollments.findIndex(e => e.id === parseInt(req.params.id));
        
        if (index !== -1) {
            // Update student info while preserving other fields
            if (req.body.studentInfo) {
                db.enrollments[index].studentInfo = {
                    ...db.enrollments[index].studentInfo,
                    ...req.body.studentInfo
                };
            }
            
            writeEnrollments(db);
            res.json({ 
                success: true, 
                message: 'Enrollment updated successfully',
                enrollment: db.enrollments[index]
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Enrollment not found' 
            });
        }
    } catch (error) {
        console.error('Error updating enrollment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating enrollment: ' + error.message
        });
    }
});

// Delete enrollment
app.delete('/api/enrollments/:id', (req, res) => {
    try {
        const db = readEnrollments();
        const index = db.enrollments.findIndex(e => e.id === parseInt(req.params.id));
        
        if (index !== -1) {
            db.enrollments.splice(index, 1);
            writeEnrollments(db);
            res.json({ 
                success: true, 
                message: 'Enrollment deleted successfully' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Enrollment not found' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting enrollment' 
        });
    }
});

// Get analytics data
app.get('/api/analytics', (req, res) => {
    try {
        const db = readEnrollments();
        const enrollments = db.enrollments;

        const analytics = {
            totalEnrollments: enrollments.length,
            byStrand: {
                stem: enrollments.filter(e => e.studentInfo.strand === 'stem').length,
                humss: enrollments.filter(e => e.studentInfo.strand === 'humss').length,
                abm: enrollments.filter(e => e.studentInfo.strand === 'abm').length,
                tvl: enrollments.filter(e => e.studentInfo.strand === 'tvl').length
            },
            byGender: {
                male: enrollments.filter(e => e.studentInfo.sex === 'male').length,
                female: enrollments.filter(e => e.studentInfo.sex === 'female').length
            },
            byGradeLevel: {
                '11': enrollments.filter(e => e.studentInfo.gradeLevel === '11').length,
                '12': enrollments.filter(e => e.studentInfo.gradeLevel === '12').length
            },
            averageGWA: (enrollments.reduce((sum, e) => sum + parseFloat(e.studentInfo.gwa || 0), 0) / (enrollments.length || 1)).toFixed(2),
            todayEnrollments: enrollments.filter(e => {
                const enrollDate = new Date(e.enrollmentDate).toDateString();
                const today = new Date().toDateString();
                return enrollDate === today;
            }).length
        };

        res.json(analytics);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching analytics' 
        });
    }
});

// Get daily enrollments for bar chart
app.get('/api/analytics/daily', (req, res) => {
    try {
        const db = readEnrollments();
        const enrollments = db.enrollments;
        const dailyData = {};

        // Group enrollments by date
        enrollments.forEach(enrollment => {
            const date = new Date(enrollment.enrollmentDate).toISOString().split('T')[0];
            dailyData[date] = (dailyData[date] || 0) + 1;
        });

        // Convert to array format for charting
        const chartData = Object.entries(dailyData).map(([date, count]) => ({
            date: date,
            count: count,
            displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json(chartData);
    } catch (error) {
        console.error('Error fetching daily analytics:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching daily analytics' 
        });
    }
});

// Get statistics by strand
app.get('/api/analytics/strand/:strand', (req, res) => {
    try {
        const db = readEnrollments();
        const strand = req.params.strand;
        const strandEnrollments = db.enrollments.filter(e => e.studentInfo.strand === strand);

        res.json({
            strand: strand,
            count: strandEnrollments.length,
            byGrade: {
                '11': strandEnrollments.filter(e => e.studentInfo.gradeLevel === '11').length,
                '12': strandEnrollments.filter(e => e.studentInfo.gradeLevel === '12').length
            },
            byGender: {
                male: strandEnrollments.filter(e => e.studentInfo.sex === 'male').length,
                female: strandEnrollments.filter(e => e.studentInfo.sex === 'female').length
            },
            averageGWA: (strandEnrollments.reduce((sum, e) => sum + parseFloat(e.studentInfo.gwa || 0), 0) / (strandEnrollments.length || 1)).toFixed(2)
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching strand analytics' 
        });
    }
});

// Teacher endpoints for managing enrollments
app.get('/api/teacher/enrollments', (req, res) => {
    try {
        const db = readEnrollments();
        res.json({
            success: true,
            count: db.enrollments.length,
            enrollments: db.enrollments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching enrollments'
        });
    }
});

app.get('/api/teacher/enrollments/filter', (req, res) => {
    try {
        const { strand, gradeLevel } = req.query;
        const db = readEnrollments();
        
        let filtered = db.enrollments;
        
        if (strand) {
            filtered = filtered.filter(e => e.studentInfo.strand === strand);
        }
        
        if (gradeLevel) {
            filtered = filtered.filter(e => e.studentInfo.gradeLevel === gradeLevel);
        }
        
        res.json({
            success: true,
            count: filtered.length,
            enrollments: filtered
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error filtering enrollments'
        });
    }
});

app.post('/api/teacher/enrollments/:id/verify', (req, res) => {
    try {
        const db = readEnrollments();
        const index = db.enrollments.findIndex(e => e.id === parseInt(req.params.id));
        
        if (index !== -1) {
            db.enrollments[index].verificationStatus = 'verified';
            db.enrollments[index].verificationDate = new Date().toISOString();
            
            writeEnrollments(db);
            res.json({
                success: true,
                message: 'Enrollment verified successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Enrollment not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error verifying enrollment'
        });
    }
});

app.post('/api/teacher/enrollments/:id/reject', (req, res) => {
    try {
        const { reason } = req.body;
        const db = readEnrollments();
        const index = db.enrollments.findIndex(e => e.id === parseInt(req.params.id));
        
        if (index !== -1) {
            db.enrollments[index].verificationStatus = 'rejected';
            db.enrollments[index].rejectionReason = reason || 'No reason provided';
            db.enrollments[index].rejectionDate = new Date().toISOString();
            
            writeEnrollments(db);
            res.json({
                success: true,
                message: 'Enrollment rejected successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Enrollment not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error rejecting enrollment'
        });
    }

// ========== EMAIL VERIFICATION SYSTEM ==========

// Step 1: Request verification code
app.post('/api/admin/request-code', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }
        
        // Check if email is approved
        if (!APPROVED_TEACHERS.includes(email)) {
            return res.status(403).json({ 
                success: false, 
                message: 'This email is not authorized to create an account' 
            });
        }
        
        // Check if account already exists
        const existingAccount = await AdminAccount.findOne({ email });
        if (existingAccount) {
            return res.status(400).json({ 
                success: false, 
                message: 'An account with this email already exists' 
            });
        }
        
        // Generate and save verification code
        const code = generateVerificationCode();
        await VerificationCode.updateOne(
            { email },
            { email, code, expiresAt: new Date(+new Date() + 15*60000) },
            { upsert: true }
        );
        
        // Send email with code
        try {
            await sgMail.send({
                to: email,
                from: 'surugi64@gmail.com',
                subject: 'SHA Enrollment System - Verification Code',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #00A693; color: white; padding: 20px; border-radius: 5px; text-align: center;">
                            <h2>Sacred Heart Academy</h2>
                            <p>Enrollment System</p>
                        </div>
                        <div style="padding: 20px; background: #f9f9f9;">
                            <h3>Verification Code</h3>
                            <p>Your verification code is:</p>
                            <div style="background: white; padding: 20px; border: 2px dashed #00A693; border-radius: 5px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #003F39;">
                                ${code}
                            </div>
                            <p>This code will expire in 15 minutes.</p>
                            <p style="color: #666; font-size: 12px;">If you did not request this code, please ignore this email.</p>
                        </div>
                    </div>
                `
            });
            
            res.json({ 
                success: true, 
                message: 'Verification code sent to your email' 
            });
        } catch (emailError) {
            console.error('SendGrid Error:', emailError);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to send verification code. Please check email configuration.' 
            });
        }
    } catch (error) {
        console.error('Error requesting verification code:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error: ' + error.message 
        });
    }
});

// Step 2: Verify code and create account
app.post('/api/admin/verify-code', async (req, res) => {
    try {
        const { email, code, username, password } = req.body;
        
        if (!email || !code || !username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, code, username, and password are required' 
            });
        }
        
        // Check if code is valid
        const verificationRecord = await VerificationCode.findOne({ email, code });
        
        if (!verificationRecord) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid verification code' 
            });
        }
        
        // Check if code expired
        if (new Date() > verificationRecord.expiresAt) {
            return res.status(400).json({ 
                success: false, 
                message: 'Verification code has expired' 
            });
        }
        
        // Check if username is available
        const existingUsername = await AdminAccount.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username already taken' 
            });
        }
        
        // Create new account
        const newAccount = new AdminAccount({
            email,
            username,
            password, // In production, use bcrypt to hash passwords
            verified: true
        });
        
        await newAccount.save();
        
        // Delete used verification code
        await VerificationCode.deleteOne({ email, code });
        
        res.json({ 
            success: true, 
            message: 'Account created successfully! You can now login.' 
        });
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error: ' + error.message 
        });
    }
});

// Step 3: Login with username and password
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        // Find account
        const account = await AdminAccount.findOne({ username, password });
        
        if (!account) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Login successful',
            admin: { 
                id: account._id, 
                username: account.username, 
                email: account.email,
                verified: account.verified
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error: ' + error.message 
        });
    }
});

// Routing for different views
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Beta-test-final and home updated file', 'student-home.html'));
});

app.get('/teacher', (req, res) => {
    res.sendFile(path.join(__dirname, 'Home.html'));
});

app.get('/teacher-home', (req, res) => {
    res.sendFile(path.join(__dirname, 'Home.html'));
});

app.get('/student', (req, res) => {
    res.sendFile(path.join(__dirname, 'Beta-test-final and home updated file', 'student-home.html'));
});

app.get('/student-home', (req, res) => {
    res.sendFile(path.join(__dirname, 'Beta-test-final and home updated file', 'student-home.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ SHA Enrollment Server running at http://localhost:${PORT}`);
    console.log(`📦 Enrollment data stored in: ${enrollmentDbPath}`);
    console.log(`🗄️  MongoDB Database: Connected`);
    console.log(`📧 Email Service: SendGrid configured`);
});
