require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sha-enrollment';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Import Models
const Enrollment = require('./models/Enrollment');

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
        const existingEnrollment = await Enrollment.findOne({
            'studentInfo.lrn': enrollmentData.studentInfo.lrn
        });

        if (existingEnrollment) {
            return res.status(400).json({
                success: false,
                message: `Student with LRN ${enrollmentData.studentInfo.lrn} is already enrolled`
            });
        }
        
        // Generate unique ID using timestamp
        const enrollmentId = Date.now();
        enrollmentData.id = enrollmentId;
        enrollmentData.enrollmentDate = new Date();
        
        const enrollment = new Enrollment(enrollmentData);
        await enrollment.save();
        
        console.log(`✅ New enrollment saved: ID=${enrollmentId}, LRN=${enrollmentData.studentInfo.lrn}`);
        
        res.json({ 
            success: true, 
            message: 'Enrollment saved successfully',
            enrollmentId: enrollmentId
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

// Admin Login (simple - in production, use JWT/bcrypt)
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        // Default admin credentials (CHANGE THESE IN PRODUCTION!)
        const defaultAdmin = { username: 'admin', password: 'admin123' };
        
        if (username === defaultAdmin.username && password === defaultAdmin.password) {
            res.json({ 
                success: true, 
                message: 'Login successful',
                admin: { username: username, email: 'admin@shacses.edu' }
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
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
    res.sendFile(path.join(__dirname, 'index.html'));
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
