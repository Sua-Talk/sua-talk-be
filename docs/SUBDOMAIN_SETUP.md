# SuaTalk API Subdomain Setup

## Overview

SuaTalk API telah diubah dari menggunakan path `/api` menjadi menggunakan subdomain `api.suatalk.site`. Perubahan ini memberikan separasi yang lebih jelas antara frontend dan backend API.

## URL Structure

- **Production Frontend**: https://suatalk.site
- **Production API**: https://api.suatalk.site
- **Development Frontend**: http://localhost:3000
- **Development API**: http://localhost:3000

## Nginx Configuration

### API Subdomain (api.suatalk.site)

Buat file konfigurasi nginx untuk subdomain API:

```nginx
# /etc/nginx/sites-available/api.suatalk.site
server {
    listen 80;
    server_name api.suatalk.site;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.suatalk.site;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.suatalk.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.suatalk.site/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Proxy to Node.js backend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # File upload size
        client_max_body_size 50M;
    }
    
    # Specific handling for health check
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check caching
        proxy_cache_valid 200 1m;
    }
    
    # Handle file uploads
    location /uploads {
        proxy_pass http://localhost:3000/uploads;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # File serving optimization
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Main Website (suatalk.site)

Konfigurasi untuk frontend website:

```nginx
# /etc/nginx/sites-available/suatalk.site
server {
    listen 80;
    server_name suatalk.site www.suatalk.site;
    
    # Redirect HTTP to HTTPS
    return 301 https://suatalk.site$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.suatalk.site;
    
    # Redirect www to non-www
    return 301 https://suatalk.site$request_uri;
}

server {
    listen 443 ssl http2;
    server_name suatalk.site;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/suatalk.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/suatalk.site/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Root directory untuk frontend
    root /var/www/suatalk-frontend;
    index index.html;
    
    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip_static on;
    }
}
```

## DNS Configuration

Tambahkan DNS records berikut:

```dns
# A Records
suatalk.site.        A    YOUR_SERVER_IP
api.suatalk.site.    A    YOUR_SERVER_IP
www.suatalk.site.    A    YOUR_SERVER_IP

# CNAME Records (alternative)
www.suatalk.site.    CNAME    suatalk.site.
```

## SSL Certificate Setup

### Using Let's Encrypt

```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Generate certificates for both domains
sudo certbot --nginx -d suatalk.site -d www.suatalk.site
sudo certbot --nginx -d api.suatalk.site

# Auto-renewal
sudo crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## Environment Configuration

### Production Environment Variables

```bash
# Production .env
NODE_ENV=production
PORT=3000
API_URL=https://api.suatalk.site
FRONTEND_URL=https://suatalk.site
CLIENT_URL=https://suatalk.site

# OAuth Callback URLs
GOOGLE_CALLBACK_URL=https://api.suatalk.site/auth/google/callback

# CORS Origins
CORS_ORIGINS=https://suatalk.site,https://www.suatalk.site

# MongoDB (use production database)
MONGODB_URI=mongodb://localhost:27017/suatalk_production

# ML Service (internal network)
ML_SERVICE_URL=http://localhost:5000
```

### Development Environment Variables

```bash
# Development .env
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000

# OAuth Callback URLs
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/suatalk_dev

# ML Service
ML_SERVICE_URL=http://localhost:5000
```

## Deployment Steps

### 1. Enable Nginx Sites

```bash
# Enable API subdomain
sudo ln -s /etc/nginx/sites-available/api.suatalk.site /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/suatalk.site /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 2. Backend Deployment

```bash
# Clone repository
git clone https://github.com/username/sua-talk-be.git
cd sua-talk-be

# Install dependencies
npm install --production

# Setup environment
cp .env.example .env
# Edit .env with production values

# Setup PM2 for production
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Frontend Deployment

```bash
# Clone frontend repository
git clone https://github.com/username/sua-talk-fe.git
cd sua-talk-fe

# Install dependencies
npm install

# Build for production
npm run build

# Copy to nginx root
sudo cp -r dist/* /var/www/suatalk-frontend/
sudo chown -R www-data:www-data /var/www/suatalk-frontend/
```

## Testing

### API Endpoints

```bash
# Health check
curl https://api.suatalk.site/health

# API root
curl https://api.suatalk.site/

# Auth endpoints
curl https://api.suatalk.site/auth/status
```

### Frontend

```bash
# Website access
curl -I https://suatalk.site
curl -I https://www.suatalk.site
```

## Monitoring

### Nginx Logs

```bash
# API access logs
sudo tail -f /var/log/nginx/access.log | grep api.suatalk.site

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Application Logs

```bash
# PM2 logs
pm2 logs sua-talk-api

# Application health
curl https://api.suatalk.site/health
```

## Security Considerations

1. **Rate Limiting**: Implemented at nginx level
2. **SSL/TLS**: Force HTTPS for all connections
3. **CORS**: Configured for specific origins only
4. **Security Headers**: Added via nginx
5. **File Upload Limits**: 50MB max file size
6. **Authentication**: JWT-based with secure defaults

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check FRONTEND_URL in .env
2. **SSL Certificate Issues**: Verify Let's Encrypt renewal
3. **OAuth Callback Mismatch**: Update Google Console settings
4. **502 Bad Gateway**: Check if Node.js service is running
5. **404 Errors**: Verify nginx configuration and DNS

### Debug Commands

```bash
# Check nginx status
sudo systemctl status nginx

# Check backend service
pm2 status
pm2 logs sua-talk-api

# Test API connectivity
curl -v https://api.suatalk.site/health

# Check DNS resolution
nslookup api.suatalk.site
``` 