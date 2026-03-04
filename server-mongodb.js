require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sha-enrollment';

// SendGrid Setup
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'your-sendgrid-api-key-here';
sgMail.setApiKey(SENDGRID_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Import Models
const Enrollment = require('./models/Enrollment');

// MongoDB Schemas for Admin Accounts
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
    expiresAt: { type: Date, default: () => new Date(+new Date() + 15*60000) },
    attempts: { type: Number, default: 0 }
});

const AdminAccount = mongoose.model('AdminAccount', AdminAccountSchema);
const VerificationCode = mongoose.model('VerificationCode', VerificationCodeSchema);

// Approved Teachers List
const APPROVED_TEACHERS = ['surugi64@gmail.com'];

// Helper function to generate 6-digit code
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    // Fallback to allow server to start even if DB is down
});

// Connection event listeners for better debugging
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ Mongoose disconnected from MongoDB');
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    next();
});

// ===== OLD STUDENT VERIFICATION ROUTES =====

// Get old student by enrollment ID and verify name
app.post('/api/old-student/verify-id', async (req, res) => {
    try {
        const { enrollmentID } = req.body;
        
        if (!enrollmentID) {
            return res.status(400).json({
                success: false,
                message: 'Enrollment ID is required'
            });
        }
        
        // Find enrollment by ID
        const enrollment = await Enrollment.findOne({ enrollmentID });
        
        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: 'Enrollment ID not found. Please verify and try again.'
            });
        }
        
        res.json({
            success: true,
            studentName: `${enrollment.studentInfo.firstName} ${enrollment.studentInfo.lastName}`,
            lrn: enrollment.studentInfo.lrn,
            enrollmentData: enrollment
        });
    } catch (error) {
        console.error('Error verifying enrollment ID:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying enrollment ID'
        });
    }
});

// Verify LRN for old student
app.post('/api/old-student/verify-lrn', async (req, res) => {
    try {
        const { enrollmentID, lrn } = req.body;
        
        if (!enrollmentID || !lrn) {
            return res.status(400).json({
                success: false,
                message: 'Enrollment ID and LRN are required'
            });
        }
        
        // Find and verify
        const enrollment = await Enrollment.findOne({ enrollmentID });
        
        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: 'You either have not enrolled in the school yet or provided an incorrect Enrollment ID. Please cooperate with the teachers regarding your situation.'
            });
        }
        
        if (enrollment.studentInfo.lrn !== lrn) {
            return res.status(401).json({
                success: false,
                message: 'You either have not enrolled in the school yet or provided an incorrect Enrollment ID. Please cooperate with the teachers regarding your situation.'
            });
        }
        
        // Return full enrollment data for auto-fill
        res.json({
            success: true,
            message: 'Identity verified successfully',
            enrollmentData: enrollment
        });
    } catch (error) {
        console.error('Error verifying LRN:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying LRN'
        });
    }
});

// ===== HELPER FUNCTION: Generate Enrollment ID =====
async function generateEnrollmentID(gradeLevel) {
    const year = new Date().getFullYear();
    // Get count of enrollments for this year
    const count = await Enrollment.countDocuments({
        enrollmentDate: {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1)
        }
    });
    const sequentialNumber = String(count + 1).padStart(5, '0');
    return `${year}-${sequentialNumber}`;
}

// ===== ENROLLMENT ROUTES =====

// Save/Create new enrollment
app.post('/api/enroll', async (req, res) => {
    try {
        const enrollmentData = req.body;
        
        // Validate required fields
        if (!enrollmentData.studentInfo?.lrn) {
            return res.status(400).json({
                success: false,
                message: 'Student LRN is required'
            });
        }

        if (!enrollmentData.studentInfo?.firstName || !enrollmentData.studentInfo?.lastName) {
            return res.status(400).json({
                success: false,
                message: 'Student first name and last name are required'
            });
        }

        // Check if student with this LRN already exists (for new students only)
        if (enrollmentData.isNewStudent !== false) {
            const existingEnrollment = await Enrollment.findOne({
                'studentInfo.lrn': enrollmentData.studentInfo.lrn
            });

            if (existingEnrollment) {
                return res.status(400).json({
                    success: false,
                    message: `Student with LRN ${enrollmentData.studentInfo.lrn} is already enrolled`
                });
            }
        }
        
        // Generate unique ID using timestamp
        const enrollmentId = Date.now();
        enrollmentData.id = enrollmentId;
        
        // Generate formatted enrollment ID (YYYY-XXXXX) - but not for old students
        let enrollmentID;
        if (enrollmentData.enrollmentID) {
            // Old student - keep their existing ID
            enrollmentID = enrollmentData.enrollmentID;
        } else {
            // New student - generate new ID
            enrollmentID = await generateEnrollmentID(enrollmentData.studentInfo.gradeLevel);
            enrollmentData.enrollmentID = enrollmentID;
        }
        
        enrollmentData.enrollmentDate = new Date();
        
        // Handle old student update
        if (enrollmentData.enrollmentID && enrollmentData.isNewStudent === false) {
            // Update existing enrollment
            await Enrollment.updateOne(
                { enrollmentID: enrollmentData.enrollmentID },
                enrollmentData
            );
        } else {
            // Create new enrollment
            const enrollment = new Enrollment(enrollmentData);
            await enrollment.save();
        }
        
        console.log(`✅ New enrollment saved: EnrollmentID=${enrollmentID}, LRN=${enrollmentData.studentInfo.lrn}`);
        
        res.json({ 
            success: true, 
            message: 'Enrollment saved successfully',
            enrollmentId: enrollmentID
        });
    } catch (error) {
        console.error('❌ Error saving enrollment:', error.message);
        
        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `A student with this ${field} already exists`
            });
        }
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error: ' + messages.join(', ')
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error saving enrollment: ' + error.message 
        });
    }
});

