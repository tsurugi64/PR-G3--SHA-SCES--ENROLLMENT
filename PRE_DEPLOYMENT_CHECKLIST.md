# 🚀 Pre-Deployment Checklist - SHA Enrollment System

## ✅ COMPLETED ITEMS

- [x] Removed all hardcoded `http://localhost:3000` URLs
- [x] Converted all API calls to relative paths (`/api/*`)
- [x] Updated error messages (removed localhost references)
- [x] Created `.env` file for deployment
- [x] MongoDB model (`Enrollment.js`) configured
- [x] Server supports `process.env.MONGODB_URI`
- [x] CORS enabled for cross-origin requests

---

## 📋 YOUR DEPLOYMENT STEPS (6-8 minutes)

### Step 1: MongoDB Setup (5 mins)
```
1. Go to https://mongodb.com/cloud/atlas
2. Sign up (free account)
3. Create a "Free" M0 cluster
4. Click "Connect" → "Drivers" → Node.js
5. Copy connection string
6. Replace <username> and <password>
7. Paste into .env file as MONGODB_URI
```

### Step 2: Railway Setup (3 mins)
```
1. Go to https://railway.app
2. Sign up (GitHub login recommended)
3. Create new project → "Deploy from GitHub"
4. Select your repository (or upload this folder)
```

### Step 3: Add Environment Variables on Railway
```
In Railway Dashboard:
- Click "Variables"
- Add MONGODB_URI: [your MongoDB connection string]
- Add NODE_ENV: production
- Add PORT: 3000
```

### Step 4: Deploy
```
1. Set start command: node server-mongodb.js
2. Click "Deploy"
3. Wait for green checkmark (2-3 minutes)
4. Copy your Railway URL (https://your-app-name.railway.app)
```

### Step 5: Update Frontend URLs (Optional)
```
The frontend now uses relative paths (/api/*) which work automatically!
No manual URL updates needed in HTML files.
```

---

## 🧪 TEST BEFORE GOING LIVE

- [ ] Test enrollment form on live URL
- [ ] Submit test enrollment - check MongoDB
- [ ] Admin login works
- [ ] Admin dashboard loads enrollments
- [ ] Can edit/delete records
- [ ] Check browser console for errors

---

## 📁 FILES THAT ARE READY FOR DEPLOYMENT

```
✅ server-mongodb.js       - Production server
✅ models/Enrollment.js    - MongoDB schema
✅ package.json            - Dependencies configured
✅ .env                    - Environment variables
✅ All HTML files          - URLs converted to relative paths
✅ .gitignore              - Secrets protected
```

---

## ⚠️ IMPORTANT NOTES

1. **Never commit .env to GitHub** - It contains secrets. The `.gitignore` file protects it.
2. **Use MongoDB Atlas free tier** - Always free, no credit card required.
3. **Railway free tier** - $5 free credit monthly (enough for small projects).
4. **Railway auto-deploys** - Just push to GitHub and it redeploys automatically.

---

## 🔗 QUICK LINKS

- MongoDB Atlas: https://mongodb.com/cloud/atlas
- Railway: https://railway.app
- Node.js Guide: https://nodejs.org/docs/

---

## 📞 IF SOMETHING BREAKS

Check:
1. `.env` file has correct `MONGODB_URI`
2. MongoDB cluster is running
3. Railway logs show "listening on port 3000"
4. Browser console has no CORS errors
5. Try hard refresh (Ctrl+Shift+R)

---

**Status:** System is ready for deployment! 🎉
