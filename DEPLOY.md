# 🔄 CI/CD — Автодеплой через GitHub Actions

Pulse Messenger поддерживает полностью автоматический деплой. Push в `main` → автоматическая сборка, доставка и перезапуск на вашем VDS.

## Архитектура деплоя

```
┌──────────────┐     push      ┌───────────────┐     SSH/rsync    ┌──────────────┐
│   Разработка │  ──────────►  │ GitHub Actions │  ────────────►  │   VDS/Ubuntu │
│   (локально) │               │  (CI/CD)       │                 │   (продакшен)│
└──────────────┘               └───────────────┘                  └──────────────┘
                                     │                                   │
                               ┌─────┴─────┐                    ┌───────┴───────┐
                               │ ✅ Тесты   │                    │ Node.js app   │
                               │ 📦 Сборка  │                    │ Nginx + SSL   │
                               │ 🚀 Деплой  │                    │ systemd       │
                               └───────────┘                    └───────────────┘
```

## 3 Workflow'а

| Workflow | Файл | Триггер | Описание |
|----------|-------|---------|----------|
| **Deploy** | `deploy.yml` | Push в `main` | Основной деплой: тесты → сборка → доставка → перезапуск |
| **Setup Server** | `setup-server.yml` | Ручной | Первоначальная настройка VDS (Node.js, Nginx, SSL) |
| **Docker Deploy** | `deploy-docker.yml` | Ручной | Альтернативный деплой через Docker |

## Пошаговая настройка

### Шаг 1: Подготовка SSH ключа

На вашем **локальном компьютере** создайте SSH ключ для деплоя:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/pulse_deploy -C "pulse-deploy"
```

Скопируйте публичный ключ на сервер:

```bash
ssh-copy-id -i ~/.ssh/pulse_deploy.pub user@ваш-сервер
```

Скопируйте приватный ключ — он понадобится для GitHub Secrets:

```bash
cat ~/.ssh/pulse_deploy
```

### Шаг 2: Настройка GitHub Secrets

Перейдите в репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Добавьте следующие секреты:

| Секрет | Описание | Пример |
|--------|----------|--------|
| `SSH_HOST` | IP-адрес или домен VDS | `185.123.45.67` |
| `SSH_USER` | Пользователь на сервере | `deploy` или `root` |
| `SSH_PRIVATE_KEY` | Приватный SSH ключ (весь файл целиком) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SSH_PORT` | SSH порт (если не 22) | `22` |
| `JWT_SECRET` | Секрет для JWT токенов | `a1b2c3d4e5...` (длинная случайная строка) |
| `APP_PORT` | Порт приложения | `3000` |

#### Генерация JWT_SECRET

```bash
openssl rand -hex 64
```

### Шаг 3: Первоначальная настройка сервера

1. Перейдите в **Actions** → **🔧 Первоначальная настройка сервера**
2. Нажмите **Run workflow**
3. Заполните:
   - **Домен**: `pulse.yourdomain.com`
   - **Настроить SSL**: `true`
   - **Email для SSL**: `your@email.com`
4. Запустите

Этот workflow установит на VDS: Node.js 20, Nginx, SSL (Let's Encrypt), настроит firewall.

### Шаг 4: Первый деплой

Сделайте push в `main`:

```bash
git add .
git commit -m "Initial deploy"
git push origin main
```

GitHub Actions автоматически:
1. Установит зависимости
2. Соберёт React-клиент
3. Доставит файлы на сервер через rsync
4. Установит серверные зависимости
5. Создаст `.env` из GitHub Secrets
6. Создаст/обновит systemd сервис
7. Перезапустит приложение
8. Проверит что сервер отвечает

## Как это работает

### Автоматический деплой (deploy.yml)

При каждом push в `main`:

```
1. [test]     npm ci → npm run build     (проверка что всё собирается)
2. [deploy]   npm ci → npm run build     (сборка продакшен-версии)
3. [deploy]   rsync → сервер             (доставка файлов)
4. [deploy]   ssh → npm ci --production  (установка зависимостей)
5. [deploy]   ssh → создание .env        (секреты из GitHub Secrets)
6. [deploy]   ssh → systemctl restart    (перезапуск)
7. [deploy]   curl health check          (проверка работоспособности)
```

### Что попадает на сервер

Только продакшен-файлы (без node_modules, исходников клиента):

```
/home/user/pulse-messenger/
├── server/
│   ├── server.js
│   ├── package.json
│   └── node_modules/       ← устанавливается на сервере
├── client/
│   └── build/              ← собранный React
├── .env                    ← создаётся из GitHub Secrets
└── nginx.conf
```

## Добавление новых ENV переменных

1. Добавьте секрет в **GitHub Settings → Secrets**
2. Добавьте его в workflow `deploy.yml` в секцию создания `.env`:

```yaml
cat > .env <<'ENVEOF'
NODE_ENV=production
PORT=${{ secrets.APP_PORT }}
JWT_SECRET=${{ secrets.JWT_SECRET }}
MY_NEW_VAR=${{ secrets.MY_NEW_VAR }}    # ← добавьте здесь
ENVEOF
```

3. Используйте в `server.js`:

```javascript
const myVar = process.env.MY_NEW_VAR;
```

## Полезные команды

### Мониторинг на сервере

```bash
# Статус сервиса
sudo systemctl status pulse-messenger

# Логи в реальном времени
sudo journalctl -u pulse-messenger -f

# Последние 100 строк логов
sudo journalctl -u pulse-messenger -n 100

# Ручной перезапуск
sudo systemctl restart pulse-messenger
```

### Откат

```bash
# На GitHub: Actions → выберите успешный прошлый workflow → Re-run all jobs
# Или через git:
git revert HEAD
git push origin main
```

## Рекомендации по безопасности

1. **Создайте отдельного пользователя** для деплоя (не используйте root):
   ```bash
   sudo adduser deploy
   sudo usermod -aG sudo deploy
   ```

2. **Ограничьте sudo** для systemctl:
   ```bash
   sudo visudo
   # Добавьте:
   deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart pulse-messenger, /bin/systemctl status pulse-messenger, /bin/systemctl daemon-reload, /bin/systemctl enable pulse-messenger, /usr/bin/tee /etc/systemd/system/pulse-messenger.service, /usr/sbin/nginx, /bin/systemctl reload nginx, /usr/bin/certbot
   ```

3. **Отключите вход по паролю** на сервере:
   ```bash
   sudo nano /etc/ssh/sshd_config
   # PasswordAuthentication no
   sudo systemctl restart sshd
   ```
