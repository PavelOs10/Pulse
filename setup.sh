#!/bin/bash
# ═══════════════════════════════════════════════════
# Pulse Messenger — Скрипт установки на VDS (Ubuntu)
# ═══════════════════════════════════════════════════

set -e

echo "╔═══════════════════════════════════════════╗"
echo "║   🚀 Pulse Messenger — Установка          ║"
echo "╚═══════════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── 1. Обновление системы ──
echo -e "${CYAN}[1/7] Обновление системы...${NC}"
sudo apt update && sudo apt upgrade -y

# ── 2. Установка Node.js 20 ──
echo -e "${CYAN}[2/7] Установка Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# ── 3. Установка build tools ──
echo -e "${CYAN}[3/7] Установка build tools...${NC}"
sudo apt install -y build-essential python3 nginx certbot python3-certbot-nginx

# ── 4. Установка серверных зависимостей ──
echo -e "${CYAN}[4/7] Установка серверных зависимостей...${NC}"
cd server
npm install --production
cd ..

# ── 5. Сборка клиента ──
echo -e "${CYAN}[5/7] Сборка клиента...${NC}"
cd client
npm install
npm run build
cd ..

# ── 6. Создание systemd сервиса ──
echo -e "${CYAN}[6/7] Создание systemd сервиса...${NC}"

# Generate a random JWT secret
JWT_SECRET=$(openssl rand -hex 32)

sudo tee /etc/systemd/system/pulse-messenger.service > /dev/null <<EOF
[Unit]
Description=Pulse Messenger
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/server
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=JWT_SECRET=$JWT_SECRET
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable pulse-messenger
sudo systemctl start pulse-messenger

# ── 7. Вывод информации ──
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   ✅ Pulse Messenger успешно установлен!              ║"
echo "║                                                       ║"
echo "║   Сервер запущен на порту 3000                        ║"
echo "║   JWT Secret: $JWT_SECRET"
echo "║                                                       ║"
echo "║   Следующие шаги:                                     ║"
echo "║   1. Настройте домен (A-запись → IP сервера)          ║"
echo "║   2. Настройте nginx:                                 ║"
echo "║      sudo cp nginx.conf /etc/nginx/sites-available/pulse ║"
echo "║      sudo ln -s /etc/nginx/sites-available/pulse \\    ║"
echo "║                 /etc/nginx/sites-enabled/              ║"
echo "║      # Отредактируйте домен в файле                   ║"
echo "║      sudo nginx -t && sudo systemctl reload nginx     ║"
echo "║   3. Получите SSL сертификат:                         ║"
echo "║      sudo certbot --nginx -d your-domain.com          ║"
echo "║                                                       ║"
echo "║   Управление:                                         ║"
echo "║   sudo systemctl status pulse-messenger               ║"
echo "║   sudo systemctl restart pulse-messenger              ║"
echo "║   sudo journalctl -u pulse-messenger -f               ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"
