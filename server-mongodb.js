require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sha-enrollment';

// SendGrid Setup
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'your-sendgrid-api-key-here';
sgMail.setApiKey(SENDGRID_API_KEY);

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

// Load Approved Teachers from JSON file
function loadApprovedTeachers() {
    try {
        const filePath = path.join(__dirname, 'admin-authorized.json');
        const data = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(data);
        return json.authorizedEmails || [];
    } catch (error) {
        console.error('Error loading admin-authorized.json:', error);
        return [];
    }
}

let APPROVED_TEACHERS = loadApprovedTeachers();
console.log(`✅ Loaded ${APPROVED_TEACHERS.length} authorized teacher emails`);

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
    
    // Get ALL enrollments for this year, sorted by enrollmentID
    const allEnrollments = await Enrollment.find({
        enrollmentID: { $regex: `^${year}-` }
    }, { enrollmentID: 1 }).sort({ enrollmentID: 1 });
    
    // Find the first gap in the sequence starting from 1
    let nextNumber = 1;
    
    if (allEnrollments.length > 0) {
        // Check each position starting from 1
        for (let i = 0; i < allEnrollments.length; i++) {
            const currentNumber = parseInt(allEnrollments[i].enrollmentID.split('-')[1]);
            
            // If current number is higher than expected, we found a gap
            if (currentNumber > nextNumber) {
                break; // Use nextNumber (the gap)
            }
            
            // Move to next number to check
            nextNumber = currentNumber + 1;
        }
    }
    
    const sequentialNumber = String(nextNumber).padStart(5, '0');
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

        // Check if student with this LRN already exists
        let existingEnrollment = await Enrollment.findOne({
            'studentInfo.lrn': enrollmentData.studentInfo.lrn
        });

        let enrollmentID;
        
        if (existingEnrollment) {
            // Student already enrolled - reuse their existing ID (re-enrollment)
            enrollmentID = existingEnrollment.enrollmentID;
            enrollmentData.enrollmentID = enrollmentID;
            
            // Update their existing record
            enrollmentData.enrollmentDate = new Date();
            await Enrollment.updateOne(
                { enrollmentID: enrollmentID },
                enrollmentData
            );
            
            console.log(`✅ Re-enrollment updated: EnrollmentID=${enrollmentID}, LRN=${enrollmentData.studentInfo.lrn}`);
        } else {
            // New student - generate new sequential ID
            enrollmentID = await generateEnrollmentID(enrollmentData.studentInfo.gradeLevel);
            enrollmentData.enrollmentID = enrollmentID;
            enrollmentData.enrollmentDate = new Date();
            
            // Create new enrollment
            const enrollment = new Enrollment(enrollmentData);
            await enrollment.save();
            
            console.log(`✅ New enrollment created: EnrollmentID=${enrollmentID}, LRN=${enrollmentData.studentInfo.lrn}`);
        }
        
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
            
            // Ignore duplicate 'id' errors (legacy field, we use enrollmentID now)
            if (field === 'id') {
                // Ignore and retry without the id field
                try {
                    enrollmentData.id = null;
                    if (enrollmentData.enrollmentID && enrollmentData.isNewStudent === false) {
                        await Enrollment.updateOne(
                            { enrollmentID: enrollmentData.enrollmentID },
                            enrollmentData
                        );
                    } else {
                        const enrollment = new Enrollment(enrollmentData);
                        await enrollment.save();
                    }
                    return res.json({ 
                        success: true, 
                        message: 'Enrollment saved successfully',
                        enrollmentId: enrollmentData.enrollmentID
                    });
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                }
            }
            
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
        const result = await Enrollment.findByIdAndDelete(req.params.id);
        
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
        console.error('Error deleting enrollment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting enrollment: ' + error.message 
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
        
        // Check if email is in approved list (ONLY CHECK - don't block for existing accounts)
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
        
        // Email is in whitelist - let them proceed!
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
            password,
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
        
        const trimmedUsername = username.trim();
        
        // Find account (case-insensitive username)
        const account = await AdminAccount.findOne({ 
            username: { $regex: `^${trimmedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
            password: password
        });
        
        if (!account) {
            console.warn(`❌ Login failed for username: ${trimmedUsername}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
        
        console.log(`✅ Admin login successful: ${trimmedUsername}`);
        
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
    res.sendFile(path.join(__dirname, 'FRONT PAGE.html'));
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
