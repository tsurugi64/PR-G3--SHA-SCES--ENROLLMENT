# 🎯 SHA Enrollment System - Online Deployment Checklist

## ✅ What's Been Done For You

- ✅ MongoDB integration added (Mongoose models)
- ✅ Backend updated to use MongoDB (new file: `server-mongodb.js`)
- ✅ Environment configuration template (`.env.example`)
- ✅ Detailed deployment guide created (`DEPLOYMENT_GUIDE.md`)
- ✅ Git configuration ready (`.gitignore`)

---

## 🚀 Your Next Steps (Follow In Order)

### STEP 1: Get MongoDB URL (10 minutes)
- [ ] Go to https://www.mongodb.com/cloud/atlas
- [ ] Create free account
- [ ] Create free M0 cluster
- [ ] Get connection string (format: `mongodb+srv://...`)
- [ ] Save it - you'll need it in Step 2

**Connection string should look like:**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sha-enrollment?retryWrites=true&w=majority
```

---

### STEP 2: Set Up Railway Account (5 minutes)
- [ ] Go to https://railway.app
- [ ] Sign up (easiest with GitHub)
- [ ] Create new project
- [ ] Connect your GitHub or upload code

---

### STEP 3: Configure Environment Variables on Railway (5 minutes)
On your Railway project dashboard:
- [ ] Go to "Variables" tab
- [ ] Add:
  - `MONGODB_URI` = (paste your string from Step 1)
  - `NODE_ENV` = `production`
  - `PORT` = `3000`

---

### STEP 4: Deploy Backend (5 minutes)
- [ ] In Railway settings, set start command to: `node server-mongodb.js`
- [ ] Click Deploy
- [ ] Wait for green checkmark
- [ ] Copy your Railway URL (looks like: `https://your-project-xxxxx.railway.app`)

---

### STEP 5: Update Frontend URLs (10 minutes)
Update these files - replace `http://localhost:3000` with your Railway URL:

**In the browser console (F12), search & replace in each file:**

1. **admin-dashboard.html**
   - Find: `localhost:3000`
   - Replace with: your Railway URL

2. **enrollment-records.html**
   - Find: `localhost:3000`
   - Replace with: your Railway URL

3. **final.html**
   - Find: `localhost:3000`
   - Replace with: your Railway URL

4. **verify-code.html** (if it exists)
   - Find: `localhost:3000`
   - Replace with: your Railway URL

---

### STEP 6: Test It Works (10 minutes)
- [ ] Visit: `https://your-project-xxxxx.railway.app/api/health`
  - Should see: `{"status":"ok","mongoStatus":"connected"}`
- [ ] Visit your enrollment form at: `https://your-project-xxxxx.railway.app`
- [ ] Try submitting a test enrollment
- [ ] Check admin dashboard - new enrollment should appear

---

## 📝 Important Before Going Live

⚠️ **Security Checklist:**
- [ ] Change admin password from `admin123` to something strong
- [ ] Verify MongoDB IP whitelist is set to `0.0.0.0/0`
- [ ] Test login works on production
- [ ] Test enrollment submission works
- [ ] Test admin dashboard loads data

---

## 🆘 Quick Troubleshooting

**If something isn't working:**

1. **Can't see data in dashboard?**
   - Check browser DevTools Console (F12)
   - Look for red error messages
   - Verify URLs are updated

2. **MongoDB connection fails?**
   - Check connection string in Railway variables
   - Verify IP whitelist in MongoDB Atlas
   - Check username/password are correct

3. **Form won't submit?**
   - Open DevTools (F12) → Network tab
   - Try submitting
   - Check if POST request succeeds
   - Reset page if needed

---

## 📞 Support Resources

- MongoDB Help: https://docs.mongodb.com/manual/
- Railway Docs: https://docs.railway.app
- Express.js: https://expressjs.com
- Mongoose: https://mongoosejs.com

---

## 🎉 When Done

Your enrollment system will be live and accessible from anywhere in the world at:

`https://your-railway-url.railway.app`

Share this URL with students and staff to start enrolling online!

---

**Need help?** Check `DEPLOYMENT_GUIDE.md` for detailed steps.
