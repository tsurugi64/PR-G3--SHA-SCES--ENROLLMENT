# 📦 Extras Folder - Project Files Archive

This folder contains files that are not part of the online enrollment system deployment.

## 📁 Folder Structure

### **documentation/**
Contains all development and reference documentation files:
- Architecture notes
- Deployment guides  
- System reviews
- Testing guides
- And more...

**Why here?** These files were used during development but are not needed for the live system. Keep them backed up but remove from production.

### **unused-html/**
Contains HTML pages that are not part of the enrollment flow:
- Home.html - Landing page
- SHS Program.html - Program information
- verification.html - Unused verification page
- index.html - Empty file
- verify-code.html - Unused verification

**Why here?** These pages are not integrated into the current enrollment system. If you want to add them back as additional pages, you can restore them.

---

## 🚀 Deployment

**For online deployment:**
1. ✅ DO NOT include this `extras/` folder
2. ✅ Only upload the main project files (final.html, admin-*.html, server-mongodb.js, etc.)
3. ✅ Keep .env with your MONGODB_URI in .gitignore

**Folder structure for deployment:**
```
Project/
├── models/
├── node_modules/
├── admin-*.html
├── final.html
├── enrollment-records.html
├── style.css
├── sha_logo.png
├── server-mongodb.js
├── package.json
├── .env              (in .gitignore)
├── .env.example
└── .gitignore

❌ DO NOT UPLOAD: extras/
```

---

## 📋 What Each File Was Used For

### Documentation Files
- `ARCHITECTURE.md` - System architecture overview
- `AUDIT_SUMMARY.md` - Audit findings
- `COMPLETE_REFERENCE.md` - Complete system reference
- `DATABASE_SETUP.md` - Local database setup
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `FINAL_REPORT.md` - Final project report
- `QUICK_START.md` - Quick start guide
- `README.md` - Project readme
- `SYSTEM_REVIEW.md` - System review notes
- `TESTING_GUIDE.md` - Testing procedures
- `URL_REPLACEMENT_GUIDE.md` - URL migration guide
- `VERIFICATION_UPDATES.md` - Verification updates
- `ONLINE_SETUP.md` - Online setup guide

### Unused HTML Pages
- `Home.html` - Could be restored as landing page
- `SHS Program.html` - Program information (unused)
- `verification.html` - Never integrated
- `verify-code.html` - Never integrated
- `index.html` - Empty file

---

## 🔄 To Restore Files

If you want to restore any files from extras back to the main folder:

```powershell
# Restore a specific documentation file:
Copy-Item .\extras\documentation\README.md .\README.md

# Restore an HTML page:
Copy-Item .\extras\unused-html\Home.html .\Home.html
```

---

## ✅ Safe to Delete?

- ✅ **YES, delete documentation/** - If deploying to production
- ⚠️ **MAYBE keep unused-html/** - If you plan to add extra pages later
- ✅ **YES, delete both** - If doing aggressive cleanup

---

*Archive created: March 3, 2026*
