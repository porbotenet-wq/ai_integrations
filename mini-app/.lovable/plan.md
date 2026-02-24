

# Фаза 4 — Новые модули STSphera

Четыре модуля, реализуемые по порядку: Карточки проектов, Профиль + Команда, Контекстное меню, Чаты задач.

---

## Модуль 2: Карточки проектов с hero-image (первый в очереди)

### БД: миграция
- Добавить `cover_image_url TEXT` в таблицу `projects`

### Компонент `src/components/ProjectList.tsx` -- полная переработка
- Вертикальный скролл hero-карточек вместо простых кнопок
- Каждая карточка:
  - Hero image (cover_image_url или placeholder gradient) 200px, rounded-2xl, object-cover
  - Gradient overlay снизу: `bg-gradient-to-t from-[hsl(var(--bg0)/0.9)] to-transparent`
  - На overlay: название (16px bold white), город + статус badge
  - Mini KPI row: 3 числа (прогресс %, алертов, бригад) -- подгружаются отдельным запросом
  - Progress bar 2px внизу
  - LED-полоска сверху по статусу (green=active, amber=paused, red=critical alerts, blue=draft)
- Floating FAB "+" кнопка справа внизу (fixed bottom-20 right-4)
- Шапка: аватар пользователя + имя + кнопка выхода
- Стиль MONOLITH v3.0 (bg-bg0, bg-bg1, text-t1/t2/t3, stagger-item)

### Доп. запросы для KPI
- Для каждого проекта: alerts count, crews count, plan_fact progress %
- Кэшировать в state, не блокировать рендер карточек

---

## Модуль 1: Профиль сотрудника + Команда объекта

### БД: миграция
- Добавить в `profiles`: `phone TEXT`, `email TEXT`, `position TEXT`, `avatar_url TEXT`, `last_active_at TIMESTAMPTZ DEFAULT now()`

### Новый компонент `src/components/UserProfile.tsx`
- Экран "Мой профиль":
  - Аватар 72px rounded-2xl (из avatar_url или initials fallback)
  - ФИО, должность, телефон, email
  - Роль на текущем объекте (badge с LED-цветом по роли из roleConfig)
  - Список объектов пользователя (через user_roles + projects join, или все projects)
  - Статистика: кол-во daily_logs, фото (photo_urls count)
  - Кнопка "Редактировать" -- inline edit ФИО, телефон, avatar_url
- Стиль MONOLITH v3.0

### Новый компонент `src/components/ProjectTeam.tsx`
- Экран "Команда объекта":
  - Загрузка всех user_roles + profiles для проекта (через crews.foreman_user_id и общий user_roles)
  - Группировка по ролям: Руководство (director, pm) -> Инженеры (opr, km, kmd) -> Прорабы (foreman1-3) -> Снабжение (supply) -> ПТО (pto) -> Технадзор (inspector, production)
  - Каждый: аватар, ФИО, роль badge, online dot (last_active_at < 15 мин = green)
  - Тап -> модальное окно профиля + кнопка "Написать в TG" (deep link t.me/username)
  - Поиск по имени (фильтр в state)
- Стиль MONOLITH v3.0

### Интеграция
- Новые вкладки "profile" и "team" в MoreDrawer и renderTab в Index.tsx
- ProfileSettings заменить на полноценный UserProfile

---

## Модуль 4: Контекстное меню объекта

### Новый компонент `src/components/ProjectContextMenu.tsx`
- Вызывается при первом входе в проект (или через свайп/кнопку)
- Шапка: cover_image_url + overlay с названием + progress bar
- Секция "Команда": горизонтальный скролл аватаров (из ProjectTeam данных)
- Секция "Инструменты" (по роли через detectPrimaryRole):
  - Foreman: Фотоотчёт, Дневной отчёт, Мои этажи, Алерты
  - PM: Согласования, ГПР, Бригады, Снабжение, Документы
  - Director: Портфель, KPI, Финансы, Критичное
  - Supply: Заказы, Дефицит, Входящие, Документы
- Секция "Общее": Календарь, Документы, Настройки
- Секция "Обсуждения": список project_chats с deep links
- Каждая кнопка: иконка в dim-контейнере + title + sub, active:scale-[0.97]
- Реализация: Sheet (bottom drawer) или отдельная страница

### Интеграция
- Кнопка в TopBar для открытия контекстного меню
- Или автоматическое открытие при выборе проекта

---

## Модуль 3: Чаты задач (TG интеграция)

### БД: миграция
- Расширить `project_chats`:
  - Добавить `chat_type TEXT DEFAULT 'general'` (general/task/alert)
  - Добавить `reference_id UUID` (ссылка на task/alert)
  - Добавить `telegram_chat_id TEXT` (ID чата в TG)
  - Добавить `last_message TEXT`
  - Добавить `last_message_at TIMESTAMPTZ`
  - Добавить `unread_count INTEGER DEFAULT 0`
  - Добавить `created_by UUID`

### Новый компонент `src/components/TaskChats.tsx`
- Список активных обсуждений для проекта
- Каждый чат: title, last_message preview, badge непрочитанных, timestamp
- Тап -> deep link `tg://resolve?domain=...` или `https://t.me/c/...`
- Фильтр: Все / Задачи / Алерты

### Кнопка "Обсудить в TG" в карточках задач/алертов
- В компонентах Alerts.tsx и Workflow.tsx -- добавить кнопку
- При нажатии: вызов edge function `telegram-manage` для создания группы
- Бот добавляет участников по ролям задачи

### Edge function `telegram-manage` (уже существует -- расширить)
- Новый action: `create_task_chat`
- Создает TG-группу через Bot API `createChat`
- Записывает в project_chats
- Возвращает deep link

---

## Итого файлов

| Действие | Файл |
|---|---|
| Миграция | profiles: +phone, email, position, avatar_url, last_active_at |
| Миграция | projects: +cover_image_url |
| Миграция | project_chats: +chat_type, reference_id, telegram_chat_id, last_message, last_message_at, unread_count, created_by |
| Переписать | `src/components/ProjectList.tsx` |
| Создать | `src/components/UserProfile.tsx` |
| Создать | `src/components/ProjectTeam.tsx` |
| Создать | `src/components/ProjectContextMenu.tsx` |
| Создать | `src/components/TaskChats.tsx` |
| Редактировать | `src/pages/Index.tsx` (новые вкладки) |
| Редактировать | `src/components/MoreDrawer.tsx` (новые пункты) |
| Редактировать | `src/components/TopBar.tsx` (кнопка контекстного меню) |
| Редактировать | `src/components/Alerts.tsx` (кнопка "Обсудить в TG") |
| Редактировать | `supabase/functions/telegram-manage/index.ts` (create_task_chat) |

## Порядок реализации

1. Миграции БД (все 3 сразу)
2. Модуль 2 -- ProjectList с hero-карточками
3. Модуль 1 -- UserProfile + ProjectTeam
4. Модуль 4 -- ProjectContextMenu
5. Модуль 3 -- TaskChats + edge function

## Ограничения
- RLS на новых полях profiles -- уже покрыто существующими policies (user own data)
- project_chats -- уже имеет RLS policies
- Все визуалы в MONOLITH v3.0
- Не ломаем существующую навигацию и логику

