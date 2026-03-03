const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Path to enrollment database file
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
        const db = readEnrollments();
        
        // Add timestamp and unique ID
        enrollmentData.id = Date.now();
        enrollmentData.enrollmentDate = new Date().toISOString();
        
        // Add to enrollments array
        db.enrollments.push(enrollmentData);
        
        // Write to file
        const success = writeEnrollments(db);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Enrollment saved successfully',
                enrollmentId: enrollmentData.id
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to save enrollment' 
            });
        }
    } catch (error) {
        console.error('Error processing enrollment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error processing enrollment: ' + error.message 
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

// Path to admin database file
const adminDbPath = path.join(__dirname, 'admin-accounts.json');

// Initialize admin database if it doesn't exist
if (!fs.existsSync(adminDbPath)) {
    const defaultAdmin = {
        accounts: [
            { id: 1, username: 'admin', password: 'admin123', email: 'admin@shacses.edu' }
        ]
    };
    fs.writeFileSync(adminDbPath, JSON.stringify(defaultAdmin, null, 2));
}

// Helper function to read admin data
function readAdminAccounts() {
    try {
        const data = fs.readFileSync(adminDbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading admin accounts:', error);
        return { accounts: [] };
    }
}

// Helper function to write admin data
function writeAdminAccounts(data) {
    try {
        fs.writeFileSync(adminDbPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing admin accounts:', error);
        return false;
    }
}

// Create admin account endpoint
app.post('/api/admin/create', (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        // Validate input
        if (!username || !password || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, password, and email are required' 
            });
        }
        
        const db = readAdminAccounts();
        
        // Check if username already exists
        if (db.accounts.some(acc => acc.username === username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username already exists' 
            });
        }
        
        // Create new account
        const newAccount = {
            id: Date.now(),
            username: username,
            password: password,
            email: email
        };
        
        db.accounts.push(newAccount);
        const success = writeAdminAccounts(db);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Admin account created successfully' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create account' 
            });
        }
    } catch (error) {
        console.error('Error creating admin account:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating account: ' + error.message 
        });
    }
});

// Login endpoint
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        const db = readAdminAccounts();
        const account = db.accounts.find(acc => acc.username === username && acc.password === password);
        
        if (account) {
            res.json({ 
                success: true, 
                message: 'Login successful',
                admin: { id: account.id, username: account.username, email: account.email }
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error during login: ' + error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Enrollment database server running at http://localhost:${PORT}`);
    console.log(`Enrollment data stored in: ${enrollmentDbPath}`);
    console.log(`Admin accounts stored in: ${adminDbPath}`);
});
