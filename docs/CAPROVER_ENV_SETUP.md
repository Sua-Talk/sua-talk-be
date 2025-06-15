# Environment Variables untuk CapRover

Berikut adalah environment variables yang perlu di-set di CapRover untuk backend SuaTalk:

## 📋 **Environment Variables List**

Copy-paste ke CapRover **App Configs** → **Environment Variables** (Bulk Edit):

```env
# Node.js Configuration
NODE_ENV=production
PORT=80

# Database Configuration (MongoDB di CapRover)
MONGODB_URI=mongodb://srv-captain--mongodb:27017/suatalk_production

# MongoDB Authentication (jika diperlukan)
# MONGODB_USER=root
# MONGODB_PASS=your-mongodb-password

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-minimum-32-characters-long
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Application URLs
APP_URL=https://api.suatalk.site
FRONTEND_URL=https://suatalk.site

# Email Configuration (Resend/SMTP)
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM=noreply@suatalk.site
SMTP_FROM_NAME=SuaTalk Team

# File Storage (Minio S3 di CapRover) - WAJIB UNTUK PRODUCTION
MINIO_ENDPOINT=http://srv-captain--minio:9000
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key
MINIO_BUCKET_NAME=suatalk-files
MINIO_REGION=us-east-1

# ML Service Configuration
ML_SERVICE_URL=http://srv-captain--ml

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://api.suatalk.site/auth/google/callback

# Security & Rate Limiting
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Session Configuration
SESSION_SECRET=your-session-secret-key-here

# OTP Configuration
OTP_EXPIRES_IN=300000
OTP_LENGTH=6
```

## 🔑 **Cara Generate Secret Keys:**

Gunakan command berikut untuk generate secure secrets:

```bash
# Generate JWT Secret (32+ characters)
openssl rand -base64 32

# Generate Session Secret
openssl rand -base64 24

# Generate Refresh Secret
openssl rand -base64 32
```

Atau gunakan online generator: https://generate-secret.vercel.app/32

## 📊 **Monitoring Environment Variables:**

Di CapRover, Anda dapat melihat environment variables yang sudah di-set di:
- **Apps** → **sua-talk-backend** → **App Configs** → **Environment Variables**

## 🔗 **Services Connection Summary:**

| Service | Internal URL | Purpose |
|---------|-------------|---------|
| **MongoDB** | `mongodb://srv-captain--mongodb:27017` | Database |
| **Minio** | `http://srv-captain--minio:9000` | File Storage |
| **ML Service** | `http://srv-captain--ml` | AI Processing |

## ⚙️ **Minio Configuration:**

Untuk mendapatkan **MINIO_ACCESS_KEY** dan **MINIO_SECRET_KEY**:

1. **Go to CapRover** → **Apps** → **minio**
2. **Check "Environment Variables"** atau **App Configs**
3. **Copy** nilai `MINIO_ROOT_USER` → set as `MINIO_ACCESS_KEY`
4. **Copy** nilai `MINIO_ROOT_PASSWORD` → set as `MINIO_SECRET_KEY`

## 🚨 **Troubleshooting Storage Errors:**

### Error: `TypeError: this.client.send is not a function`

**Penyebab:**
- Missing environment variables `MINIO_ACCESS_KEY` atau `MINIO_SECRET_KEY`
- Minio service tidak running atau tidak accessible
- Network connectivity issue between backend dan Minio

**Solusi:**
1. **Cek Environment Variables** di CapRover:
   ```bash
   # Pastikan variables ini ada dan tidak kosong
   MINIO_ACCESS_KEY=xxxxx
   MINIO_SECRET_KEY=xxxxx
   MINIO_ENDPOINT=http://srv-captain--minio:9000
   ```

2. **Restart Backend App** setelah update environment variables

3. **Cek Minio Service Status:**
   - Go to CapRover → Apps → **minio**
   - Pastikan status **Running** (green)
   - Check logs untuk error

4. **Test Manual Connection** via CapRover shell:
   ```bash
   curl http://srv-captain--minio:9000/minio/health/live
   ```

### Fallback ke Local Storage

Jika Minio tetap error, backend akan otomatis fallback ke local storage dengan log:
```
⚠️ Minio storage initialization failed
📁 Application will continue with local storage fallback
```

**Note:** Local storage tidak persistent di CapRover containers.

## 🛡️ **Security Notes:**

- ✅ **Jangan hardcode** secrets di kode
- ✅ **Use environment variables** untuk semua credentials
- ✅ **Generate unique secrets** untuk setiap environment
- ✅ **Keep secrets secure** dan jangan share di public

## 📝 **Deployment Checklist:**

- [ ] MongoDB service running di CapRover
- [ ] Minio service running di CapRover  
- [ ] ML service running di CapRover
- [ ] Environment variables properly set
- [ ] Backend app deployed dan running
- [ ] Test file upload functionality
- [ ] Check logs for any errors

---

**Setelah setup environment variables, restart backend app untuk apply changes.** 