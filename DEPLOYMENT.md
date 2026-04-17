# 🚀 Mind Freek - Deployment & Setup Guide

## 📋 Prerequisites

- Node.js v14 or higher
- MySQL 5.7 or higher
- Git
- npm or yarn package manager

## 🔧 Local Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd mind-freek
```

### 2. Backend Setup

```bash
cd mindfreek-backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Edit .env with your settings
nano .env
# OR
code .env
```

**Backend .env setup:**
```env
PORT=5001
PLAYERS=3
ROUND_TIME=100
TOTAL_ROUNDS=3
PRE_GAME_COUNTDOWN=10
TURN_POPUP_DURATION=10
GAME_OVER_CLEANUP_DELAY=3
MATCH_SEARCH_TIMEOUT=30
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=mindfreek
NODE_ENV=development
```

### 3. Database Setup

```bash
# Run database setup script
mysql -u root -p < database_setup.sql

# Or manually create database:
# 1. Open MySQL Workbench or MySQL CLI
# 2. Run: source /path/to/database_setup.sql
```

### 4. Start Backend Server

```bash
cd mindfreek-backend

# Development mode (with auto-reload)
npm run dev

# Production mode
npm run start

# Check if running
curl http://localhost:5001/
```

Expected output:
```json
{
  "status": 1,
  "server": "running",
  "db": "connected",
  "environment": "development"
}
```

### 5. Frontend Setup

```bash
cd mindfreek

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Edit .env
nano .env
```

**Frontend .env setup:**
```env
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_WEB_SOCKET_URL=ws://localhost:5001
PLAYERS=3
REACT_APP_TOTAL_ROUNDS=3
REACT_APP_PRE_GAME_COUNTDOWN=10
REACT_APP_TURN_POPUP_DURATION=10
REACT_APP_MATCH_SEARCH_TIMEOUT=30
REACT_APP_DEBUG=true
NODE_ENV=development
```

### 6. Start Frontend

```bash
cd mindfreek

# Development mode (auto-reload)
npm start

# Production build
npm run build
```

Frontend will open at: `http://localhost:3000`

## 🎯 Verify Setup

### 1. Check Backend Health

```bash
curl http://localhost:5001/
```

### 2. Check Metrics

```bash
curl http://localhost:5001/api/metrics
```

### 3. Test Socket Connection

Open browser console in your game and look for:
```
🟢 connected: [socket-id]
```

### 4. Create Test User

1. Go to http://localhost:3000
2. Fill in name, language, country, avatar
3. Click "Start"
4. Check console for socket connection

## 🌍 Production Deployment

### 1. Server Setup

```bash
# SSH into your server
ssh username@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
sudo apt-get install -y mysql-server

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Production Environment

```bash
# Backend production .env
PORT=5001
NODE_ENV=production
DB_HOST=your-db-host
DB_USER=db-user
DB_PASSWORD=secure-password
DB_NAME=mindfreek
PLAYERS=3
ROUND_TIME=100
TOTAL_ROUNDS=3
PRE_GAME_COUNTDOWN=10
TURN_POPUP_DURATION=10
GAME_OVER_CLEANUP_DELAY=3
MATCH_SEARCH_TIMEOUT=30
```

### 3. Deploy Backend with PM2

```bash
cd /path/to/mindfreek-backend

# Install dependencies
npm install --production

# Start with PM2
pm2 start index.js --name "mindfreek-backend"

# Save PM2 config
pm2 save

# Auto-start on reboot
pm2 startup

# Monitor
pm2 monit
```

### 4. Deploy Frontend

```bash
cd /path/to/mindfreek

# Install dependencies
npm install

# Build production bundle
npm run build

# Serve with nginx or vercel/netlify
# OR use a static server:
sudo npm install -g serve
serve -s build -l 3000
```

### 5. Configure Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/mindfreek

server {
    listen 80;
    server_name mindfreek.com www.mindfreek.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mindfreek.com www.mindfreek.com;

    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:5001/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. SSL Setup

```bash
# Using Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d mindfreek.com -d www.mindfreek.com
```

### 7. Enable Nginx

```bash
sudo ln -s /etc/nginx/sites-available/mindfreek /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## 📊 Monitoring & Maintenance

### View Metrics

```bash
# Backend metrics
curl https://mindfreek.com/api/metrics

# PM2 logs
pm2 logs mindfreek-backend

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Database Backup

```bash
# Daily backup
mysqldump -u root -p mindfreek > backup-$(date +%Y%m%d).sql

# Or set up automated backups
0 2 * * * mysqldump -u root -p mindfreek > /backups/mindfreek-$(date +\%Y\%m\%d).sql
```

### Performance Optimization

1. **Enable compression** in Nginx:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;
```

2. **Add caching headers**:
```nginx
# For static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

3. **Database optimization**:
```bash
# Optimize tables
mysqlcheck -u root -p --optimize mindfreek
```

## 🔒 Security Checklist

- [ ] Update Node.js regularly
- [ ] Use strong database passwords
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Configure firewall rules
- [ ] Set up automatic backups
- [ ] Use environment variables for secrets
- [ ] Enable CORS only for your domain
- [ ] Keep dependencies updated
- [ ] Set up monitoring & alerts
- [ ] Test error handling in production

## 🐛 Troubleshooting

### Frontend can't connect to backend
```bash
# Check backend is running
curl http://backend-ip:5001/

# Check CORS is enabled
# Check REACT_APP_API_URL and REACT_APP_WEB_SOCKET_URL
# Check firewall allows connection
```

### Socket connection failing
```bash
# Check WebSocket support
# Check proxy configuration (if using nginx)
# Check socket.io version compatibility
```

### Database connection error
```bash
# Check MySQL is running
sudo systemctl status mysql

# Check credentials in .env
# Check database exists
mysql -u root -p -e "SHOW DATABASES;"
```

## 📈 Performance Targets

| Metric | Target | Monitor |
|--------|--------|---------|
| API Response | < 200ms | `/api/metrics` |
| Page Load | < 3s | Google PageSpeed |
| Uptime | 99.9% | PM2 monitoring |
| Database Query | < 100ms | MySQL slow log |
| Socket Latency | < 50ms | Browser DevTools |

## 🎯 Configuration Tuning

**For faster games:**
```env
ROUND_TIME=60
PRE_GAME_COUNTDOWN=5
TURN_POPUP_DURATION=5
MATCH_SEARCH_TIMEOUT=15
```

**For more players:**
```env
PLAYERS=4
TOTAL_ROUNDS=4
```

**For longer gameplay:**
```env
ROUND_TIME=120
TOTAL_ROUNDS=5
PLAYERS=5
```

---

**Deployment Date**: ____________  
**Server IP**: ____________  
**Domain**: ____________  
**Backup Location**: ____________  

For issues or questions, check the troubleshooting section or review application logs.
