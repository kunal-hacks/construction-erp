#!/bin/bash
set -e

# Construction ERP — VPS Deployment Script
# Run this on your VPS after copying the project

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
print_step() { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

DOMAIN=${1:-""}
EMAIL=${2:-""}

if [ -z "$DOMAIN" ]; then
  echo "Usage: ./deploy-vps.sh yourdomain.com your@email.com"
  echo "       ./deploy-vps.sh 192.168.1.100   (IP only, no SSL)"
  exit 1
fi

DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null 2>&1; then DOCKER_COMPOSE="docker-compose"; fi

# Update .env with domain
print_step "Configuring for domain: $DOMAIN"
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" .env
  sed -i '' "s|CORS_ORIGINS=.*|CORS_ORIGINS=https://${DOMAIN},http://${DOMAIN}|" .env
  sed -i '' "s|DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
else
  sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" .env
  sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=https://${DOMAIN},http://${DOMAIN}|" .env
  sed -i "s|DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
fi

# Generate secrets if still default
if grep -q "change-now\|CHANGE_ME" .env; then
  JWT=$(openssl rand -hex 32)
  REFRESH=$(openssl rand -hex 32)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${REFRESH}|" .env
  print_ok "Generated secure secrets"
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  print_step "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  DOCKER_COMPOSE="docker compose"
  print_ok "Docker installed"
fi

# SSL setup (only if domain is not an IP and email provided)
if [ -n "$EMAIL" ] && [[ ! "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  print_step "Setting up SSL certificate for $DOMAIN..."
  
  # Install certbot
  if ! command -v certbot &> /dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y certbot
  fi
  
  # Stop nginx if running on port 80
  $DOCKER_COMPOSE stop nginx 2>/dev/null || true
  
  # Get certificate
  sudo certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN"
  
  # Copy certs to project
  mkdir -p docker/nginx/ssl
  sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem docker/nginx/ssl/
  sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem docker/nginx/ssl/
  sudo chown -R $USER:$USER docker/nginx/ssl/
  
  # Enable HTTPS in nginx config
  python3 -c "
content = open('docker/nginx/conf.d/default.conf').read()
# Uncomment 443 port in docker-compose
compose = open('docker-compose.yml').read()
compose = compose.replace('      # - \"443:443\"', '      - \"443:443\"')
compose = compose.replace('      # - ./docker/nginx/ssl:/etc/nginx/ssl:ro', '      - ./docker/nginx/ssl:/etc/nginx/ssl:ro')
open('docker-compose.yml', 'w').write(compose)
print('HTTPS enabled in docker-compose.yml')
"
  # Update nginx to enable HTTPS server block
  sed -i 's|# server {|server {|g' docker/nginx/conf.d/default.conf
  sed -i "s|#     listen 443|    listen 443|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     server_name yourdomain.com|    server_name ${DOMAIN}|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     ssl_certificate|    ssl_certificate|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     ssl_certificate_key|    ssl_certificate_key|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     ssl_protocols|    ssl_protocols|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     ssl_ciphers|    ssl_ciphers|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     ssl_prefer_server_ciphers|    ssl_prefer_server_ciphers|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     ssl_session_cache|    ssl_session_cache|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     ssl_session_timeout|    ssl_session_timeout|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     add_header Strict|    add_header Strict|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     location /api/|    location /api/|g" docker/nginx/conf.d/default.conf
  sed -i "s|#         proxy_pass http://backend|        proxy_pass http://backend|g" docker/nginx/conf.d/default.conf
  sed -i "s|#         proxy_set_header Host|        proxy_set_header Host|g" docker/nginx/conf.d/default.conf
  sed -i "s|#         proxy_set_header X-Real-IP|        proxy_set_header X-Real-IP|g" docker/nginx/conf.d/default.conf
  sed -i "s|#         proxy_set_header X-Forwarded-For|        proxy_set_header X-Forwarded-For|g" docker/nginx/conf.d/default.conf
  sed -i "s|#         proxy_set_header X-Forwarded-Proto https|        proxy_set_header X-Forwarded-Proto https|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     location / {|    location / {|g" docker/nginx/conf.d/default.conf
  sed -i "s|#         proxy_pass http://frontend|        proxy_pass http://frontend|g" docker/nginx/conf.d/default.conf
  sed -i "s|#         proxy_set_header Host \$host|        proxy_set_header Host \$host|g" docker/nginx/conf.d/default.conf
  sed -i "s|#     }|    }|g" docker/nginx/conf.d/default.conf
  sed -i 's|# }||g' docker/nginx/conf.d/default.conf
  
  # Setup auto-renewal
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && $DOCKER_COMPOSE -f $(pwd)/docker-compose.yml exec nginx nginx -s reload") | crontab -
  
  print_ok "SSL certificate installed and auto-renewal configured"
fi

# Build and deploy
print_step "Building and starting all services..."
$DOCKER_COMPOSE build --parallel
$DOCKER_COMPOSE up -d

# Wait for backend
echo "Waiting for backend..."
sleep 15
MAX=60; W=0
until curl -sf http://localhost:3000/health > /dev/null 2>&1; do
  [ $W -ge $MAX ] && { echo "Backend timeout - check: $DOCKER_COMPOSE logs backend"; exit 1; }
  sleep 3; W=$((W+3)); echo -n "."
done
echo ""

# Migrate and seed
print_step "Running database setup..."
$DOCKER_COMPOSE exec -T backend npx prisma migrate deploy
$DOCKER_COMPOSE exec -T backend npx prisma db seed
print_ok "Database ready"

# Setup systemd service
print_step "Setting up auto-start service..."
sudo tee /etc/systemd/system/construction-erp.service > /dev/null << EOF
[Unit]
Description=Construction ERP
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=$(which docker) compose up -d
ExecStop=$(which docker) compose down
TimeoutStartSec=120
User=$USER

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable construction-erp
print_ok "Auto-start service configured"

# Setup backup
print_step "Setting up daily backups..."
BACKUP_SCRIPT="/opt/erp-backup.sh"
sudo tee $BACKUP_SCRIPT > /dev/null << BEOF
#!/bin/bash
DIR="/opt/backups/erp/\$(date +%Y%m%d_%H%M%S)"
mkdir -p \$DIR
docker exec erp_postgres pg_dump -U erp_user construction_erp | gzip > "\$DIR/db.sql.gz"
find /opt/backups/erp -mtime +30 -delete
echo "Backup done: \$DIR"
BEOF
sudo chmod +x $BACKUP_SCRIPT
(sudo crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_SCRIPT >> /var/log/erp-backup.log 2>&1") | sudo crontab -
print_ok "Daily backup at 2 AM configured"

PROTOCOL="http"
[ -n "$EMAIL" ] && [[ ! "$DOMAIN" =~ ^[0-9] ]] && PROTOCOL="https"

echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║        ✅ VPS Deployment Complete!               ║"
echo "╠══════════════════════════════════════════════════╣"
printf "║  Web App  →  %-36s║\n" "${PROTOCOL}://${DOMAIN}"
printf "║  API      →  %-36s║\n" "${PROTOCOL}://${DOMAIN}/api/v1"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Login: admin@erp.com  /  Admin@123              ║"
echo "║  ⚠  Change passwords after first login!          ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
