# 🟢 Pulse Messenger

Самохостный мессенджер с функционалом как в Telegram. Работает на вашем VDS сервере.

## Возможности

- **Регистрация** по email + username (без телефона)
- **Текстовые сообщения** с эмодзи
- **Голосовые сообщения** — запись и воспроизведение
- **Кружочки** — видеосообщения (как в Telegram)
- **Видеозвонки** и аудиозвонки (WebRTC)
- **Обмен файлами** и изображениями
- **Статус онлайн/оффлайн**
- **Индикатор "печатает..."**
- **PWA** — устанавливается на Android как приложение
- **Адаптивный дизайн** — мобильная и десктоп версия

## Технологии

| Компонент | Технология |
|-----------|-----------|
| Сервер | Node.js + Express |
| Реалтайм | WebSocket (ws) |
| БД | SQLite (better-sqlite3) |
| Звонки | WebRTC |
| Клиент | React (PWA) |
| Авторизация | JWT + bcrypt |

## Быстрый старт

### Вариант 1: Docker (рекомендуется)

```bash
# Клонируйте проект на сервер
scp -r messenger/ user@your-server:/home/user/pulse-messenger

# На сервере
cd pulse-messenger
docker-compose up -d
```

### Вариант 2: Ручная установка

```bash
# Клонируйте проект на сервер
scp -r messenger/ user@your-server:/home/user/pulse-messenger

# На сервере
cd pulse-messenger
chmod +x setup.sh
./setup.sh
```

## Настройка HTTPS (обязательно для звонков!)

WebRTC требует HTTPS для работы камеры и микрофона.

### 1. Направьте домен на сервер

Создайте A-запись: `pulse.yourdomain.com → IP_СЕРВЕРА`

### 2. Настройте Nginx

```bash
# Скопируйте конфиг
sudo cp nginx.conf /etc/nginx/sites-available/pulse

# Отредактируйте домен
sudo nano /etc/nginx/sites-available/pulse
# Замените your-domain.com на ваш домен

# Активируйте
sudo ln -s /etc/nginx/sites-available/pulse /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Получите SSL от Let's Encrypt

```bash
sudo certbot --nginx -d pulse.yourdomain.com
```

## Установка на Android как приложение

1. Откройте `https://pulse.yourdomain.com` в Chrome
2. Нажмите ⋮ (меню) → "Добавить на главный экран"
3. Приложение появится на рабочем столе как нативное

## Управление сервером

```bash
# Статус
sudo systemctl status pulse-messenger

# Перезапуск
sudo systemctl restart pulse-messenger

# Логи (в реальном времени)
sudo journalctl -u pulse-messenger -f

# Остановка
sudo systemctl stop pulse-messenger
```

## Конфигурация

Переменные окружения (`.env` или systemd):

| Переменная | Описание | По умолчанию |
|-----------|----------|-------------|
| `PORT` | Порт сервера | 3000 |
| `JWT_SECRET` | Секрет для JWT токенов | (генерируется) |

## Структура проекта

```
pulse-messenger/
├── server/
│   ├── server.js         # Весь бэкенд (API + WebSocket)
│   ├── package.json
│   └── uploads/          # Загруженные файлы
│       ├── avatars/
│       ├── voice/
│       ├── video/
│       ├── images/
│       ├── files/
│       └── circles/
├── client/
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   └── src/
│       ├── index.js
│       └── App.js        # Весь фронтенд
├── nginx.conf
├── Dockerfile
├── docker-compose.yml
├── setup.sh
└── README.md
```

## API Endpoints

### Авторизация
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход

### Пользователи
- `GET /api/users/me` — текущий пользователь
- `PATCH /api/users/me` — обновить профиль
- `GET /api/users/search?q=...` — поиск пользователей

### Чаты
- `GET /api/chats` — список чатов
- `POST /api/chats` — создать чат

### Сообщения
- `GET /api/chats/:id/messages` — сообщения чата

### Файлы
- `POST /api/upload/:type` — загрузить файл

### WebSocket Events
- `auth` — авторизация
- `message` — отправка сообщения
- `typing` — индикатор набора
- `read` — отметка о прочтении
- `call_offer/answer/end/reject` — звонки (WebRTC signaling)

## Безопасность

- Пароли хешируются bcrypt (12 раундов)
- JWT токены с 30-дневным сроком
- Все файлы сохраняются на вашем сервере
- Нет внешних зависимостей для данных
- Рекомендуется настроить firewall (ufw)

```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```