// Get all enrollments
app.get('/api/enrollments', async (req, res) => {
    try {
        const enrollments = await Enrollment.find().sort({ enrollmentDate: -1 });
        console.log(`✅ Retrieved ${enrollments.length} enrollments`);
        res.json(enrollments);
    } catch (error) {
        console.error('❌ Error fetching enrollments:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching enrollments: ' + error.message
        });
    }
});

// Get single enrollment by ID
app.get('/api/enrollments/:id', async (req, res) => {
    try {
        const enrollment = await Enrollment.findOne({ id: parseInt(req.params.id) });
        
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
app.put('/api/enrollments/:id', async (req, res) => {
    try {
        const enrollmentId = parseInt(req.params.id);
        const updateData = req.body;
        
        const enrollment = await Enrollment.findOneAndUpdate(
            { id: enrollmentId },
            updateData,
            { new: true, runValidators: true }
        );
        
        if (enrollment) {
            res.json({ 
                success: true, 
                message: 'Enrollment updated successfully',
                enrollment: enrollment
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Enrollment not found' 
            });
        }
    } catch (error) {
        console.error('❌ Error updating enrollment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating enrollment: ' + error.message
        });
    }
});

// Delete enrollment
app.delete('/api/enrollments/:id', async (req, res) => {
    try {
        const result = await Enrollment.findOneAndDelete({ id: parseInt(req.params.id) });
        
        if (result) {
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
app.get('/api/analytics', async (req, res) => {
    try {
        const enrollments = await Enrollment.find();

        const analytics = {
            totalEnrollments: enrollments.length,
            byStrand: {
                stem: enrollments.filter(e => e.studentInfo?.strand === 'stem').length,
                humss: enrollments.filter(e => e.studentInfo?.strand === 'humss').length,
                abm: enrollments.filter(e => e.studentInfo?.strand === 'abm').length,
                'tvl-ict': enrollments.filter(e => e.studentInfo?.strand === 'tvl-ict').length,
                'tvl-he': enrollments.filter(e => e.studentInfo?.strand === 'tvl-he').length,
                gas: enrollments.filter(e => e.studentInfo?.strand === 'gas').length
            },
            byGender: {
                male: enrollments.filter(e => e.studentInfo?.sex === 'male').length,
                female: enrollments.filter(e => e.studentInfo?.sex === 'female').length
            },
            byGradeLevel: {
                '11': enrollments.filter(e => e.studentInfo?.gradeLevel === '11').length,
                '12': enrollments.filter(e => e.studentInfo?.gradeLevel === '12').length
            },
            averageGWA: (enrollments.reduce((sum, e) => sum + parseFloat(e.studentInfo?.gwa || 0), 0) / (enrollments.length || 1)).toFixed(2),
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

// Get statistics by strand
app.get('/api/analytics/strand/:strand', async (req, res) => {
    try {
        const strand = req.params.strand;
        const strandEnrollments = await Enrollment.find({ 'studentInfo.strand': strand });

        res.json({
            strand: strand,
            count: strandEnrollments.length,
            byGrade: {
                '11': strandEnrollments.filter(e => e.studentInfo?.gradeLevel === '11').length,
                '12': strandEnrollments.filter(e => e.studentInfo?.gradeLevel === '12').length
            },
            byGender: {
                male: strandEnrollments.filter(e => e.studentInfo?.sex === 'male').length,
                female: strandEnrollments.filter(e => e.studentInfo?.sex === 'female').length
            },
            averageGWA: (strandEnrollments.reduce((sum, e) => sum + parseFloat(e.studentInfo?.gwa || 0), 0) / (strandEnrollments.length || 1)).toFixed(2)
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching strand analytics' 
        });
    }
});

// ===== ADMIN ROUTES =====

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
                from: process.env.SENDER_EMAIL || 'surugi64@gmail.com',
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
            password,
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
        console.error('❌ Error during login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error during login: ' + error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        message: 'SHA Enrollment System is running',
        mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Catch-all for static files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

// Start server
const server = app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║  SHA Enrollment System Server Running  ║');
    console.log(`║  Port: ${PORT}                                   ║`);
    console.log(`║  MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ⚠️'}           ║`);
    console.log('╚════════════════════════════════════════╝');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close();
    });
});
