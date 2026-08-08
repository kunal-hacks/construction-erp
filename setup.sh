#!/bin/bash
set -e

# Construction ERP — Automated Setup Script
# Run this once after extracting the ZIP

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

print_step() { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "${RED}✗ $1${NC}"; }

echo -e "${BOLD}"
echo "╔══════════════════════════════════════╗"
echo "║     Construction ERP  — Setup        ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# Check Docker
print_step "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
  print_err "Docker is not installed. Please install Docker first: https://docker.com"
  exit 1
fi
if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
  print_err "Docker Compose is not installed."
  exit 1
fi
print_ok "Docker and Docker Compose are available"

# Detect docker compose command
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
fi

# Configure .env
print_step "Configuring environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  print_warn ".env created from template — please review it"
fi

# Generate random JWT secrets if still using defaults
if grep -q "CHANGE_ME\|change-now\|change-me" .env; then
  print_warn "Generating secure JWT secrets..."
  JWT=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-' | head -c 64)
  REFRESH=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-' | head -c 64)
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
    sed -i '' "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${REFRESH}|" .env
  else
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${REFRESH}|" .env
  fi
  print_ok "Secure JWT secrets generated"
fi

# Build and start
print_step "Building Docker images (this takes 3-5 minutes on first run)..."
$DOCKER_COMPOSE build --parallel
print_ok "Images built"

print_step "Starting all services..."
$DOCKER_COMPOSE up -d postgres redis minio
echo "  Waiting for databases to be ready..."
sleep 8

$DOCKER_COMPOSE up -d minio_init
sleep 3

$DOCKER_COMPOSE up -d backend
echo "  Waiting for backend to start..."

# Wait for backend health
MAX_WAIT=60
WAITED=0
until curl -sf http://localhost:3000/health > /dev/null 2>&1; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    print_err "Backend did not start in time. Check logs: docker compose logs backend"
    exit 1
  fi
  sleep 3
  WAITED=$((WAITED + 3))
  echo -n "."
done
echo ""
print_ok "Backend is running"

print_step "Running database migrations..."
$DOCKER_COMPOSE exec -T backend npx prisma migrate deploy
print_ok "Migrations applied"

print_step "Seeding demo data..."
$DOCKER_COMPOSE exec -T backend npx prisma db seed
print_ok "Demo data loaded"

print_step "Starting frontend and nginx..."
$DOCKER_COMPOSE up -d web nginx

echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║         ✅ Setup Complete!                   ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Web App  →  http://localhost                ║"
echo "║  API      →  http://localhost/api/v1         ║"
echo "║  MinIO    →  http://localhost:9001           ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Login: admin@erp.com  /  Admin@123          ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
