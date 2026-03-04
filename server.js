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

// Cache-busting middleware - prevent browser caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

app.use(express.static(__dirname));

// MongoDB Schemas
// Import Enrollment Model
const Enrollment = require('./models/Enrollment.js');

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

// Approved Teachers List - Load from file
let APPROVED_TEACHERS = [];
function loadApprovedTeachers() {
    try {
        const filePath = path.join(__dirname, 'admin-authorized.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(data);
            APPROVED_TEACHERS = parsed.authorizedEmails || [];
            console.log(`✅ Loaded ${APPROVED_TEACHERS.length} authorized teacher emails`);
        } else {
            console.warn('❌ admin-authorized.json not found, using defaults');
            APPROVED_TEACHERS = ['surugi64@gmail.com'];
        }
    } catch (error) {
        console.error('Error loading authorized teachers:', error);
        APPROVED_TEACHERS = ['surugi64@gmail.com'];
    }
}

// Load on startup
loadApprovedTeachers();

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
        
        const isOldStudent = enrollmentData.isOldStudent || false;
        const db = readEnrollments();
        
        // Ensure enrollments array exists
        if (!db.enrollments || !Array.isArray(db.enrollments)) {
            console.error('Invalid database structure:', db);
            return res.status(500).json({ 
                success: false, 
                message: 'Database error' 
            });
        }
        
        // For old students, check if they're re-enrolling with the same LRN
        if (isOldStudent && enrollmentData.studentInfo && enrollmentData.studentInfo.lrn) {
            const lrn = enrollmentData.studentInfo.lrn;
            console.log(`🔍 Checking if old student LRN ${lrn} already exists...`);
            
            // Find existing enrollment with same LRN
            const existingIndex = db.enrollments.findIndex(e => 
                e.studentInfo && e.studentInfo.lrn === lrn
            );
            
            if (existingIndex !== -1) {
                console.log(`✅ Found existing enrollment for old student LRN ${lrn}, updating instead of creating new...`);
                
                // Update existing enrollment instead of creating new
                const updatedData = {
                    ...db.enrollments[existingIndex],
                    ...enrollmentData,
                    id: db.enrollments[existingIndex].id, // Keep original ID
                    enrollmentDate: new Date().toISOString(),
                    studentInfo: {
                        ...db.enrollments[existingIndex].studentInfo,
                        ...enrollmentData.studentInfo
                    }
                };
                
                db.enrollments[existingIndex] = updatedData;
                
                // Write to file
                const success = writeEnrollments(db);
                
                if (success) {
                    return res.json({ 
                        success: true, 
                        message: 'Old student enrollment updated successfully',
                        enrollmentId: updatedData.enrollmentID || db.enrollments[existingIndex].enrollmentID
                    });
                } else {
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Failed to update enrollment to database' 
                    });
                }
            }
        }
        
        // For new students, check for duplicate LRN
        if (!isOldStudent && enrollmentData.studentInfo && enrollmentData.studentInfo.lrn) {
            const lrn = enrollmentData.studentInfo.lrn;
            const existingStudent = db.enrollments.find(e => 
                e.studentInfo && e.studentInfo.lrn === lrn
            );
            
            if (existingStudent) {
                console.log(`❌ Duplicate LRN detected for new student: ${lrn}`);
                return res.status(400).json({ 
                    success: false, 
                    message: 'LRN already exists in the system. Please verify your LRN is correct.' 
                });
            }
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
            const logType = isOldStudent ? '🔄 Old Student Re-enrollment' : '✨ New Student Enrollment';
            console.log(`${logType} saved: ${enrollmentData.enrollmentID}`);
            
            res.json({ 
                success: true, 
                message: isOldStudent ? 'Old student enrollment updated successfully' : 'Enrollment saved successfully',
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

// ===== OLD STUDENT VERIFICATION ENDPOINTS =====

// Verify enrollment ID exists and get student name
app.post('/api/old-student/verify-id', async (req, res) => {
    try {
        const { enrollmentID } = req.body;
        if (!enrollmentID) {
            return res.status(400).json({ success: false, message: 'Enrollment ID is required' });
        }

        // Try MongoDB first
        if (mongoose.connection.readyState === 1) {
            const enrollment = await Enrollment.findOne({ 
                enrollmentID: enrollmentID 
            });

            if (enrollment && enrollment.studentInfo) {
                const studentName = `${enrollment.studentInfo.firstName} ${enrollment.studentInfo.lastName}`;
                return res.json({
                    success: true,
                    studentName: studentName,
                    enrollmentID: enrollmentID,
                    enrollmentData: enrollment,
                    source: 'mongodb'
                });
            }
        }
        
        // Fallback to JSON file
        const db = readEnrollments();
        const enrollment = db.enrollments.find(e => e.enrollmentID === enrollmentID);

        if (enrollment && enrollment.studentInfo) {
            const studentName = `${enrollment.studentInfo.firstName} ${enrollment.studentInfo.lastName}`;
            res.json({
                success: true,
                studentName: studentName,
                enrollmentID: enrollmentID,
                enrollmentData: enrollment,
                source: 'json'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Enrollment ID not found'
            });
        }
    } catch (error) {
        console.error('Error verifying enrollment ID:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying enrollment ID'
        });
    }
});

// Verify LRN matches the enrollment
app.post('/api/old-student/verify-lrn', async (req, res) => {
    try {
        const { enrollmentID, lrn } = req.body;
        if (!enrollmentID || !lrn) {
            return res.status(400).json({ success: false, message: 'Enrollment ID and LRN are required' });
        }

        // Try MongoDB first
        if (mongoose.connection.readyState === 1) {
            const enrollment = await Enrollment.findOne({ 
                enrollmentID: enrollmentID,
                'studentInfo.lrn': lrn
            });

            if (enrollment && enrollment.studentInfo) {
                return res.json({
                    success: true,
                    message: 'LRN verified successfully',
                    enrollmentData: enrollment,
                    source: 'mongodb'
                });
            }
        }
        
        // Fallback to JSON file
        const db = readEnrollments();
        const enrollment = db.enrollments.find(e => 
            e.enrollmentID === enrollmentID && 
            e.studentInfo && 
            e.studentInfo.lrn === lrn
        );

        if (enrollment && enrollment.studentInfo) {
            res.json({
                success: true,
                message: 'LRN verified successfully',
                enrollmentData: enrollment,
                source: 'json'
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'LRN does not match or enrollment ID not found'
            });
        }
    } catch (error) {
        console.error('Error verifying LRN:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying LRN'
        });
    }
});

// Get enrollment data by enrollmentID
app.get('/api/old-student/:enrollmentID', (req, res) => {
    try {
        const { enrollmentID } = req.params;
        const db = readEnrollments();
        const enrollment = db.enrollments.find(e => e.enrollmentID === enrollmentID);

        if (enrollment) {
            res.json({
                success: true,
                enrollmentData: enrollment
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Enrollment not found'
            });
        }
    } catch (error) {
        console.error('Error fetching enrollment:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching enrollment'
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
});

// ========== SIMPLIFIED ADMIN AUTHENTICATION ==========

// Step 1: Check if email is authorized (whitelist verification)
app.post('/api/admin/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid email is required' 
            });
        }
        
        const trimmedEmail = email.trim().toLowerCase();
        
        // Check if email is in approved list
        const isApproved = APPROVED_TEACHERS.some(approvedEmail => 
            approvedEmail.toLowerCase() === trimmedEmail
        );
        
        if (!isApproved) {
            console.log(`❌ Unauthorized email attempted admin access: ${trimmedEmail}`);
            return res.status(403).json({ 
                success: false, 
                message: 'This email is not authorized. Please contact your administrator.' 
            });
        }
        
        // Check if account already exists
        const existingAccount = await AdminAccount.findOne({ 
            email: { $regex: `^${trimmedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } 
        });
        
        if (existingAccount) {
            console.log(`⚠️ Account already exists for authorized email: ${trimmedEmail}`);
            return res.status(400).json({ 
                success: false, 
                message: 'Account already exists for this email. Please login instead.' 
            });
        }
        
        console.log(`✅ Email verified as authorized: ${trimmedEmail}`);
        res.json({ 
            success: true, 
            message: 'Email verified. Proceed to account creation.',
            email: trimmedEmail
        });
    } catch (error) {
        console.error('Error checking email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// Step 2: Create account (simplified - no verification codes needed)
app.post('/api/admin/create-account', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        
        // Validate input
        if (!email || !username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, username, and password are required' 
            });
        }
        
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedUsername = username.trim();
        
        // Verify email is authorized
        const isAuthorized = APPROVED_TEACHERS.some(t => t.toLowerCase() === trimmedEmail);
        if (!isAuthorized) {
            console.warn(`🚨 Unauthorized email attempted account creation: ${trimmedEmail}`);
            return res.status(403).json({ 
                success: false, 
                message: 'This email is not authorized to create an admin account' 
            });
        }
        
        // Check if username is available
        const existingUsername = await AdminAccount.findOne({ 
            username: { $regex: `^${trimmedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } 
        });
        if (existingUsername) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username already taken' 
            });
        }
        
        // Check if email already has an account
        const existingEmail = await AdminAccount.findOne({ 
            email: { $regex: `^${trimmedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } 
        });
        if (existingEmail) {
            return res.status(400).json({ 
                success: false, 
                message: 'An account with this email already exists' 
            });
        }
        
        // Create new account
        const newAccount = new AdminAccount({
            email: trimmedEmail,
            username: trimmedUsername,
            password, // In production, use bcrypt to hash passwords
            verified: true
        });
        
        await newAccount.save();
        
        console.log(`✅ New admin account created: ${trimmedUsername} (${trimmedEmail})`);
        
        res.json({ 
            success: true, 
            message: 'Account created successfully! Please login with your credentials.',
            account: {
                id: newAccount._id,
                username: newAccount.username,
                email: newAccount.email
            }
        });
    } catch (error) {
        console.error('Error creating account:', error);
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

// Verify admin session (backend validation for dashboard)
app.post('/api/admin/verify-session', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username is required' 
            });
        }
        
        // Verify account exists in database
        const account = await AdminAccount.findOne({ username });
        
        if (!account) {
            return res.status(401).json({ 
                success: false, 
                message: 'Admin account not found'
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Session is valid',
            admin: { 
                id: account._id, 
                username: account.username, 
                email: account.email,
                verified: account.verified
            }
        });
    } catch (error) {
        console.error('Error verifying session:', error);
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
