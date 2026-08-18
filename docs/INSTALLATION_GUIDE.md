# Construction ERP - Complete Installation & Execution Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Manual Installation](#manual-installation)
4. [Mobile App Setup](#mobile-app-setup)
5. [Configuration Reference](#configuration-reference)
6. [VPS Deployment Guide](#vps-deployment-guide)
7. [Default Credentials](#default-credentials)
8. [Troubleshooting](#troubleshooting)
9. [API Documentation](#api-documentation)

---

## Prerequisites

### Required Software
| Software | Minimum Version | Install Link |
|----------|----------------|--------------|
| Node.js  | 18.x LTS       | https://nodejs.org |
| npm      | 9.x            | Bundled with Node.js |
| Docker   | 24.x           | https://docker.com |
| Docker Compose | 2.x     | Bundled with Docker Desktop |
| Git      | 2.x            | https://git-scm.com |

### Optional (for mobile development)
- Android Studio + SDK (for Android build)
- Xcode 14+ (macOS only, for iOS build)
- Expo CLI: `npm install -g expo-cli eas-cli`

---

## Quick Start (Docker)

This is the **recommended** method. Spins up the entire stack in minutes.

### Step 1 — Clone / Extract the project
```bash
# If using git:
git clone <repo-url> construction-erp
cd construction-erp

# If using ZIP:
unzip construction-erp.zip
cd construction-erp
```

### Step 2 — Configure environment
```bash
# Copy the example env file
cp .env.example .env

# Edit with your values (minimum: change JWT secrets)
nano .env    # or: code .env
```

**Minimum required changes in `.env`:**
```env
JWT_SECRET=your-unique-secret-at-least-32-characters-long
JWT_REFRESH_SECRET=your-unique-refresh-secret-at-least-32-chars
```

### Step 3 — Start all services
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- MinIO on port 9000 (console: 9001)
- Backend API on port 3000
- Web Frontend on port 3001
- Nginx reverse proxy on port 80

### Step 4 — Initialize the database
```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Seed with demo data
docker-compose exec backend npx prisma db seed
```

### Step 5 — Access the application
| Service | URL | Credentials |
|---------|-----|-------------|
| Web App | http://localhost | admin@erp.com / Admin@123 |
| API | http://localhost/api/v1 | — |
| API Docs | http://localhost/api/v1/docs | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123 |

---

## Manual Installation (Development)

Use this if you want to run services individually for development.

### Step 1 — Install infrastructure

**Option A: Docker (just databases)**
```bash
# Start only databases and storage
docker-compose up -d postgres redis minio minio_init
```

**Option B: Install locally**
```bash
# PostgreSQL
brew install postgresql@16        # macOS
sudo apt install postgresql-16    # Ubuntu

# Redis
brew install redis                # macOS
sudo apt install redis-server     # Ubuntu

# Start services
brew services start postgresql@16 redis   # macOS
sudo systemctl start postgresql redis     # Ubuntu
```

### Step 2 — Backend Setup

```bash
cd apps/backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, Redis, MinIO settings

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed the database with demo data
npm run db:seed

# Start development server
npm run dev
```

Backend will run at: **http://localhost:3000**

### Step 3 — Web Frontend Setup

```bash
cd apps/web

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000/api/v1

# Start development server
npm run dev
```

Web app will run at: **http://localhost:3001**

### Step 4 — Verify installation
```bash
# Check backend health
curl http://localhost:3000/health

# Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@erp.com","password":"Admin@123"}'
```

---

## Mobile App Setup

### Development (Expo Go)

```bash
cd apps/mobile

# Install dependencies
npm install

# Set API URL in app.config.js or .env
# For Android emulator, use: http://10.0.2.2:3000/api/v1
# For physical device, use: http://YOUR_PC_IP:3000/api/v1

# Start Expo dev server
npx expo start

# Options:
# Press 'a' for Android emulator
# Press 'i' for iOS simulator (macOS only)
# Scan QR code with Expo Go app for physical device
```

### Build Android APK

```bash
cd apps/mobile

# Install EAS CLI
npm install -g eas-cli

# Login to Expo (create account at expo.dev)
eas login

# Configure EAS
eas build:configure

# Build APK (development)
eas build -p android --profile development

# Build APK (production)
eas build -p android --profile production
```

### Build locally (without EAS)

```bash
cd apps/mobile

# Prerequisites: Android Studio + SDK installed
npx expo run:android --variant release
```

---

## Configuration Reference

### Backend Environment Variables (`apps/backend/.env`)

```env
# Server
NODE_ENV=production          # development | production
PORT=3000                    # API server port

# Database (PostgreSQL)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"

# JWT Authentication
JWT_SECRET=min-32-char-secret        # Access token secret
JWT_REFRESH_SECRET=min-32-char-secret # Refresh token secret
JWT_EXPIRES_IN=15m                    # Access token expiry
JWT_REFRESH_EXPIRES_IN=7d             # Refresh token expiry

# Redis (caching)
REDIS_URL=redis://localhost:6379
# With password: redis://:password@localhost:6379

# MinIO (file storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=construction-erp

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password    # Gmail: use App Password, not account password
SMTP_FROM=noreply@yourapp.com

# CORS
CORS_ORIGINS=http://localhost:3001,https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Web Frontend (`apps/web/.env`)

```env
VITE_API_URL=http://localhost:3000/api/v1    # Backend API URL
VITE_APP_NAME=Construction ERP
```

---

## VPS Deployment Guide

### Recommended Server Specs
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU      | 2 cores | 4 cores     |
| RAM      | 4 GB    | 8 GB        |
| Storage  | 50 GB SSD | 100 GB SSD |
| OS       | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Step 1 — Server preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

### Step 2 — Deploy application

```bash
# Copy project to server
scp -r construction-erp/ user@your-server-ip:/opt/

# SSH into server
ssh user@your-server-ip

cd /opt/construction-erp

# Configure production environment
cp .env.example .env
nano .env    # Set strong secrets, your domain, SMTP settings

# Start services
docker compose up -d

# Initialize database
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### Step 3 — Configure domain & SSL

```bash
# Install Certbot
sudo apt install certbot -y

# Get SSL certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem docker/nginx/ssl/

# Enable HTTPS in Nginx config
nano docker/nginx/conf.d/default.conf
# Uncomment the HTTPS server block and update domain

# Reload Nginx
docker compose exec nginx nginx -s reload
```

### Step 4 — Auto-renewal SSL

```bash
# Add to crontab
echo "0 0 */60 * * certbot renew --quiet && docker compose -f /opt/construction-erp/docker-compose.yml exec nginx nginx -s reload" | sudo crontab -
```

### Step 5 — System service (auto-start on reboot)

```bash
sudo tee /etc/systemd/system/construction-erp.service << 'EOF'
[Unit]
Description=Construction ERP
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/construction-erp
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable construction-erp
sudo systemctl start construction-erp
```

### Step 6 — Setup automatic backups

```bash
sudo tee /opt/backup-erp.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/construction-erp"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec erp_postgres pg_dump -U erp_user construction_erp | \
  gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"

# Backup MinIO data
docker run --rm -v erp_minio_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/minio_$DATE.tar.gz /data

# Keep only last 30 days
find $BACKUP_DIR -mtime +30 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/backup-erp.sh

# Schedule daily at 2 AM
echo "0 2 * * * /opt/backup-erp.sh >> /var/log/erp-backup.log 2>&1" | sudo crontab -
```

---

## Default Credentials

### Application Users
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@erp.com | Admin@123 |
| Admin | admin@erp.com | Admin@123 |
| Project Manager | pm@erp.com | Admin@123 |
| Site Engineer | engineer@erp.com | Admin@123 |
| Store Manager | store@erp.com | Admin@123 |
| Accountant | accounts@erp.com | Admin@123 |
| Viewer | viewer@erp.com | Admin@123 |

### Infrastructure
| Service | Username | Password |
|---------|----------|----------|
| PostgreSQL | erp_user | erp_password |
| MinIO | minioadmin | minioadmin123 |
| Redis | — | redis_password |

> ⚠️ **IMPORTANT:** Change ALL default passwords before production deployment!

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Common fix: Wait for database to be ready
docker-compose restart backend

# Check database connection
docker-compose exec postgres psql -U erp_user -d construction_erp -c "SELECT 1;"
```

### Database migration fails
```bash
# Reset and re-run migrations
docker-compose exec backend npx prisma migrate reset --force
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed
```

### Cannot connect to API from mobile
```bash
# For Android emulator, backend must be on:
# http://10.0.2.2:3000/api/v1 (not localhost!)

# For physical device, use your machine's LAN IP:
ipconfig getifaddr en0     # macOS
hostname -I                 # Linux
```

### Port conflicts
```bash
# Check what's using port 3000
lsof -i :3000
# Kill it
kill -9 $(lsof -t -i :3000)
```

### MinIO file upload fails
```bash
# Check MinIO is running
docker-compose ps minio

# Recreate bucket
docker-compose restart minio_init
```

### Out of disk space
```bash
# Clean Docker resources
docker system prune -a --volumes

# Check disk usage
df -h
du -sh /var/lib/docker/
```

---

## API Documentation

Base URL: `http://localhost:3000/api/v1`

### Authentication
All endpoints (except login) require: `Authorization: Bearer <access_token>`

### Key Endpoints

#### Auth
```
POST /auth/login          - Login (returns access + refresh tokens)
POST /auth/logout         - Logout
POST /auth/refresh        - Refresh access token
GET  /auth/profile        - Get current user profile
PUT  /auth/profile        - Update profile
PUT  /auth/change-password - Change password
POST /auth/forgot-password - Request password reset
POST /auth/set-password  - Reset password with token
```

#### Projects
```
GET    /projects           - List projects (paginated)
POST   /projects           - Create project
GET    /projects/:id       - Get project details
PUT    /projects/:id       - Update project
DELETE /projects/:id       - Cancel project
GET    /projects/:id/dashboard - Project dashboard stats
POST   /projects/:id/members   - Add team member
DELETE /projects/:id/members/:userId - Remove member
```

#### Expenses
```
GET    /expenses           - List expenses
POST   /expenses           - Create expense
GET    /expenses/:id       - Get expense
PUT    /expenses/:id       - Update expense
DELETE /expenses/:id       - Delete expense
POST   /expenses/:id/approve - Approve/reject expense
GET    /expenses/summary   - Expense analytics summary
```

#### Daily Reports
```
GET  /daily-reports        - List reports
POST /daily-reports        - Create report (supports offline flag)
GET  /daily-reports/:id    - Get report
PUT  /daily-reports/:id    - Update report
POST /daily-reports/:id/photos - Upload photo
POST /daily-reports/sync   - Bulk sync offline reports
```

#### Inventory
```
GET  /inventory/materials      - List materials
POST /inventory/materials      - Create material
GET  /inventory/categories     - List categories
GET  /inventory/project/:id    - Project inventory
POST /inventory/stock-in       - Record stock in
POST /inventory/stock-out      - Record stock out
GET  /inventory/movements      - Stock movement history
```

#### Truck Entries
```
GET  /truck-entries        - List entries
POST /truck-entries        - Create entry
PUT  /truck-entries/:id    - Update entry
POST /truck-entries/:id/weight-slip - Upload weight slip
GET  /truck-entries/summary - Summary stats
```

#### Analytics
```
GET /analytics/dashboard   - Admin dashboard stats
GET /analytics/expenses    - Expense analysis charts
GET /analytics/inventory   - Inventory analytics
GET /analytics/budget      - Budget vs actual analysis
GET /analytics/machinery   - Machinery utilization
```

### Query Parameters (all list endpoints)
```
?page=1              - Page number (default: 1)
?pageSize=20         - Items per page (max: 100)
?search=keyword      - Full-text search
?status=ACTIVE       - Filter by status
?projectId=xxx       - Filter by project
?startDate=2024-01-01 - Date range start
?endDate=2024-12-31  - Date range end
```

### Response Format
```json
{
  "success": true,
  "message": "Success",
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

---

## Useful Commands

```bash
# View all running containers
docker-compose ps

# View logs
docker-compose logs -f backend       # Follow backend logs
docker-compose logs -f               # All services

# Execute commands in containers
docker-compose exec backend sh       # Shell in backend
docker-compose exec postgres psql -U erp_user construction_erp  # Database shell

# Restart a service
docker-compose restart backend

# Stop everything
docker-compose down

# Stop and remove volumes (WARNING: deletes all data!)
docker-compose down -v

# Rebuild after code changes
docker-compose build backend
docker-compose up -d backend

# Prisma commands
docker-compose exec backend npx prisma studio       # Database GUI
docker-compose exec backend npx prisma db seed      # Re-seed data
docker-compose exec backend npx prisma migrate dev  # Create new migration
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    NGINX (Port 80/443)                   │
│              Reverse Proxy + Load Balancer               │
└────────────────┬──────────────────┬─────────────────────┘
                 │                  │
     ┌───────────▼───┐    ┌────────▼────────┐
     │  React Web    │    │  Express API     │
     │  (Port 3001)  │    │  (Port 3000)     │
     └───────────────┘    └──────┬──────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
    ┌─────────▼───┐    ┌────────▼──────┐   ┌───────▼──────┐
    │ PostgreSQL  │    │    Redis      │   │    MinIO      │
    │ (Port 5432) │    │  (Port 6379)  │   │  (Port 9000)  │
    └─────────────┘    └───────────────┘   └──────────────┘
```

---

*Construction ERP v1.0.0 — Built with Node.js, React, PostgreSQL, Docker*
