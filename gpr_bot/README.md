# GPR Bot — Управление графиком производства работ

Telegram-бот для управления строительными проектами (фасадные системы). Координация 8+ отделов: договорной → проектный → снабжение → производство → монтаж → ПТО.

## Архитектура

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│ Telegram Bot │────▶│  PostgreSQL  │◀────│   FastAPI    │
│  (aiogram 3) │     │             │     │  (Mini App)  │
└──────┬──────┘     └──────┬──────┘     └──────┬───────┘
       │                   │                    │
       ▼                   ▼                    ▼
┌──────────────┐   ┌──────────────┐    ┌──────────────┐
│   Scheduler  │   │    Redis     │    │    MinIO      │
│ (APScheduler)│   │   (cache)    │    │   (S3 files)  │
└──────────────┘   └──────────────┘    └──────────────┘
```

## Быстрый старт

### 1. Клонирование и настройка

```bash
cp .env.example .env
# Отредактируйте .env: укажите BOT_TOKEN и ADMIN_TELEGRAM_IDS
```

### 2. Запуск через Docker Compose

```bash
docker-compose up -d
```

Это поднимет:
- PostgreSQL (порт 5432)
- Redis (порт 6379)
- MinIO (порты 9000, 9001)
- Bot (Telegram polling)
- API (порт 8000)
- Scheduler (cron-задачи)

### 3. Первый запуск

1. Напишите боту `/start` из аккаунта, чей Telegram ID указан в `ADMIN_TELEGRAM_IDS`
2. Вы автоматически получите роль Администратор
3. Другие пользователи — `/start` → регистрация → вы назначаете роль через ⚙️ Админ

## Структура проекта

```
gpr_bot/
├── bot/
│   ├── main.py              # Entry point, dispatcher
│   ├── config.py             # Settings (pydantic-settings)
│   ├── db/models.py          # SQLAlchemy models (14 таблиц)
│   ├── db/session.py         # Async engine & sessions
│   ├── rbac/permissions.py   # RBAC: 30+ permissions, 13 roles
│   ├── handlers/
│   │   ├── start.py          # /start, регистрация
│   │   ├── objects.py        # Объекты: список, детали, команда
│   │   ├── tasks.py          # Задачи: выполнение, блокировка, комменты
│   │   ├── gpr.py            # ГПР: создание, подписание
│   │   ├── supply.py         # Поставки: согласование, отгрузка
│   │   ├── construction.py   # Монтаж: этапы, чеклисты, сдача
│   │   ├── notifications.py  # Уведомления
│   │   └── admin.py          # Управление пользователями
│   ├── keyboards/            # Inline & Reply клавиатуры
│   ├── services/             # Бизнес-логика
│   ├── middlewares/           # Auth + Throttling
│   ├── states/forms.py       # FSM для многошаговых форм
│   └── utils/                # Callbacks, форматирование
├── api/main.py               # FastAPI для Mini App
├── scheduler/tasks.py        # Проверка дедлайнов, дайджесты
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

## Роли (RBAC)

| Роль | Описание |
|------|----------|
| admin | Полный доступ |
| project_manager | Руководитель проекта — центр координации |
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
| viewer | Наблюдатель |

## API Endpoints (для Mini App)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/gpr/{object_id}` | Полная таблица ГПР |
| GET | `/api/dashboard` | Сводка план/факт |
| GET | `/api/objects/{id}/tasks` | Задачи объекта |
| GET | `/api/objects/{id}/construction` | Этапы монтажа |
| GET | `/health` | Health check |

## Деплой на DigitalOcean ($200 credit)

### Вариант 1: App Platform
```bash
doctl apps create --spec .do/app.yaml
```

### Вариант 2: Droplet + Docker
```bash
# Создать Droplet (2GB RAM minimum)
ssh root@your-droplet
apt update && apt install docker.io docker-compose -y
git clone your-repo
cd gpr_bot
cp .env.example .env
nano .env  # настроить
docker-compose up -d
```

## Scheduler

Автоматические проверки:
- **Каждый час**: поиск просроченных задач → OVERDUE + push
- **Каждые 2 часа**: проверка задержанных поставок → DELAYED + push
- **Ежедневно (9:00)**: утренний дайджест руководителям

## Расширение

- **Mini App**: React-приложение для ГПР-таблицы и Ганта (отдельный репозиторий)
- **1С интеграция**: через REST API FastAPI → HTTP-сервис 1С
- **WhatsApp**: дублирование критических уведомлений через Business API
