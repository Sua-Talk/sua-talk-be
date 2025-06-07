# CapRover Simple Setup (Seperti ML Project)

## 🚀 Setup CI/CD dengan CapRover Webhook (Best Practice)

Ini adalah cara yang sama seperti project ML yang sudah ada di VPS Anda.

### 1. Buat App Baru di CapRover

1. **Login ke CapRover Dashboard**: `https://captain.domain-anda.com:3000`
2. **Buat App Baru**:
   - Go to "Apps" → "Create New App"
   - App Name: `sua-talk-backend` 
   - ✅ **CENTANG "Has Persistent Data"** jika perlu storage
   - Click "Create New App"

### 2. Enable App Token untuk Webhook

1. **Masuk ke App** yang baru dibuat (`sua-talk-backend`)
2. **Go to "Deployment" tab**
3. **Click "Enable App Token"**
4. **Copy token** yang muncul - simpan ini!

### 3. Setup Repository Information

Di tab **"Deployment"** yang sama:

```
Repository: github.com/username/sua-talk-be
Branch: main
Username: your-github-username  
Password: your-github-token-or-password
```

**ATAU gunakan SSH Key** (lebih aman):
```bash
ssh-keygen -m PEM -t ed25519 -C "deploy@suatalk.site" -f ./deploykey -q -N ""
```

### 4. Setup Webhook di GitHub

1. **Go to GitHub Repository**: `sua-talk-be`
2. **Settings** → **Webhooks** → **Add webhook**
3. **Payload URL**: Copy dari CapRover webhook field
4. **Content type**: `application/json`
5. **Which events**: Just the `push` event
6. **Active**: ✅ checked

### 5. Environment Variables

Di CapRover app, **"App Configs"** tab, set environment variables:

```env
NODE_ENV=production
MONGODB_URI=mongodb://srv-captain--mongodb:27017/suatalk_production
JWT_SECRET=your-jwt-secret
RESEND_API_KEY=your-resend-key
EMAIL_FROM=noreply@suatalk.site
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://api.suatalk.site/auth/google/callback
```

### 6. Test Deployment

1. **Push ke branch `main`**
2. **Check di CapRover** → App → "App Logs" untuk melihat build progress
3. **Success!** App akan otomatis deploy

## 🔧 Setup Database & Storage

### MongoDB (One-Click Install)

1. **CapRover Dashboard** → **"One-Click Apps"**
2. **Search "MongoDB"** → Install
3. **App Name**: `mongodb`
4. **Set Root Password**: simpan password ini!
5. **Install** → tunggu sampai selesai

### File Storage dengan Minio (Optional but Recommended)

1. **CapRover Dashboard** → **"One-Click Apps"**
2. **Search "Minio"** → Install  
3. **App Name**: `minio`
4. **Set Access Key & Secret Key**
5. **Install**

### Database Connection String

Dari app backend, koneksi ke MongoDB menggunakan:
```
mongodb://srv-captain--mongodb:27017/suatalk_production
```

Format: `mongodb://srv-captain--[APP_NAME]:[PORT]/[DATABASE_NAME]`

## ✅ Best Practices

### Database Best Practices
- ✅ **Install MongoDB di CapRover** using One-Click Apps
- ✅ **Use persistent volumes** (auto-configured)  
- ✅ **Setup automated backups** dengan `tiredofit/docker-db-backup`
- ✅ **Internal networking** via `srv-captain--mongodb`

### Storage Best Practices  
- ✅ **Use Minio S3-compatible storage** di CapRover
- ✅ **Persistent volumes** untuk file storage
- ✅ **Internal access** via `srv-captain--minio:9000`
- ❌ **Avoid external cloud storage** untuk cost efficiency

### Security Best Practices
- ✅ **Use environment variables** untuk credentials
- ✅ **SSL/TLS auto-enabled** oleh CapRover
- ✅ **Internal networking** untuk service communication
- ✅ **Regular backups** setup

## 🎯 Perbandingan dengan ML Project

| Aspect | ML Project | Backend Project |
|--------|------------|-----------------|
| **Deployment** | ✅ Webhook | ✅ Webhook (sama!) |
| **Database** | ❓ External? | ✅ MongoDB di CapRover |
| **Storage** | ❓ External? | ✅ Minio di CapRover |
| **SSL** | ✅ Auto | ✅ Auto |
| **Domain** | ✅ Subdomain | ✅ api.suatalk.site |

## 📋 Checklist Setup

- [ ] App baru dibuat di CapRover
- [ ] App token enabled
- [ ] Repository info configured
- [ ] Webhook setup di GitHub
- [ ] Environment variables set
- [ ] MongoDB installed & configured
- [ ] Minio installed (optional)
- [ ] Test deployment successful
- [ ] Domain pointing to app

---

**✨ Setelah setup ini, workflow Anda akan sama seperti ML:**
1. **Code** → **Push to main** → **Auto deploy!** 🚀 