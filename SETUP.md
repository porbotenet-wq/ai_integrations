# STSphera — Инструкция по настройке и деплою

## 1. Требования

- Docker + Docker Compose
- Git
- Telegram Bot Token (от @BotFather)
- Supabase проект (PostgreSQL)

## 2. Клонирование

```bash
git clone https://github.com/porbotenet-wq/ai_integrations.git
cd ai_integrations/gpr_bot
```

## 3. Настройка .env

```bash
cp .env.example .env
nano .env
```

Обязательные параметры:

| Параметр | Описание | Пример |
|---|---|---|
| BOT_TOKEN | Токен от BotFather | 123456:ABC... |
| DATABASE_URL | Supabase PostgreSQL (asyncpg) | postgresql+asyncpg://postgres.REF:PASS@aws-1-us-east-1.pooler.supabase.com:5432/postgres |
| DATABASE_URL_SYNC | Supabase PostgreSQL (sync) | postgresql://postgres.REF:PASS@aws-1-us-east-1.pooler.supabase.com:5432/postgres |
| ADMIN_TELEGRAM_IDS | Telegram ID администраторов | 123456789 |

Опциональные:

| Параметр | По умолчанию | Описание |
|---|---|---|
| WEBAPP_URL | — | URL Mini App |
| REDIS_URL | redis://redis:6379/0 | Redis |
| S3_ENDPOINT | http://minio:9000 | MinIO endpoint |
| API_SECRET_KEY | change-me | Секрет для JWT |
| DIGEST_HOUR | 9 | Час утреннего дайджеста |

## 4. Запуск

```bash
docker compose up -d
```

Сервисы:
- **bot** — Telegram бот (aiogram 3, polling)
- **api** — FastAPI REST API (порт 8000)
- **scheduler** — APScheduler (дедлайны, дайджесты)
- **redis** — Кэш, throttling
- **minio** — S3-хранилище документов (порты 9000, 9001)

## 5. Проверка

```bash
# Статус контейнеров
docker compose ps

# Логи бота
docker compose logs bot --tail 30

# Health check API
curl http://localhost:8000/health
```

## 6. Первый запуск

1. Напишите боту `/start` с аккаунта, чей ID указан в `ADMIN_TELEGRAM_IDS`
2. Вы автоматически получите роль Администратор
3. Другие пользователи: `/start` → регистрация → вы назначаете роль через `/admin`

## 7. Команды бота

| Команда | Описание | Доступ |
|---|---|---|
| /start | Главное меню | Все |
| /admin | Админ-панель | admin |
| /viewas | Просмотр меню от лица роли | admin |
| /newobject | Создать объект | admin, project_manager, contract |

## 8. Роли (RBAC)

17 ролей, 30+ разрешений:

| Роль | Описание |
|---|---|
| admin | Полный доступ |
| director | Генеральный директор |
| curator | Куратор |
| project_manager | Руководитель проекта |
| design_head | Рук. проектного отдела |
| designer_opr | Конструктор ОПР |
| designer_km | Конструктор КМ |
| designer_kmd | Конструктор КМД |
| supply | Отдел снабжения |
| production | Производственный отдел |
| construction_itr | ИТР / Прораб |
| safety | Охрана труда |
| pto | Отдел ПТО |
| contract | Договорной отдел |
| geodesist | Геодезист |
| installer | Монтажник |
| viewer | Наблюдатель |

## 9. База данных

22 таблицы в Supabase PostgreSQL:

**Core:** users, objects, object_roles, gprs, gpr_items, gpr_signatures, tasks, task_comments, supply_orders, construction_stages, checklist_items, documents, notifications, audit_log

**Production (Excel):** zones, bom_items, materials, production_plan, element_status, warehouse, shipments, daily_plan_fact

## 10. Обновление

```bash
cd /opt/ai_integrations
git pull origin main
cd gpr_bot
docker compose build --no-cache bot api scheduler
docker compose up -d
```

## 11. Firewall (UFW)

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8000/tcp  # API
```

## 12. Мониторинг

```bash
# Логи всех сервисов
docker compose logs -f

# Перезапуск бота
docker compose restart bot

# Полный рестарт
docker compose down && docker compose up -d
```
