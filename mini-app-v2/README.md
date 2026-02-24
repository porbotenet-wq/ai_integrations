# ГПР Mini App — Telegram Mini App для управления фасадным строительством

> AI-Driven Facade ERP, созданная Алексеем

Telegram Mini App для управления строительно-монтажными проектами (СМР) в области фасадного строительства. Интегрируется с существующим Telegram-ботом ГПР и FastAPI-бэкендом.

## Архитектура

```
┌─────────────┐      initData       ┌──────────────┐     REST/JSON    ┌──────────────┐
│  Telegram    │ ──────────────────▶ │  Mini App    │ ──────────────▶ │  FastAPI     │
│  WebView     │ ◀─── sendData ──── │  React + TS  │ ◀────────────── │  Backend     │
└─────────────┘                     └──────────────┘                 └──────┬───────┘
                                                                            │
                                    ┌──────────────┐                 ┌──────▼───────┐
                                    │  MinIO (S3)  │◀────────────── │  PostgreSQL  │
                                    │  Документы   │                 │  + Redis     │
                                    └──────────────┘                 └──────────────┘
```

## Стек

| Компонент | Технология |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + Telegram Theme Variables |
| State | TanStack Query + Zustand |
| Backend | FastAPI (Python) + SQLAlchemy |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | MinIO (S3-compatible) |
| Auth | Telegram WebApp initData (HMAC-SHA256) |

## Модули

| Экран | Описание |
|-------|----------|
| Dashboard | KPI-карточки + список объектов с прогрессом |
| Объект | Карточка с вкладками: ГПР / Задачи / Монтаж / Поставки / Документы |
| ГПР | Табличный просмотр с фильтрами по отделам, подписание |
| Задачи | Список с фильтрацией, смена статусов (state machine) |
| Монтаж | Этапы с чек-листами, прогресс-баром |
| Поставки | Статусы, фильтры, метрики задержек |
| Документы | Категории (КМД, АОСР, М-15...), поиск |
| Профиль | Роль, контакты, объекты, права |

## Быстрый старт

```bash
# 1. Клонировать
cd mini-app

# 2. Установить зависимости
npm install

# 3. Настроить окружение
cp .env.example .env

# 4. Запустить dev-сервер (с прокси на API)
npm run dev
# → http://localhost:3000

# 5. Для dev-режима без Telegram, используйте:
# ?dev_user_id=<telegram_id> в URL
```

## Docker

Добавить в основной `docker-compose.yml`:

```yaml
webapp:
  build:
    context: ./mini-app
  ports:
    - "3000:80"
  depends_on:
    - api
```

## RBAC (13 ролей)

admin, project_manager, design_head, designer_opr, designer_km, designer_kmd, supply, production, construction_itr, safety, pto, contract, viewer

Каждая роль видит только свои данные и имеет ограниченный набор действий. Проверка прав — серверная (FastAPI middleware).

## Структура

```
src/
├── app/           — App shell, роутинг, провайдеры
├── shared/
│   ├── api/       — HTTP-клиент, типы, React Query хуки
│   ├── hooks/     — Zustand store
│   └── lib/       — Утилиты (даты, статусы, цвета)
├── features/
│   ├── dashboard/ — Главный экран
│   ├── object/    — Карточка объекта
│   ├── gpr/       — Таблица ГПР
│   ├── tasks/     — Задачи
│   ├── construction/ — Этапы монтажа
│   ├── supply/    — Поставки
│   ├── documents/ — Документы
│   └── profile/   — Профиль
└── main.tsx
```

## Backend расширения (api_extensions.py)

Файл `api_extensions.py` содержит все дополнительные API-эндпоинты для Mini App:

- `GET /api/profile` — профиль текущего пользователя
- `GET /api/objects` — список объектов (с RBAC-фильтрацией)
- `GET /api/objects/:id` — детали объекта
- `PATCH /api/tasks/:id/status` — смена статуса задачи + audit_log
- `POST /api/objects/:id/tasks` — создание задачи
- `POST /api/tasks/:id/comments` — комментарий к задаче
- `GET /api/tasks/:id` — детали задачи
- `POST /api/gpr/:id/sign` — подписание ГПР
- `GET /api/objects/:id/supply` — поставки
- `GET /api/objects/:id/documents` — документы
- `POST /api/construction/checklist/:id/toggle` — чек-лист
- `GET /api/notifications` — уведомления

Подключение:
```python
from api_extensions import register_miniapp_routes
register_miniapp_routes(app)
```

## Дорожная карта

### 0–30 дней (MVP)
- [x] Архитектура и стек
- [x] Dashboard + Object + GPR + Tasks + Supply + Documents + Profile
- [ ] Telegram initData проверка (production)
- [ ] Деплой на DigitalOcean ($200 кредит)

### 30–90 дней
- [ ] Диаграмма Ганта (ГПР)
- [ ] Офлайн PWA + sync
- [ ] Форма план-факта с фотофиксацией
- [ ] QR-сканер для элементов фасада
- [ ] Интеграция с 1С (REST)

## Лицензия

Проприетарное ПО. © Алексей, 2025.
