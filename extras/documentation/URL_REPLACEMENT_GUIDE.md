# 🔗 Frontend URL Replacement Guide

## Files to Update

When you deploy to Railway, you'll get a URL like:
```
https://your-project-xxxxx.railway.app
```

Replace ALL instances of:
```
http://localhost:3000
```

With your Railway URL above.

---

## Files That Need Updates

### 1️⃣ admin-dashboard.html
**Search for these lines and update them:**

```javascript
// Line ~1106 - loadData function
const response = await fetch('http://localhost:3000/api/enrollments');

// Line ~1621 - deleteStudent function  
const response = await fetch(`http://localhost:3000/api/enrollments/${studentId}`, {

// Line ~1584 - saveStudent function
fetch(`http://localhost:3000/api/enrollments/${currentEditingStudentId}`, {
```

**Change to:**
```javascript
const response = await fetch('https://YOUR-URL/api/enrollments');
const response = await fetch(`https://YOUR-URL/api/enrollments/${studentId}`, {
fetch(`https://YOUR-URL/api/enrollments/${currentEditingStudentId}`, {
```

---

### 2️⃣ enrollment-records.html
**Search for these lines and update them:**

```javascript
// Line ~455 - loadEnrollments function
const response = await fetch('http://localhost:3000/api/enrollments');

// Line ~798 - deleteEnrollment function
const response = await fetch(`http://localhost:3000/api/enrollments/${id}`, {

// Line ~1001 - saveEnrollment function
const response = await fetch(`http://localhost:3000/api/enrollments/${currentEditingEnrollmentId}`, {
```

**Change to:**
```javascript
const response = await fetch('https://YOUR-URL/api/enrollments');
const response = await fetch(`https://YOUR-URL/api/enrollments/${id}`, {
const response = await fetch(`https://YOUR-URL/api/enrollments/${currentEditingEnrollmentId}`, {
```

---

### 3️⃣ final.html (Enrollment Form)
**Search for these lines and update them:**

```javascript
// In submitEnrollment() function
fetch('http://localhost:3000/api/enroll', {
```

**Change to:**
```javascript
fetch('https://YOUR-URL/api/enroll', {
```

---

### 4️⃣ verify-code.html (if you have one)
**Search for any localhost references and update them:**

```javascript
fetch('http://localhost:3000/...', {
```

**Change to:**
```javascript
fetch('https://YOUR-URL/...', {
```

---

## 🔍 How to Find & Replace

### Using VS Code (Recommended)
1. Press `Ctrl+H` (or `Cmd+H` on Mac)
2. In "Find" field: `http://localhost:3000`
3. In "Replace" field: `https://your-project-xxxxx.railway.app`
4. Click "Replace All"

### Using Browser DevTools
1. Open each HTML file in browser
2. Press `F12` to open DevTools
3. Use Ctrl+F to find `localhost:3000`
4. Manually edit the JavaScript in each `<script>` tag

---

## ✅ Verification Checklist

After replacing URLs:

- [ ] All instances of `localhost:3000` are replaced
- [ ] No broken URLs remain
- [ ] File saves are done
- [ ] You can see the new URL in the code

---

## Example Complete URL

If your Railway URL is: `https://sha-enrollment-app-prod-abcd1234.railway.app`

Then search:
```
http://localhost:3000
```

Replace with:
```
https://sha-enrollment-app-prod-abcd1234.railway.app
```

---

## 💡 Pro Tip

Use this command in your terminal to find all instances:

```bash
grep -r "localhost:3000" *.html
```

This shows you every file and line that needs updating.

---

## When Done

✅ All files updated → ✅ Push to GitHub → ✅ Railway auto-deploys → ✅ Your site goes live!
