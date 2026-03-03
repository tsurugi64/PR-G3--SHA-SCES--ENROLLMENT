# 🚀 SHA Enrollment System - Deployment Guide

## Going Online with Railway + MongoDB Atlas

This guide will help you deploy your Sacred Heart Academy Enrollment System online.

---

## Step 1: Set Up Free MongoDB Database

### 1.1 Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free" or "Create Account"
3. Sign up with email/password or Google

### 1.2 Create a Free Cluster
1. After login, click "Create a Deployment"
2. Select **M0 Free** tier (always free)
3. Choose your region closest to your location
4. Click "Create Deployment"
5. Wait for cluster creation (~5-10 minutes)

### 1.3 Get Connection String
1. Click "Connect" button
2. Select "Drivers" tab
3. Choose **Node.js** as driver
4. Copy the connection string (looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`)
5. Replace `<username>` and `<password>` with your credentials
6. Replace `<database>` with `sha-enrollment`
7. **Final URL format:** `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sha-enrollment?retryWrites=true&w=majority`

---

## Step 2: Update package.json

Your package.json has been updated with MongoDB support. The new dependencies are:
- `mongoose` - MongoDB driver for Node.js
- `dotenv` - Environment variable management

Run this locally first to test:
```bash
npm install
```

---

## Step 3: Deploy to Railway.app (FREE)

### 3.1 Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (easiest), Google, or email
3. Click "Create New Project"

### 3.2 Connect to Railway
1. Click "Deploy from GitHub" (if using GitHub)
   - OR click "Deploy from CLI" for local deployment
2. Select your repository (or authorize GitHub)
3. Select the branch (usually `main` or `master`)

### 3.3 Configure Environment Variables
1. Go to your project on Railway
2. Click "Variables" tab
3. Add these variables:
   ```
   MONGODB_URI = mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sha-enrollment?retryWrites=true&w=majority
   NODE_ENV = production
   PORT = 3000
   ```

### 3.4 Update Start Command
1. Go to "Settings" tab
2. Find "Start Command" and set it to:
   ```
   node server-mongodb.js
   ```

### 3.5 Deploy
1. Click "Deploy" or the deployment will auto-trigger on push
2. Wait for deployment to complete (2-5 minutes)
3. Get your public URL from Railway (something like: `https://your-project-xxxxx.railway.app`)

---

## Step 4: Update Frontend URLs

Once deployed, update your JavaScript files to use the new URL:

### Files to update:
- `admin-dashboard.html`
- `enrollment-records.html`
- `final.html`
- `verify-code.html`

### Replace all instances of:
```javascript
http://localhost:3000
```

With:
```javascript
https://your-project-xxxxx.railway.app
```

**Example change in JavaScript:**
```javascript
// Before
const response = await fetch('http://localhost:3000/api/enrollments');

// After
const response = await fetch('https://your-project-xxxxx.railway.app/api/enrollments');
```

---

## Step 5: Deploy Frontend

### Option A: Deploy on Railway (Recommended)
1. Go to Railway.app dashboard
2. Create a NEW project
3. Add a Static Build service
4. Connect your GitHub repo
5. Set Build Command: (leave empty)
6. Set Start Command: (leave empty)
7. Railway will automatically serve your HTML files

### Option B: Use Free Static Hosting
- **Netlify** (https://netlify.com) - Drag & drop your files
- **Vercel** (https://vercel.com) - Connect GitHub repo
- **GitHub Pages** - Host for free from GitHub

---

## Testing Your Deployment

### Test Backend
1. Visit: `https://your-project-xxxxx.railway.app/api/health`
   - Should see: `{"status":"ok","mongoStatus":"connected"}`

### Test Frontend
1. Visit: `https://your-project-xxxxx.railway.app`
   - Should load your enrollment form

### Test Enrollment
1. Fill out the enrollment form
2. Submit it
3. Check admin dashboard - should see the new entry

---

## Troubleshooting

### MongoDB Connection Error
- Verify connection string is correct (no typos)
- Check username/password are correct
- Ensure IP whitelist includes `0.0.0.0/0` (allow all IPs)
- In MongoDB Atlas: Network Access → IP Whitelist → Add Entry: `0.0.0.0/0`

### Site Returns Blank Page
- Check browser console (F12 → Console tab) for errors
- Verify all API URLs are updated to production URL
- Check Railway logs for backend errors

### Can't Submit Enrollment
- Open browser DevTools (F12)
- Go to Network tab
- Try submitting form
- Check if POST request to `/api/enroll` returns 200 or error
- Check Railway logs for detailed error message

---

## Important Security Notes

⚠️ **BEFORE going live:**
1. Change admin password from `admin123` to something strong
2. Consider using bcrypt for password hashing
3. Add rate limiting to prevent abuse
4. Consider adding user authentication/JWT tokens
5. Enable HTTPS (Railway provides this automatically)

---

## Quick Command Reference

```bash
# Install dependencies locally
npm install

# Run locally with MongoDB
node server-mongodb.js

# Run with old file-based system (if needed)
node server.js

# Test API connection
curl https://your-project-xxxxx.railway.app/api/health
```

---

## Need Help?

- **Whiteboard:** https://www.mongodb.com/support
- **Railway Docs:** https://docs.railway.app
- **Express.js:** https://expressjs.com
- **Mongoose Guide:** https://mongoosejs.com

---

## Summary

1. ✅ Create MongoDB Atlas account → Get connection string
2. ✅ Create Railway account → Deploy backend
3. ✅ Add MONGODB_URI to Railway variables
4. ✅ Update frontend URLs to production URL
5. ✅ Test everything works
6. ✅ Share your production URL with users

**Your site will now be live at:** `https://your-project-xxxxx.railway.app`

Good luck! 🎉
