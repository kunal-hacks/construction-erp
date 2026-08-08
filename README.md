# 🏗️ Construction ERP System

A complete, production-ready Enterprise Resource Planning system for construction companies — built with React, Node.js, PostgreSQL, and Docker.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://docker.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)

---

## ✨ Features

### 18 Complete Modules
| Module | Description |
|--------|-------------|
| 🔐 Authentication | JWT login, refresh tokens, role-based access |
| 📊 Dashboard | Real-time stats, charts, activity feed |
| 📁 Projects | Full project lifecycle management |
| 📋 Daily Reports | Progress tracking with photo uploads |
| 💰 Expenses | Multi-category with approval workflow |
| 📦 Inventory | Stock in/out, movements, low stock alerts |
| 🚚 Truck Entries | Weight slip management, vehicle tracking |
| ⚙️ Machinery | Equipment logs, maintenance records |
| 🏢 Vendors | Vendor database with spend analytics |
| 📄 Quotations | Quote comparison and management |
| 🛒 Purchase Orders | PO creation, approval, goods receipt |
| 👷 Labour | Worker management, attendance tracking |
| 💵 Salary | Payroll generation and payment tracking |
| 📂 Documents | Secure file storage (bills, contracts, photos) |
| ✅ Tasks | Kanban task management with comments |
| 🔔 Notifications | In-app notifications system |
| 📈 Analytics | Rich charts for expenses, budget, machinery |
| 🛡️ Audit Logs | Complete action history trail |

### Platform Support
- **Web Application** — React + Vite + Tailwind CSS
- **Android App** — React Native + Expo
- **iOS App** — React Native + Expo

### Key Capabilities
- 📱 **Offline Support** — Create reports/expenses without internet (auto-syncs)
- 🌙 **Dark Mode** — Full dark/light theme toggle
- 🔒 **Security** — JWT + refresh tokens, rate limiting, audit logging
- 🐳 **Docker Ready** — One command deployment
- 🗄️ **40+ DB Tables** — Fully normalized PostgreSQL schema

---

## 🚀 Quick Start

```bash
# 1. Extract project
unzip construction-erp.zip && cd construction-erp

# 2. Configure environment
cp .env.example .env
# Edit .env — change JWT secrets!

# 3. Start everything
docker-compose up -d

# 4. Initialize database
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed

# 5. Open browser
open http://localhost
```

**Login:** `admin@erp.com` / `Admin@123`

See [Installation Guide](docs/INSTALLATION_GUIDE.md) for full setup.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS, Zustand, React Query |
| **Mobile** | React Native, Expo, SQLite (offline) |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL 16 with Prisma ORM |
| **Cache** | Redis 7 |
| **Storage** | MinIO (S3-compatible) |
| **Auth** | JWT + Refresh Tokens |
| **Deployment** | Docker, Docker Compose, Nginx |

---

## 👥 User Roles

| Role | Access Level |
|------|-------------|
| Super Admin | Full system access |
| Admin | Project + approval management |
| Project Manager | Daily operations, reports, expenses |
| Site Engineer | Progress reports, machinery logs |
| Store Manager | Inventory management |
| Accountant | Financial reports, salary |
| Viewer | Read-only access |

---

## 📁 Project Structure

```
construction-erp/
├── apps/
│   ├── backend/          # Node.js + Express API
│   │   ├── src/
│   │   │   ├── controllers/   # Route handlers (18 modules)
│   │   │   ├── routes/        # Express routes
│   │   │   ├── middleware/    # Auth, upload, audit, error
│   │   │   ├── config/        # DB, Redis, MinIO
│   │   │   └── utils/         # JWT, logger, response helpers
│   │   └── prisma/
│   │       ├── schema.prisma  # 40+ table schema
│   │       └── seed.ts        # Demo data seeder
│   ├── web/              # React web application
│   │   └── src/
│   │       ├── pages/         # 18 page components
│   │       ├── components/    # Reusable UI components
│   │       ├── api/           # API service functions
│   │       └── store/         # Zustand state management
│   └── mobile/           # React Native + Expo app
│       └── src/
│           ├── screens/       # Mobile screens
│           ├── offline/       # SQLite + sync service
│           └── api/           # Mobile API client
├── docker/
│   ├── nginx/            # Nginx reverse proxy config
│   └── postgres/         # DB initialization
├── docs/
│   ├── INSTALLATION_GUIDE.md
│   └── API_REFERENCE.md
└── docker-compose.yml    # Complete stack definition
```

---

## 📖 Documentation

- [Installation Guide](docs/INSTALLATION_GUIDE.md)
- [API Reference](docs/API_REFERENCE.md)

---

*Construction ERP v1.0.0*
