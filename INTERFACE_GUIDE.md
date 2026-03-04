# SHA Enrollment System - Dual Interface Guide

## Overview
The system now features two separate user interfaces:
1. **TEACHER/ADMIN VIEW** - Enrollment dashboard with analytics
2. **STUDENT VIEW** - Simplified enrollment process

---

## TEACHER/ADMIN INTERFACE

### Access URL
```
http://localhost:3000/teacher
```

### Features
✅ **Admin Login Button** (Top Right)
- Redirects to admin-login.html for authentication
- Admin creation completely removed (must manually create accounts)
- No dummy test accounts

✅ **Collapsible Sidebar Navigation**
- Click arrow (→) to expand/collapse left sidebar
- Shows Sacred Heart Academy branding
- Links to Home and Admin sections

✅ **Enrollment Dashboard**
- **Total Enrollments**: Current count of all enrolled students
- **Today's Enrollments**: Count of enrollments completed today
- **Average GWA**: General Weighted Average of all students

✅ **Daily Enrollment Bar Chart**
- Visual representation of enrollments per day
- Hover over bars to see:
  - Specific date (e.g., "Feb 16, 2026")
  - Number of students enrolled that day (e.g., "28 students enrolled")
- Auto-updates every 30 seconds
- Sortable by date

### Left Navigation Menu
- 📊 Home (Dashboard)
- 🔒 Admin (Login/Management)

---

## STUDENT INTERFACE

### Access URL
```
http://localhost:3000/student
```

### Features
✅ **Minimalist Design**
- Background video with welcome message
- No navigation clutter
- Clean and simple user experience

✅ **Single Action Button**
- "Enroll Now" button only
- **NO** back button
- Directs to verification.html

### Student Enrollment Flow
1. **Student Home** (`/student`)
   - Shows: Video background + "Welcome Back, SHAns!" + "Enroll Now" button
   
2. **Verification** (`verification.html`)
   - Student enters verification code
   - Redirects to enrollment form

3. **Final Enrollment** (`final.html`)
   - Student fills out complete enrollment form
   - Submits data to database
   - Shows success message with confetti

4. **Return to Home** (Back to `/student`)
   - After successful enrollment, student returns to Student Home
   - No access to admin interface
   - Can only enroll again or close

---

## KEY DIFFERENCES

| Feature | Teacher | Student |
|---------|---------|---------|
| Sidebar | ✅ Yes (Collapsible) | ❌ No |
| Admin Login | ✅ Yes | ❌ No |
| Dashboard | ✅ Yes (Full Analytics) | ❌ No |
| Back Button | ❌ No | ❌ No |
| Enrollment Records Tab | ❌ Removed | ❌ N/A |
| Video Background | ❌ No | ✅ Yes |
| Chart Data | ✅ Daily trends | ❌ N/A |

---

## API ENDPOINTS

### Analytics
```
GET /api/analytics
```
Returns:
- `totalEnrollments`: Total count
- `todayEnrollments`: Today's count
- `averageGWA`: Average GWA
- `byStrand`: Count by strand (STEM, HUMSS, ABM, TVL)
- `byGender`: Count by gender
- `byGradeLevel`: Count by grade level

### Daily Chart Data
```
GET /api/analytics/daily
```
Returns array of:
```json
{
  "date": "2026-02-16",
  "count": 5,
  "displayDate": "Feb 16, 2026"
}
```

### Enrollment Management
```
POST /api/enroll
GET /api/enrollments
GET /api/enrollments/:id
PUT /api/enrollments/:id
DELETE /api/enrollments/:id
```

### Admin Management
```
POST /api/admin/create
POST /api/admin/login
```

---

## ADMIN ACCOUNT SETUP

### First-Time Setup
1. Go to Admin Login page: `/admin-login.html`
2. Click "Create Account" or "New Admin?"
3. Fill in username, password, email
4. System saves to `admin-accounts.json`
5. You can now log in with those credentials

### Important Notes
- No default admin account exists
- Each teacher/admin must create their own account
- Accounts are stored in `admin-accounts.json`
- Consider password security for production

---

## FILE LOCATIONS

| File | Purpose | Location |
|------|---------|----------|
| Teacher Home | Dashboard | `/Home.html` |
| Student Home | Entry point | `/Beta-test-final and home updated file/Home.html` |
| Verification | Code entry | `/Beta-test-final and home updated file/verification.html` |
| Enrollment Form | Main form | `/Beta-test-final and home updated file/final.html` |
| Admin Login | Auth page | `/admin-login.html` |
| Server | Backend | `/server.js` |
| Enrollments DB | Data store | `/enrollments.json` |
| Admin DB | Credentials | `/admin-accounts.json` |

---

## DATA FLOW

### Teacher Path
```
/teacher (Dashboard)
    ↓
Admin Login → Create Account → Manage Dashboard
    ↓
View Analytics & Charts
```

### Student Path
```
/student (Home)
    ↓
Enroll Now → Verification → Enrollment Form → Success
    ↓
Return to /student (Home)
```

---

## Starting the Server

```powershell
cd "c:\Users\redjh\Desktop\mish\beta test"
node server.js
```

Server runs on: `http://localhost:3000`

---

## Testing Checklist

- [x] Teacher route accessible at `/teacher`
- [x] Student route accessible at `/student`
- [x] Sidebar collapses/expands on teacher home
- [x] Admin login button functional
- [x] Daily enrollment chart renders data
- [x] API endpoints respond correctly
- [x] Student view has no back button
- [x] Student redirect flows work (verification → final → home)
- [x] No dummy admin accounts in system
- [x] Analytics update in real-time

---

## Next Steps

1. Test enrollment flow end-to-end
2. Verify chart displays correctly for date ranges
3. Test admin account creation
4. Monitor `/api/analytics` for accuracy
5. Consider adding:
   - Enrollment summary export for records
   - Advanced filtering by strand/grade
   - Real-time notifications

---

*Last Updated: March 4, 2026*
