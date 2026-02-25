# ROADMAP.md — План работ STSphera

## Статус: что готово ✅

### Инфраструктура
- ✅ Monorepo `ai_integrations` (gpr_bot/ + mini-app/ + mini-app-v2/)
- ✅ DigitalOcean droplet: Docker Compose (bot + api + redis + minio + scheduler)
- ✅ Volume mounts для hot-reload кода без rebuild
- ✅ Cloudflare quick tunnel + nginx (SPA + API proxy)
- ✅ GitHub CI: push to main

### Бот (@Smrbotai_bot)
- ✅ aiogram 3, 11 хендлеров, 8 команд
- ✅ RBAC: 17 ролей, 30+ permissions, ObjectRole
- ✅ /fact — фотофиксация план/факт (MinIO)
- ✅ /newtask, /newobject — FSM создание
- ✅ /viewas — просмотр меню любой роли
- ✅ Architectural Cinema стиль сообщений

### FastAPI (43 endpoints)
- ✅ Auth: Telegram initData → JWT
- ✅ Dashboard с production-метриками (модули, кронштейны, KPI)
- ✅ Objects CRUD + wizard создания
- ✅ Tasks: CRUD, статусы, комментарии
- ✅ GPR: просмотр, подписание, шаблоны
- ✅ Supply: заказы по объекту
- ✅ Construction: этапы + чек-листы
- ✅ Documents: по объекту с фильтрацией
- ✅ Notifications: центр уведомлений, inline actions, эскалации
- ✅ Profile: KPI, задачи, согласования, активность, настройки
- ✅ Production: план/факт, бригады, виды работ, floor-volumes, GPR-weekly
- ✅ Excel: импорт/экспорт
- ✅ Analytics: сводка + AI-запросы
- ✅ Org structure
- ✅ File upload

### Mini App v2 (React)
- ✅ Feature-based архитектура (Vite + React 18 + TS + Tailwind)
- ✅ Telegram theme variables, PWA
- ✅ Dashboard: KPI + production прогресс + объекты
- ✅ ObjectPage: 5 табов (ГПР, Задачи, Монтаж, Поставки, Документы)
- ✅ ProfilePage: 4 таба (Профиль, Задачи, Активность, Настройки)
- ✅ NotificationCenter: категории, приоритеты, inline actions, эскалации
- ✅ Дизайн-система "Architectural Cinema"

### БД (27 таблиц)
- ✅ Core: users, objects, object_roles, tasks, gprs, gpr_items, gpr_signatures
- ✅ Production: floor_volumes (428), daily_plan_fact (201), daily_progress (90), crews (7), work_types (10), gpr_weekly (125)
- ✅ Пустые (готовы к наполнению): supply_orders, construction_stages, checklist_items, documents, notifications, bom_items, materials, production_plan, element_status, warehouse, shipments, zones

---

## Фаза 5 — Наполнение и интеграции

### 5.1 Наполнение данными (приоритет 1) ✅
- [x] Seed-скрипт: 15 tasks, 10 supply, 8 stages, 12 docs, 8 notifs
- [x] Seed production chain: 6 zones, 33 BOM, 10 materials, 3 shipments
- [x] Все экраны Mini App работают с реальными данными
- [ ] Заполнить fact-данные через /fact (прорабы на объекте)

### 5.2 Постоянный HTTPS (приоритет 2)
- [ ] Купить домен или использовать Lovable deploy
- [ ] Certbot + nginx вместо quick tunnel
- [ ] Стабильный setChatMenuButton URL

### 5.3 Производственная цепочка (приоритет 3) ✅
- [x] API: zones, BOM, materials, warehouse, shipments (5 endpoints)
- [x] UI: ProductionChainTab с 4 подтабами
- [x] Seed данные для всех таблиц
- [ ] UI: element_status (трекинг элементов по стадиям)
- [ ] UI: production_plan (план производства по цехам)

### 5.4 Чаты задач через TG (приоритет 4) 🔄
- [x] Deep links из бота в Mini App (объекты, задачи, ГПР, поставки, монтаж, производство)
- [x] Push-уведомления с deep link кнопками
- [x] Динамический tunnel URL в кнопках бота
- [x] Парсинг ?tab= query param в Mini App
- [ ] Привязка TG-чата к объекту/задаче
- [ ] Уведомления в чат при смене статуса

### 5.5 Интеграции (приоритет 5)
- [ ] ANTHROPIC_API_KEY на дроплет (Claude analytics)
- [ ] Push-уведомления через Telegram
- [ ] Google Sheets экспорт/импорт (когда карта готова)
- [ ] Синхронизация с 1С через REST API

### 5.6 AI-чат с контекстом проекта (приоритет 6)
- [ ] Edge Function ai-chat с контекстом объекта
- [ ] История сообщений
- [ ] Роль-зависимые подсказки

---

## Технический долг
- [ ] Supabase anon key ротация (утёк в git history)
- [ ] Унифицировать БД: подключить gpr_bot к Supabase PostgreSQL (или наоборот)
- [ ] Тесты: API endpoints, RBAC, auth
- [ ] CI/CD: auto-deploy on push
