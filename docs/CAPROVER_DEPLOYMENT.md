# CapRover Deployment Guide

## 🚀 SuaTalk Backend - CapRover Deployment

Panduan lengkap untuk deploy SuaTalk Backend API ke VPS menggunakan CapRover.

## 📋 Prerequisites

- VPS dengan minimal **2GB RAM** dan **1vCPU**
- CapRover sudah terinstall di VPS
- Domain/subdomain untuk API (contoh: `api.suatalk.site`)

## 🔧 Audio Metadata Service - VPS Ready!

### ✅ Optimasi untuk CapRover

SuaTalk menggunakan **hybrid audio metadata extraction**:

1. **Primary**: `music-metadata` (Pure Node.js, tidak butuh binary)
2. **Secondary**: `ffprobe` (Optional, untuk metadata lebih detail)
3. **Fallback**: Graceful degradation dengan informasi dasar

### 🎯 Keuntungan Approach Ini:

- **✅ Memory Efficient**: Tidak crash saat build (seperti opencv4nodejs)
- **✅ Fast Deployment**: Build time cepat tanpa compile binary
- **✅ Reliable**: Tetap berjalan meski FFmpeg tidak ada
- **✅ Production Ready**: Auto-fallback jika ada error

## 📦 Deployment Steps

### 1. Prepare Repository

```bash
# Pastikan semua file siap
git add .
git commit -m "feat: optimize for CapRover deployment"
git push origin main
```

### 2. Create App di CapRover

1. Login ke CapRover dashboard
2. **Apps** → **One-Click Apps/Repositories** → **Create New App**
3. App Name: `suatalk-api`
4. **Deploy via CLI** (recommended) atau **Deploy from repository**

### 3. Configure Environment Variables

Set environment variables berikut di CapRover:

```bash
# Database
MONGODB_URI=mongodb://your-mongodb-uri
REDIS_URL=redis://your-redis-url

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_EXPIRY=7d
JWT_REFRESH_EXPIRY=30d

# Email Service
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@suatalk.site

# API Keys (Optional - for metadata extraction)
GOOGLE_API_KEY=your-google-api-key
OPENAI_API_KEY=your-openai-api-key

# Storage (if using cloud storage)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=suatalk-uploads

# App Configuration
NODE_ENV=production
PORT=80
API_URL=https://api.suatalk.site
```

### 4. Deploy via CLI (Recommended)

```bash
# Install CapRover CLI
npm install -g caprover

# Deploy
caprover deploy

# Follow prompts:
# - CapRover URL: https://captain.your-server.com
# - Password: your-caprover-password
# - App Name: suatalk-api
```

### 5. Configure Domain & SSL

1. **Apps** → **suatalk-api** → **HTTP Settings**
2. **Enable HTTPS**: Yes
3. **Force HTTPS**: Yes
4. **Custom Domain**: `api.suatalk.site`
5. **Enable SSL**: Yes (Let's Encrypt)

### 6. Persistent Directories

Set persistent directories untuk uploads:

1. **Apps** → **suatalk-api** → **App Configs**
2. **Persistent Directories**:
   ```
   Path in App: /usr/src/app/uploads
   Path on Host: /captain/data/suatalk-uploads
   ```

## 🔍 Audio Metadata Behavior di CapRover

### Normal Operation Log:
```
🔍 Starting metadata extraction for: audio.wav
🎵 Trying music-metadata as primary method...
✅ Successfully extracted metadata using music-metadata (primary)
Duration: 45.2s, Sample Rate: 44100Hz, Channels: 2
```

### Fallback Operation Log:
```
🔍 Starting metadata extraction for: audio.wav
🎵 Trying music-metadata as primary method...
⚠️ Music-metadata failed, trying FFprobe as fallback
🔧 Trying FFprobe as fallback...
✅ Successfully extracted metadata using FFprobe (fallback)
```

### Graceful Degradation Log:
```
🔍 Starting metadata extraction for: audio.wav
🎵 Trying music-metadata as primary method...
⚠️ Music-metadata failed, trying FFprobe as fallback
❌ FFProbe execution also failed: spawn ffprobe ENOENT
ℹ️ Both metadata extraction methods failed - this is normal in environments without FFmpeg
💡 Using graceful degradation with basic file information
📤 Continuing upload without metadata extraction - this is normal if FFmpeg is not installed
```

## ⚡ Performance Tips

### 1. Resource Limits
Set di CapRover App Configs:
- **Memory**: 1GB (cukup untuk most cases)
- **CPU**: 0.5 cores

### 2. Health Check
Health check sudah dikonfigurasi di Dockerfile:
```
Endpoint: /health
Interval: 30s
Timeout: 3s
```

### 3. Scaling
Untuk high traffic, enable horizontal scaling:
1. **Apps** → **suatalk-api** → **Deployment**
2. **Instance Count**: 2-3 instances

## 🐛 Troubleshooting

### 1. Build Fails - Out of Memory
```bash
# Increase swap di VPS
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 2. Audio Upload Fails
Check logs untuk memastikan fallback bekerja:
```bash
# Check CapRover logs
caprover logs --app suatalk-api
```

### 3. FFmpeg Not Found (Normal)
Ini normal dan tidak akan crash aplikasi:
```
❌ FFprobe not found - continuing with music-metadata
✅ Upload successful with basic metadata
```

## 📊 Monitoring

### Health Check
```bash
curl https://api.suatalk.site/health
```

### API Documentation
```bash
https://api.suatalk.site/api-docs
```

## 🔄 Auto-Deploy from GitHub

1. **Apps** → **suatalk-api** → **Deployment**
2. **Repository**: `https://github.com/yourusername/sua-talk-be`
3. **Branch**: `main`
4. **Webhook**: Copy webhook URL
5. Add webhook ke GitHub repository settings

## 🎉 Success!

Setelah deployment berhasil:

- ✅ API berjalan di `https://api.suatalk.site`
- ✅ Audio upload bekerja dengan metadata extraction
- ✅ Fallback graceful jika FFmpeg tidak tersedia
- ✅ Auto-SSL dari Let's Encrypt
- ✅ Monitoring dan health checks aktif

---

**Catatan**: Approach ini sangat optimal untuk CapRover karena menghindari masalah memory dan build complexity yang sering terjadi dengan FFmpeg/OpenCV compilation. 