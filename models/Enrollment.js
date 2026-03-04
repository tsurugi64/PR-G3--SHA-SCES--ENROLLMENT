const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    id: {
        type: Number,
        sparse: true
    },
    enrollmentID: {
        type: String,
        unique: true,
        sparse: true
    },
    isNewStudent: {
        type: Boolean,
        default: true
    },
    enrollmentDate: {
        type: Date,
        default: Date.now
    },
    studentInfo: {
        firstName: {
            type: String,
            required: [true, 'First name is required']
        },
        middleName: String,
        lastName: {
            type: String,
            required: [true, 'Last name is required']
        },
        suffix: String,
        lrn: {
            type: String,
            required: [true, 'LRN is required'],
            unique: true,
            sparse: true
        },
        email: {
            type: String,
            required: [true, 'Email is required']
        },
        contactNumber: {
            type: String,
            required: [true, 'Contact number is required']
        },
        age: Number,
        sex: {
            type: String,
            required: [true, 'Gender is required']
        },
        dateOfBirth: String,
        schoolLastAttended: String,
        gwa: Number,
        gradeLevel: {
            type: String,
            required: [true, 'Grade level is required']
        },
        strand: {
            type: String,
            required: [true, 'Strand is required']
        },
        schoolYear: String,
        houseAddress: String,
        paymentCategory: String,
        alsPasser: String
    },
    parentsInfo: {
        fatherName: String,
        fatherContact: String,
        fatherAlumni: String,
        fatherGraduatedYear: String,
        motherName: String,
        motherContact: String,
        motherAlumni: String,
        motherGraduatedYear: String
    },
    addressInfo: {
        province: String,
        city: String,
        barangay: String
    },
    emergencyContact: {
        name: {
            type: String,
            required: [true, 'Emergency contact name is required']
        },
        relationship: {
            type: String,
            required: [true, 'Emergency contact relationship is required']
        },
        contactNumber: {
            type: String,
            required: [true, 'Emergency contact number is required']
        }
    }
}, { timestamps: true });

// Create index for LRN for faster queries
enrollmentSchema.index({ 'studentInfo.lrn': 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
