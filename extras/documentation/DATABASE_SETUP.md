# SHACSES Enrollment Database Setup Guide

## What's Been Created

I've set up a **local database system** for your enrollment form that saves all student enrollment data to a file called `enrollments.json`.

### Files Created:
1. **server.js** - Node.js backend server that handles data storage
2. **package.json** - Dependencies configuration
3. **enrollments.json** - Database file that stores all enrollment data
4. **enrollment-records.html** - Admin dashboard to view/manage all enrollments
5. **final.html** - Updated with enrollment submission functionality

---

## Installation & Setup

### Step 1: Install Node.js
If you don't have Node.js installed:
- Download from: https://nodejs.org/
- Install the LTS (Long Term Support) version

### Step 2: Install Dependencies
1. Open PowerShell/Command Prompt
2. Navigate to your project folder:
   ```
   cd "C:\Users\redjh\Desktop\SHACSES LATEST"
   ```
3. Install dependencies:
   ```
   npm install
   ```

### Step 3: Start the Server
In the same terminal, run:
```
npm start
```

You should see:
```
Enrollment database server running at http://localhost:3000
Enrollment data stored in: C:\Users\redjh\Desktop\SHACSES LATEST\enrollments.json
```

**Keep this terminal running** while using the enrollment system.

---

## How to Use

### Enrolling Students
1. Open **final.html** in your browser
2. Fill in the enrollment form
3. Click **"Enroll Now"** button
4. The data is automatically saved to `enrollments.json`

### Viewing Enrollments
1. Open **enrollment-records.html** in your browser
2. See all enrolled students in a table
3. Click **"View"** to see full details
4. Click **"Delete"** to remove a record
5. Click **"Export to CSV"** to download all enrollments as spreadsheet

---

## Database File Structure

The `enrollments.json` file stores data like this:

```json
{
  "enrollments": [
    {
      "id": 1704067200000,
      "enrollmentDate": "2024-01-01T10:00:00.000Z",
      "studentInfo": {
        "lrn": "123456789012",
        "firstName": "John",
        "middleName": "Paul",
        "lastName": "Smith",
        "suffix": "",
        "sex": "male",
        "dateOfBirth": "2006-05-15",
        "contactNumber": "09123456789",
        "email": "john@example.com",
        "schoolLastAttended": "Example High School",
        "gwa": "88.50"
      },
      "parentsInfo": {...},
      "addressInfo": {...},
      "emergencyContact": {...}
    }
  ]
}
```

---

## API Endpoints

If you want to integrate with other systems:

### Save Enrollment
```
POST http://localhost:3000/api/enroll
```

### Get All Enrollments
```
GET http://localhost:3000/api/enrollments
```

### Get Single Enrollment
```
GET http://localhost:3000/api/enrollments/:id
```

### Delete Enrollment
```
DELETE http://localhost:3000/api/enrollments/:id
```

---

## Troubleshooting

**"Cannot find module 'express'"**
- Make sure you ran `npm install`

**"Cannot POST /api/enroll"**
- Check that the server is running (step 3 above)
- Verify server is on http://localhost:3000

**Port 3000 already in use**
- Edit server.js line 5: change `3000` to another port (e.g., `3001`)

**Data not saving**
- Check file permissions on the folder
- Make sure `enrollments.json` has read/write access

---

## Features

✅ Save student enrollment data locally
✅ View all enrollments in admin dashboard
✅ Search and filter enrollments
✅ Export to CSV for Excel/spreadsheet
✅ Print individual enrollment records
✅ Delete records if needed
✅ Automatic timestamps for each enrollment
✅ Dark mode support on enrollment form

---

## Next Steps

You can expand this system by:
- Adding authentication (admin login)
- Sending confirmation emails
- Generating PDF reports
- Creating enrollment statistics/analytics
- Adding photo upload functionality
- Implementing backup/restore features

Questions? Check the browser console (F12) for error messages.
