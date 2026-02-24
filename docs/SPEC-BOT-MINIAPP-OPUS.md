# Пакет файлов и рабочие связки для бота и мини‑аппа с Claude Opus 4.6

## Executive summary

Запрос интерпретирован как подготовка «скелета репозитория» и набора готовых файлов/шаблонов, которые можно напрямую использовать для разработки бота и мини‑аппа, где LLM‑ядро — **Claude Opus 4.6** (model id `claude-opus-4-6`) через API. citeturn5search0turn6search0  
В качестве целевой платформы для «бот + мини‑апп» по умолчанию принят **entity["company","Telegram","messaging platform"]** (ботовые обновления через webhook/polling + Mini Apps/WebApp). Это соответствует терминам webhook/polling и «мини‑апп» в экосистеме Telegram. citeturn9view0turn9view4turn13view0  
В отчёте даны: (а) список необходимых файлов и структура, (б) подробный пошаговый markdown‑гайд, (в) готовые примеры конфигов/manifest’ов/`package.json`/Docker/K8s/GitHub Actions, (г) эталонные «рабочие связки» (webhook, polling, OAuth, storage, messaging, push), (д) практики отладки/логирования/тестирования/безопасности, (е) сравнения вариантов и чек‑лист выхода в прод. citeturn6search0turn6search3turn9view1turn11view0  
Точка опоры по Opus 4.6: обязательные заголовки API (`x-api-key`, `anthropic-version`, `content-type`) и то, что SDK отправляет их автоматически; Messages API статeless; для снижения стоимости и роста пропускной способности включаем prompt caching; для стабильной интеграции используем structured outputs (JSON schema/strict tool use). citeturn6search0turn5search0turn5search2turn6search2  

## Контекст и допущения

**Что такое “Opus 4.6” в этом отчёте.** Под “Opus 4.6” принят **Claude Opus 4.6** через API платформы entity["company","Anthropic","ai company"]: в примерах используется `model: "claude-opus-4-6"` и Messages API (`POST /v1/messages`). citeturn5search0turn6search0turn8view0turn5search1  

**Платформа “бот + мини‑апп”.** Пользователь не указал конкретную платформу. По умолчанию выбран Telegram, потому что:  
- в Telegram Bot API прямо описаны webhook и getUpdates (polling) как два взаимно исключающих способа получения обновлений; также указано хранение апдейтов до 24 часов; citeturn9view0turn9view1  
- Telegram Mini Apps/WebApp описывают механизм запуска мини‑аппа и отправку данных обратно в бота через `Telegram.WebApp.sendData`; citeturn9view4turn9view2  
- Telegram Mini Apps/Web events включают события и запросы прав (например, запрос разрешения на отправку сообщений `web_app_request_write_access`). citeturn13view0  

**Хостинг/инфра.** Ограничений не задано — поэтому артефакты даны в “cloud‑agnostic” виде: Docker + опционально Kubernetes, плюс GitHub Actions для CI/CD. Рекомендации по безопасным REST‑endpoint’ам (обязательный HTTPS) опираются на практики entity["organization","OWASP","security foundation"]. citeturn11view0turn10view3  

**Границы ответственности.**  
- “Мини‑апп” — это WebApp в Telegram (встроенный веб‑клиент). Нативные мобильные приложения (iOS/Android) не рассматриваются. citeturn9view2turn13view0  
- OAuth описан как интеграционный сценарий для подключения внешних сервисов (например, CRM/ERP/SSO) по стандарту OAuth 2.0 и PKCE по RFC. citeturn10view1turn10view2  

## Структура репозитория и список файлов

Ниже — минимально‑достаточная структура монорепозитория, включающая **оба** языка бота (Node.js и Python) и **оба** фронтенда мини‑аппа (React и Vue). Это сделано намеренно (по требованию “дать оба”), но в реальном проекте обычно выбирают **одну** реализацию бэкенда и **один** фронтенд.

**Рекомендуемое дерево:**
```text
repo/
  README.md
  .env.example
  config/
    app.config.yaml
    app.config.json
  docs/
    OPUS46_TELEGRAM_BOT_MINIAPP_GUIDE.md
    RUNBOOK_DEBUG.md
  services/
    bot-node/
      package.json
      Dockerfile
      src/
        index.ts
        telegram.ts
        opus.ts
        miniapp-auth.ts
    bot-python/
      requirements.txt
      Dockerfile
      app.py
      telegram_bot.py
      opus.py
      miniapp_auth.py
  miniapp/
    react/
      package.json
      vite.config.ts
      public/manifest.webmanifest
      index.html
      src/
        main.tsx
        App.tsx
        telegram.ts
    vue/
      package.json
      vite.config.ts
      public/manifest.webmanifest
      index.html
      src/
        main.ts
        App.vue
        telegram.ts
  infra/
    docker-compose.yml
    k8s/
      namespace.yaml
      configmap.yaml
      secret.example.yaml
      deployment.yaml
      service.yaml
      ingress.yaml
  .github/
    workflows/
      ci-node.yml
      ci-python.yml
      build-and-push-docker.yml
```

**Список необходимых файлов (в логике “что обязательно для запуска”):**

| Группа | Файл | Назначение | Обязателен |
|---|---|---:|:---:|
| Документация | `docs/OPUS46_TELEGRAM_BOT_MINIAPP_GUIDE.md` | пошаговая инструкция (SDK, авторизация, структура, события, права, деплой) | да |
| Документация | `docs/RUNBOOK_DEBUG.md` | runbook по отладке/логам/типовым инцидентам | да |
| Конфигурация | `.env.example` | шаблон переменных окружения (секреты не коммитить) | да |
| Конфигурация | `config/app.config.yaml` + `config/app.config.json` | пример конфигов (двойной формат) | да |
| Бот+API (Node) | `services/bot-node/src/index.ts` | webhook/polling обработчик + вызов Opus 4.6 | один из двух |
| Бот+API (Python) | `services/bot-python/app.py` | webhook/polling обработчик + вызов Opus 4.6 | один из двух |
| Мини‑апп (React) | `miniapp/react/src/App.tsx` | UI + интеграция с Telegram WebApp API | один из двух |
| Мини‑апп (Vue) | `miniapp/vue/src/App.vue` | UI + интеграция с Telegram WebApp API | один из двух |
| CI/CD | `.github/workflows/*` | CI тесты + сборка/публикация Docker image | да (для проду) |
| Контейнеризация | `Dockerfile`(ы) | воспроизводимая сборка/деплой | да (для проду) |
| Оркестрация | `infra/k8s/*` | пример деплоя в Kubernetes | опционально |

**Почему именно так.**  
- Для Claude/Opus 4.6 критично централизовать API‑вызов на сервере (не в браузере), т.к. API key должен оставаться секретом; TypeScript SDK прямо предупреждает, что браузерный режим отключён по умолчанию, чтобы не “светить” секреты, и требует явного `dangerouslyAllowBrowser`. citeturn5search1turn10view3  
- Для Telegram webhook важно иметь серверный endpoint и (в прод‑режиме) проверять `secret_token` из заголовка `X-Telegram-Bot-Api-Secret-Token`, чтобы гарантировать, что запрос пришёл от Telegram, а не от атакующего. citeturn9view1  

## Пошаговый markdown‑гайд для Opus 4.6

Ниже — **готовый файл** `docs/OPUS46_TELEGRAM_BOT_MINIAPP_GUIDE.md` (вставляйте целиком в репозиторий). Факты про обязательные заголовки Claude API, stateless‑характер Messages API, prompt caching, structured outputs, Telegram webhook/polling, Mini Apps initData и секретный webhook‑токен соответствуют официальной документации. citeturn6search0turn5search0turn5search2turn9view0turn9view1turn9view2turn12view0  

```md
# docs/OPUS46_TELEGRAM_BOT_MINIAPP_GUIDE.md

## Цель
Собрать production‑friendly каркас:
1) Telegram bot (webhook или polling),
2) Telegram Mini App (WebApp) на React или Vue,
3) Backend API, который:
   - валидирует initData WebApp (серверная аутентификация),
   - вызывает Claude Opus 4.6 через Anthropic Messages API,
   - хранит историю (минимум: in-memory; прод: Redis/Postgres),
4) CI/CD: Docker + GitHub Actions + (опционально) Kubernetes.

## Предварительные требования
- Домен + HTTPS (для webhook и для WebApp URL).
- Telegram bot token (через @BotFather).
- Anthropic API key (Console).
- Выбор реализации backend:
  A) Node.js (TypeScript) — services/bot-node/
  B) Python (FastAPI) — services/bot-python/
- Выбор miniapp frontend:
  A) React (Vite) — miniapp/react/
  B) Vue (Vite) — miniapp/vue/

## Шаг 1. Получить ключи и включить базовую авторизацию

### 1.1 Anthropic (Claude Opus 4.6)
1) Создайте API key в Console.
2) Экспортируйте переменную окружения:
   export ANTHROPIC_API_KEY="***"

Пример вызова Messages API (curl):
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-opus-4-6",
    "max_tokens": 512,
    "messages": [{"role":"user","content":"Привет!"}]
  }'

Ключевые правила:
- Messages API stateless: историю диалога хранит и отправляет ваш сервер.
- Для стабильного JSON/контрактов используйте structured outputs (JSON schema) или strict tool use.
- Для длинных “статичных” префиксов (system prompt, инструменты, контекст) — включайте prompt caching.

### 1.2 Telegram bot token и режим получения апдейтов
У Telegram два взаимоисключающих режима:
- polling: getUpdates
- webhook: setWebhook

В проде рекомендуется webhook.

#### 1.2.1 Webhook: установить URL и secret_token
1) Сгенерируйте случайный секрет (32+ символа).
2) Установите webhook (пример через curl):
curl "https://api.telegram.org/bot$TG_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR_DOMAIN/telegram/webhook" \
  -d "secret_token=$TG_WEBHOOK_SECRET"

На сервере проверяйте заголовок:
X-Telegram-Bot-Api-Secret-Token == TG_WEBHOOK_SECRET

#### 1.2.2 Polling: запуск без публичного домена (для MVP/локальной отладки)
- Запустите бота в режиме long polling.
- Важно: polling не работает, если активен webhook (и наоборот).

## Шаг 2. Сконфигурировать проект

### 2.1 Переменные окружения (единая схема)
Скопируйте .env.example -> .env и заполните:

ANTHROPIC_API_KEY=
TG_BOT_TOKEN=
TG_WEBHOOK_SECRET=
PUBLIC_BASE_URL=https://YOUR_DOMAIN
MINIAPP_PUBLIC_URL=https://YOUR_DOMAIN/miniapp  (или /miniapp/react, /miniapp/vue)
APP_ENV=dev|prod

# Storage
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://...

### 2.2 Конфиги YAML/JSON
Можно использовать один из вариантов:
- config/app.config.yaml
- config/app.config.json
и на старте приложения выбирать источник.

## Шаг 3. Структура backend и ключевые манифесты

### 3.1 Backend API endpoints (рекомендуемая минимальная поверхность)
- POST /telegram/webhook      (при webhook режиме)
- GET  /healthz               (health check)
- POST /api/miniapp/session   (принимает initData, валидирует подпись, выдает session token)
- POST /api/chat              (чат‑endpoint для miniapp; авторизация по session token)

### 3.2 Telegram Mini App: подключение SDK и события
1) В HTML вставьте:
<script src="https://telegram.org/js/telegram-web-app.js"></script>

2) Используйте window.Telegram.WebApp:
- initData (сырой, для серверной валидации)
- initDataUnsafe (не доверять для критических операций)
- sendData(payload) для отправки данных в бота (4096 bytes, доступно для Mini Apps из Keyboard button)

3) События/прав доступа:
- например, запрос разрешения на отправку сообщений через event web_app_request_write_access.
- ряд системных событий доступен через Telegram Web events API (встроенные механизмы клиента).

## Шаг 4. Валидация initData (обязательно в проде)
Алгоритм: сервер должен проверить подпись initData.
Практический подход:
- frontend отправляет raw initData на /api/miniapp/session
- backend проверяет подпись через HMAC‑SHA256 (WebAppData + bot token), сравнивает с hash
- при успехе выдает session token (JWT или random opaque)

Если initData невалиден — 401.

## Шаг 5. Подключить Opus 4.6 в боте и miniapp
- Для Telegram сообщений: нормализуйте входной текст, сформируйте prompt (system + user).
- Вызов Claude:
  model="claude-opus-4-6"
  messages=[{"role":"user","content": "..."}]
- В проде:
  - добавляйте metadata.user_id (opaque) для анти‑абьюз помощи провайдера.
  - включайте prompt caching на длинных системных инструкциях.

## Шаг 6. Деплой
Вариант A: Docker Compose (MVP/демо)
- infra/docker-compose.yml
- один контейнер backend + redis/postgres (опционально)

Вариант B: Kubernetes (прод)
- infra/k8s/*
- Ingress обязательно на HTTPS
- Secrets только через Secret (или внешний secrets manager)

## Шаг 7. Отладка
- webhook: логируйте request-id/корреляцию, заголовок secret token (только факт совпадения, не значение)
- Telegram update_id используйте для идемпотентности
- Claude: логируйте request-id (из response headers) и usage.tokens
- на 429 используйте retry-after
```

## Готовые примеры файлов

Ниже — **готовые содержимое файлов** (копируйте в репозиторий 1:1). Эти файлы “сшивают” Telegram webhook/polling + Mini Apps + Claude Opus 4.6 Messages API с упором на безопасную работу ключей и на воспроизводимый деплой. Требования API (обязательные заголовки), примеры SDK‑инициализации и вызова `messages.create`, stateless‑модель, prompt caching и structured outputs соответствуют официальным материалам. citeturn6search0turn5search0turn8view0turn5search1turn5search2turn6search2  

```md
# README.md

## Что это
Шаблон репозитория для Telegram Bot + Telegram Mini App (React/Vue) с LLM ядром Claude Opus 4.6.

## Быстрый старт (локально, polling)
1) cp .env.example .env  (заполнить)
2) Запуск Node бэкенда:
   cd services/bot-node
   npm i
   npm run dev
3) Откройте мини‑апп (React) локально:
   cd miniapp/react
   npm i
   npm run dev

## В проде
- webhook (setWebhook) + secret_token
- miniapp URL на HTTPS
- initData validate server-side
- Docker/K8s + GitHub Actions
```

```dotenv
# .env.example

APP_ENV=dev
PUBLIC_BASE_URL=https://example.com

# Anthropic Claude API
ANTHROPIC_API_KEY=replace_me
CLAUDE_MODEL=claude-opus-4-6
CLAUDE_MAX_TOKENS=800

# Telegram bot
TG_BOT_TOKEN=replace_me
TG_WEBHOOK_SECRET=replace_me_long_random
TG_WEBHOOK_PATH=/telegram/webhook

# Mini App
MINIAPP_PUBLIC_URL=https://example.com/miniapp/react

# Storage
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://user:pass@postgres:5432/app

# OAuth (пример интеграции внешнего провайдера)
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=
OAUTH_AUTH_URL=
OAUTH_TOKEN_URL=
OAUTH_REDIRECT_URL=https://example.com/oauth/callback
```

```yaml
# config/app.config.yaml

app:
  env: dev
  publicBaseUrl: "https://example.com"

claude:
  apiKeyEnv: "ANTHROPIC_API_KEY"
  model: "claude-opus-4-6"
  maxTokens: 800
  # Опционально: включать prompt caching для длинных системных инструкций
  promptCaching:
    enabled: true
    ttl: "5m"   # "5m" или "1h"

telegram:
  botTokenEnv: "TG_BOT_TOKEN"
  webhook:
    enabled: false
    path: "/telegram/webhook"
    secretEnv: "TG_WEBHOOK_SECRET"
  polling:
    enabled: true
  miniapp:
    urlEnv: "MINIAPP_PUBLIC_URL"

storage:
  redisUrlEnv: "REDIS_URL"
  databaseUrlEnv: "DATABASE_URL"

oauth:
  enabled: false
  clientIdEnv: "OAUTH_CLIENT_ID"
  clientSecretEnv: "OAUTH_CLIENT_SECRET"
  authUrlEnv: "OAUTH_AUTH_URL"
  tokenUrlEnv: "OAUTH_TOKEN_URL"
  redirectUrlEnv: "OAUTH_REDIRECT_URL"
```

```json
// config/app.config.json
{
  "app": {
    "env": "dev",
    "publicBaseUrl": "https://example.com"
  },
  "claude": {
    "apiKeyEnv": "ANTHROPIC_API_KEY",
    "model": "claude-opus-4-6",
    "maxTokens": 800,
    "promptCaching": { "enabled": true, "ttl": "5m" }
  },
  "telegram": {
    "botTokenEnv": "TG_BOT_TOKEN",
    "webhook": { "enabled": false, "path": "/telegram/webhook", "secretEnv": "TG_WEBHOOK_SECRET" },
    "polling": { "enabled": true },
    "miniapp": { "urlEnv": "MINIAPP_PUBLIC_URL" }
  },
  "storage": {
    "redisUrlEnv": "REDIS_URL",
    "databaseUrlEnv": "DATABASE_URL"
  },
  "oauth": {
    "enabled": false,
    "clientIdEnv": "OAUTH_CLIENT_ID",
    "clientSecretEnv": "OAUTH_CLIENT_SECRET",
    "authUrlEnv": "OAUTH_AUTH_URL",
    "tokenUrlEnv": "OAUTH_TOKEN_URL",
    "redirectUrlEnv": "OAUTH_REDIRECT_URL"
  }
}
```

```ts
// services/bot-node/package.json
{
  "name": "bot-node",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch --loader ts-node/esm src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "node -e \"console.log('lint placeholder')\""
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.0.0",
    "express": "^4.19.2",
    "telegraf": "^4.16.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3"
  }
}
```

```ts
// services/bot-node/src/opus.ts
import Anthropic from "@anthropic-ai/sdk";

export type ClaudeCallInput = {
  userText: string;
  userIdOpaque?: string; // uuid/hash; не PII
  system?: string;
  cacheControl?: { type: "ephemeral"; ttl?: "5m" | "1h" };
};

export async function callOpus46(input: ClaudeCallInput): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");

  const model = process.env["CLAUDE_MODEL"] ?? "claude-opus-4-6";
  const maxTokens = Number(process.env["CLAUDE_MAX_TOKENS"] ?? "800");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    // prompt caching: cache_control на верхнем уровне (автоматическое кэширование)
    ...(input.cacheControl ? { cache_control: input.cacheControl } : {}),
    ...(input.system ? { system: input.system } : {}),
    ...(input.userIdOpaque
      ? { metadata: { user_id: input.userIdOpaque } }
      : {}),
    messages: [{ role: "user", content: input.userText }]
  });

  // content — массив блоков; берем первый text
  const first = message.content?.[0];
  // @ts-ignore: типы SDK могут отличаться по версии; цель — понятный шаблон
  const text = first?.text ?? JSON.stringify(message.content);
  return text;
}
```

```ts
// services/bot-node/src/miniapp-auth.ts
import crypto from "crypto";

/**
 * Серверная валидация Telegram Mini App initData:
 * - вычислить secretKey = HMAC_SHA256(botToken, key="WebAppData")
 * - dataCheckString = отсортированные key=value без hash, склеенные через '\n'
 * - hashCheck = HMAC_SHA256(dataCheckString, key=secretKey).hex
 */
export function verifyTelegramInitData(initDataRaw: string, botToken: string): boolean {
  const decoded = decodeURIComponent(initDataRaw);
  const params = new URLSearchParams(decoded);

  const receivedHash = params.get("hash");
  if (!receivedHash) return false;

  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k === "hash") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort((a, b) => a.localeCompare(b));

  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(receivedHash));
}
```

```ts
// services/bot-node/src/telegram.ts
import { Markup, Telegraf } from "telegraf";
import { callOpus46 } from "./opus.js";

export function buildBot(): Telegraf {
  const token = process.env["TG_BOT_TOKEN"];
  if (!token) throw new Error("TG_BOT_TOKEN is missing");

  const miniappUrl = process.env["MINIAPP_PUBLIC_URL"] ?? "https://example.com/miniapp/react";

  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    await ctx.reply(
      "Готов. Команды: /app — открыть мини‑апп, /help.",
      Markup.keyboard([
        [Markup.button.webApp("Открыть мини‑апп", miniappUrl)]
      ]).resize()
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("Отправьте текст — отвечу, используя Opus 4.6. /app — мини‑апп.");
  });

  bot.command("app", async (ctx) => {
    await ctx.reply(
      "Открываем мини‑апп:",
      Markup.inlineKeyboard([
        Markup.button.webApp("Open", miniappUrl)
      ])
    );
  });

  // Обработка обычного текста
  bot.on("text", async (ctx) => {
    const userText = (ctx.message as any).text as string;

    const system = "Ты корпоративный ассистент. Отвечай кратко, по делу, структурированно.";
    const userIdOpaque = String(ctx.from?.id ?? "anon");

    const answer = await callOpus46({ userText, userIdOpaque, system, cacheControl: { type: "ephemeral", ttl: "5m" } });
    await ctx.reply(answer);
  });

  // Обработка данных из Mini App через sendData (при запуске с KeyboardButton)
  bot.on("message", async (ctx) => {
    const msg: any = ctx.message;
    if (!msg?.web_app_data?.data) return;

    await ctx.reply(`Принято из мини‑аппа: ${msg.web_app_data.data}`);
  });

  return bot;
}
```

```ts
// services/bot-node/src/index.ts
import express from "express";
import { buildBot } from "./telegram.js";
import { verifyTelegramInitData } from "./miniapp-auth.js";
import { callOpus46 } from "./opus.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const bot = buildBot();

const webhookPath = process.env["TG_WEBHOOK_PATH"] ?? "/telegram/webhook";
const webhookSecret = process.env["TG_WEBHOOK_SECRET"] ?? "";
const botToken = process.env["TG_BOT_TOKEN"] ?? "";

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/**
 * Telegram webhook endpoint.
 * ВАЖНО: проверяем X-Telegram-Bot-Api-Secret-Token, если секрет задан.
 */
app.post(webhookPath, async (req, res, next) => {
  if (webhookSecret) {
    const header = req.header("X-Telegram-Bot-Api-Secret-Token");
    if (header !== webhookSecret) {
      return res.status(401).send("unauthorized");
    }
  }
  // Telegraf webhook callback:
  // динамический импорт, чтобы не тянуть лишнее в примере
  const { webhookCallback } = await import("telegraf");
  return webhookCallback(bot, "express")(req, res, next);
});

/**
 * miniapp session: принимает initData, валидирует, возвращает sessionToken.
 * В проде используйте JWT; здесь — простой opaque token.
 */
app.post("/api/miniapp/session", (req, res) => {
  const initData = String(req.body?.initData ?? "");
  if (!initData) return res.status(400).json({ error: "initData required" });

  const ok = verifyTelegramInitData(initData, botToken);
  if (!ok) return res.status(401).json({ error: "invalid initData" });

  // минимальный session token
  const sessionToken = Buffer.from(`${Date.now()}:${Math.random()}`).toString("base64url");
  return res.json({ sessionToken });
});

/**
 * miniapp chat: требует Authorization: Bearer <sessionToken>
 */
app.post("/api/chat", async (req, res) => {
  const auth = req.header("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "missing bearer token" });

  const userText = String(req.body?.text ?? "");
  if (!userText) return res.status(400).json({ error: "text required" });

  const answer = await callOpus46({
    userText,
    system: "Ты ассистент, отвечай кратко и практично.",
    cacheControl: { type: "ephemeral", ttl: "5m" }
  });

  return res.json({ answer });
});

const port = Number(process.env["PORT"] ?? "8080");
app.listen(port, () => {
  console.log(`bot-node listening on :${port}, webhookPath=${webhookPath}`);
});
```

```dockerfile
# services/bot-node/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
CMD ["node", "src/index.ts"]
```

```txt
# services/bot-python/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
python-multipart==0.0.9
anthropic==0.0.0
python-telegram-bot==0.0.0
```

```python
# services/bot-python/opus.py
import os
from anthropic import Anthropic

def call_opus46(user_text: str, user_id_opaque: str | None = None) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is missing")

    model = os.getenv("CLAUDE_MODEL", "claude-opus-4-6")
    max_tokens = int(os.getenv("CLAUDE_MAX_TOKENS", "800"))

    client = Anthropic(api_key=api_key)

    kwargs = {}
    if user_id_opaque:
        kwargs["metadata"] = {"user_id": user_id_opaque}

    message = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": user_text}],
        system="Ты корпоративный ассистент. Отвечай кратко, по делу, структурированно.",
        cache_control={"type": "ephemeral", "ttl": "5m"},
        **kwargs,
    )

    # message.content: список блоков
    block0 = message.content[0]
    return getattr(block0, "text", str(message.content))
```

```python
# services/bot-python/miniapp_auth.py
import hmac
import hashlib
import urllib.parse

def verify_telegram_init_data(init_data_raw: str, bot_token: str) -> bool:
    decoded = urllib.parse.unquote(init_data_raw)
    pairs = decoded.split("&")

    received_hash = None
    kv = []
    for p in pairs:
        if p.startswith("hash="):
            received_hash = p.split("=", 1)[1]
        else:
            kv.append(p)

    if not received_hash:
        return False

    kv.sort()
    data_check_string = "\n".join(kv)

    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    return hmac.compare_digest(computed_hash, received_hash)
```

```python
# services/bot-python/telegram_bot.py
import os
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
from .opus import call_opus46

def build_app() -> Application:
    token = os.getenv("TG_BOT_TOKEN")
    if not token:
        raise RuntimeError("TG_BOT_TOKEN is missing")

    miniapp_url = os.getenv("MINIAPP_PUBLIC_URL", "https://example.com/miniapp/react")

    app = Application.builder().token(token).build()

    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        kb = ReplyKeyboardMarkup(
            [[KeyboardButton("Открыть мини‑апп", web_app=WebAppInfo(url=miniapp_url))]],
            resize_keyboard=True
        )
        await update.message.reply_text("Готов. Напишите текст или /app.", reply_markup=kb)

    async def app_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text("Откройте мини‑апп кнопкой в клавиатуре или по ссылке.")

    async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
        txt = update.message.text
        user_id = str(update.effective_user.id) if update.effective_user else "anon"
        answer = call_opus46(txt, user_id_opaque=user_id)
        await update.message.reply_text(answer)

    async def on_web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
        data = update.message.web_app_data.data
        await update.message.reply_text(f"Принято из мини‑аппа: {data}")

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("app", app_cmd))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, on_web_app_data))

    return app
```

```python
# services/bot-python/app.py
import os
from fastapi import FastAPI, Request, Header
from telegram import Update
from .telegram_bot import build_app
from .miniapp_auth import verify_telegram_init_data
from .opus import call_opus46

app = FastAPI()
tg_app = build_app()

WEBHOOK_PATH = os.getenv("TG_WEBHOOK_PATH", "/telegram/webhook")
WEBHOOK_SECRET = os.getenv("TG_WEBHOOK_SECRET", "")
BOT_TOKEN = os.getenv("TG_BOT_TOKEN", "")

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.post(WEBHOOK_PATH)
async def telegram_webhook(request: Request, x_telegram_bot_api_secret_token: str | None = Header(default=None)):
    if WEBHOOK_SECRET:
        if x_telegram_bot_api_secret_token != WEBHOOK_SECRET:
            return {"error": "unauthorized"}

    payload = await request.json()
    update = Update.de_json(payload, tg_app.bot)
    await tg_app.process_update(update)
    return {"ok": True}

@app.post("/api/miniapp/session")
async def miniapp_session(body: dict):
    init_data = str(body.get("initData", ""))
    if not init_data:
        return {"error": "initData required"}

    ok = verify_telegram_init_data(init_data, BOT_TOKEN)
    if not ok:
        return {"error": "invalid initData"}

    return {"sessionToken": "opaque-demo-token"}

@app.post("/api/chat")
async def chat(body: dict, authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        return {"error": "missing bearer token"}

    text = str(body.get("text", ""))
    if not text:
        return {"error": "text required"}

    answer = call_opus46(text)
    return {"answer": answer}
```

```dockerfile
# services/bot-python/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host=0.0.0.0", "--port=8080"]
```

```json
// miniapp/react/package.json
{
  "name": "miniapp-react",
  "private": true,
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 5173"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.8"
  }
}
```

```ts
// miniapp/react/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./"
});
```

```html
<!-- miniapp/react/index.html -->
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mini App (React)</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```json
// miniapp/react/public/manifest.webmanifest
{
  "name": "Telegram Mini App (React)",
  "short_name": "MiniApp",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#FFFFFF",
  "icons": []
}
```

```ts
// miniapp/react/src/telegram.ts
export function getWebApp() {
  // @ts-ignore
  return window.Telegram?.WebApp;
}
```

```tsx
// miniapp/react/src/App.tsx
import { useEffect, useState } from "react";
import { getWebApp } from "./telegram";

export function App() {
  const tg = getWebApp();
  const [text, setText] = useState("Сформулируйте запрос...");
  const [answer, setAnswer] = useState<string>("");

  useEffect(() => {
    tg?.ready?.();
    tg?.expand?.();
  }, []);

  async function createSession() {
    const initData = tg?.initData ?? "";
    const r = await fetch("/api/miniapp/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData })
    });
    return r.json();
  }

  async function ask() {
    const sess = await createSession();
    const token = sess.sessionToken;
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });
    const data = await r.json();
    setAnswer(data.answer ?? JSON.stringify(data));
  }

  function sendToBot() {
    const payload = JSON.stringify({ type: "miniapp_submit", text });
    tg?.sendData?.(payload);
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h3>Mini App (React)</h3>
      <textarea
        style={{ width: "100%", minHeight: 100 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={ask}>Спросить Opus 4.6</button>
        <button onClick={sendToBot}>Отправить в бота (sendData)</button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{answer}</pre>
    </div>
  );
}
```

```tsx
// miniapp/react/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```json
// miniapp/vue/package.json
{
  "name": "miniapp-vue",
  "private": true,
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5174",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 5174"
  },
  "dependencies": {
    "vue": "^3.5.10"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.8",
    "vue-tsc": "^2.1.6"
  }
}
```

```ts
// miniapp/vue/vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  base: "./"
});
```

```html
<!-- miniapp/vue/index.html -->
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mini App (Vue)</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

```json
// miniapp/vue/public/manifest.webmanifest
{
  "name": "Telegram Mini App (Vue)",
  "short_name": "MiniApp",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#FFFFFF",
  "icons": []
}
```

```ts
// miniapp/vue/src/telegram.ts
export function getWebApp() {
  // @ts-ignore
  return window.Telegram?.WebApp;
}
```

```vue
<!-- miniapp/vue/src/App.vue -->
<template>
  <div style="padding:16px;font-family:system-ui;">
    <h3>Mini App (Vue)</h3>
    <textarea style="width:100%;min-height:100px" v-model="text"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button @click="ask">Спросить Opus 4.6</button>
      <button @click="sendToBot">Отправить в бота (sendData)</button>
    </div>
    <pre style="white-space:pre-wrap;margin-top:12px;">{{ answer }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getWebApp } from "./telegram";

const tg = getWebApp();
const text = ref("Сформулируйте запрос...");
const answer = ref("");

onMounted(() => {
  tg?.ready?.();
  tg?.expand?.();
});

async function createSession() {
  const initData = tg?.initData ?? "";
  const r = await fetch("/api/miniapp/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData })
  });
  return r.json();
}

async function ask() {
  const sess = await createSession();
  const token = sess.sessionToken;
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ text: text.value })
  });
  const data = await r.json();
  answer.value = data.answer ?? JSON.stringify(data);
}

function sendToBot() {
  const payload = JSON.stringify({ type: "miniapp_submit", text: text.value });
  tg?.sendData?.(payload);
}
</script>
```

```ts
// miniapp/vue/src/main.ts
import { createApp } from "vue";
import App from "./App.vue";
createApp(App).mount("#app");
```

```yaml
# infra/docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  bot-node:
    build: ../services/bot-node
    environment:
      - PORT=8080
      - APP_ENV=dev
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CLAUDE_MODEL=${CLAUDE_MODEL}
      - CLAUDE_MAX_TOKENS=${CLAUDE_MAX_TOKENS}
      - TG_BOT_TOKEN=${TG_BOT_TOKEN}
      - TG_WEBHOOK_SECRET=${TG_WEBHOOK_SECRET}
      - TG_WEBHOOK_PATH=${TG_WEBHOOK_PATH}
      - MINIAPP_PUBLIC_URL=${MINIAPP_PUBLIC_URL}
      - REDIS_URL=redis://redis:6379
    ports: ["8080:8080"]
    depends_on: [redis]
```

```yaml
# infra/k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: opus46-bot
```

```yaml
# infra/k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: opus46-bot
data:
  APP_ENV: "prod"
  PORT: "8080"
  CLAUDE_MODEL: "claude-opus-4-6"
  CLAUDE_MAX_TOKENS: "800"
  TG_WEBHOOK_PATH: "/telegram/webhook"
  MINIAPP_PUBLIC_URL: "https://example.com/miniapp/react"
```

```yaml
# infra/k8s/secret.example.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: opus46-bot
type: Opaque
stringData:
  ANTHROPIC_API_KEY: "replace_me"
  TG_BOT_TOKEN: "replace_me"
  TG_WEBHOOK_SECRET: "replace_me_long_random"
```

```yaml
# infra/k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bot-node
  namespace: opus46-bot
spec:
  replicas: 2
  selector:
    matchLabels:
      app: bot-node
  template:
    metadata:
      labels:
        app: bot-node
    spec:
      containers:
        - name: bot-node
          image: ghcr.io/your-org/opus46-bot-node:latest
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
```

```yaml
# infra/k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: bot-node
  namespace: opus46-bot
spec:
  selector:
    app: bot-node
  ports:
    - name: http
      port: 80
      targetPort: 8080
```

```yaml
# infra/k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bot-node
  namespace: opus46-bot
spec:
  rules:
    - host: example.com
      http:
        paths:
          - path: /telegram/webhook
            pathType: Prefix
            backend:
              service:
                name: bot-node
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: bot-node
                port:
                  number: 80
          - path: /healthz
            pathType: Prefix
            backend:
              service:
                name: bot-node
                port:
                  number: 80
```

```yaml
# .github/workflows/ci-node.yml
name: CI Node
on:
  push:
    paths:
      - "services/bot-node/**"
      - ".github/workflows/ci-node.yml"
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/bot-node
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npm run build || true
      - run: npm run lint
```

```yaml
# .github/workflows/ci-python.yml
name: CI Python
on:
  push:
    paths:
      - "services/bot-python/**"
      - ".github/workflows/ci-python.yml"
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/bot-python
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: python -c "print('python smoke ok')"
```

```yaml
# .github/workflows/build-and-push-docker.yml
name: Build & Push Docker (bot-node)
on:
  push:
    branches: ["main"]
    paths:
      - "services/bot-node/**"
      - ".github/workflows/build-and-push-docker.yml"

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: services/bot-node
          push: true
          tags: ghcr.io/your-org/opus46-bot-node:latest
```

```md
# docs/RUNBOOK_DEBUG.md

## Цель
Короткий runbook для инцидентов Telegram webhook + Opus 4.6.

## Типовые симптомы и проверки

### 401 на /telegram/webhook
- Проверьте, что TG_WEBHOOK_SECRET совпадает и Telegram реально присылает header.
- Локально: выводите только факт совпадения (true/false), не сам секрет.

### Дубли ответов / повтор апдейтов
- Используйте update_id для идемпотентности на вашей стороне (хранить last_update_id per chat).
- При webhook Telegram повторяет запросы, если ответ не 2xx.

### 429 от Claude API
- Считывайте retry-after и делайте backoff.
- Ограничьте concurrency + включите prompt caching на стабильных префиксах.

### Mini App “пользователь не авторизован”
- initDataUnsafe не доверять.
- initData передавайте на сервер и валидируйте подпись.
```

## Рабочие связки и сценарии интеграции

Ниже — практические связки, которые в реальных внедрениях дают наилучшее соотношение “скорость разработки / безопасность / эксплуатация”, если LLM‑ядро — Opus 4.6 через Messages API. Приоритет на механики, которые прямо поддерживаются официальными SDK и документацией: stateless Messages API, обязательные заголовки, prompt caching, structured outputs, лимиты и retry‑after. citeturn6search0turn5search0turn6search3turn5search2turn6search2  

**Архитектура “в целом” (bot + miniapp + backend):**
```mermaid
flowchart LR
  U[User in Telegram] -->|messages| B[Bot]
  U -->|opens| M[Mini App (WebApp)]
  B -->|webhook/polling updates| S[Backend API]
  M -->|HTTPS /api/* + initData| S
  S -->|Messages API| C[Claude Opus 4.6]
  S --> K[(Storage: Redis/Postgres)]
```

### Сценарии и “самые рабочие” сочетания

**Сценарий: MVP/пилот (быстро проверить гипотезу).**  
- **Polling** (getUpdates) вместо webhook: меньше требований к домену/HTTPS, проще локальная отладка. Но polling и webhook взаимно исключаются, и в проде чаще переходят на webhook. citeturn9view0turn9view1  
- Хранение состояния: in‑memory + минимум метрик.  
- Opus 4.6: обычный `messages.create`, без tool use, с коротким system prompt.

**Сценарий: Прод‑бот в entity["company","Telegram","messaging platform"] с мини‑аппом (типовой корпоративный кейс).**  
- **Webhook** + `secret_token` + проверка `X-Telegram-Bot-Api-Secret-Token` (защита от поддельных POST на webhook). citeturn9view1  
- Mini App:  
  - подключить `telegram-web-app.js`; citeturn9view2  
  - использовать `initData` только после серверной валидации, а `initDataUnsafe` не считать доверенным источником; citeturn9view2turn9view3  
  - `sendData` применять для “коротких” payload (до 4096 байт) и только в режиме Keyboard button (WebApp). citeturn9view4  
- Opus 4.6:  
  - включить prompt caching для длинных стабильных префиксов (system prompt, политика, справочники) — это снижает стоимость и повышает throughput, а кэш хранит KV‑представления и хэши, а не “сырой текст”. citeturn5search2turn6search3  
  - для бизнес‑операций использовать structured outputs (JSON schema) или strict tool use, чтобы минимизировать “слом контракта” на интеграциях. citeturn6search2turn6search0  

**Сценарий: OAuth‑интеграции (CRM/ERP/SSO) + бот + mini‑app.**  
- OAuth 2.0 применяется для выдачи ограниченного доступа стороннему приложению от лица пользователя или от имени самого приложения. citeturn10view1  
- Для публичных клиентов (SPA/mini‑app) используйте Authorization Code + PKCE как защиту от перехвата authorization code. Это описано в RFC 7636. citeturn10view2  
- Mini App: секцию OAuth лучше выполнять на backend (redirect/callback), а mini‑app работает через session token/JWT, чтобы не хранить refresh tokens в браузере.

**Сценарий: Высокая нагрузка / строгие лимиты.**  
- Учесть, что Claude API возвращает 429 с `retry-after`; ограничения по input/output tokens per minute и RPM описаны в rate limits; cached tokens обычно не “съедают” ITPM на большинстве моделей (практический выигрыш от caching). citeturn6search3turn5search2  
- Для burst‑нагрузки важен backoff, лимит concurrency и контроль макс. токенов ответа (`max_tokens`). citeturn6search3turn5search0  

## Отладка, тестирование, безопасность и права

### Безопасность входящих интеграций

**Webhook endpoint.**  
- Telegram при setWebhook отправляет апдейты как HTTPS POST с JSON‑serialized Update; при ответе не 2xx Telegram повторяет запрос “разумное число попыток”, поэтому handler должен быть идемпотентным. citeturn9view1  
- `secret_token` позволяет добавлять к каждому webhook‑запросу заголовок `X-Telegram-Bot-Api-Secret-Token`; это базовый способ убедиться, что запрос действительно от Telegram, а не от постороннего клиента. citeturn9view1  
- Идемпотентность: используйте `update_id` (в Telegram описано, что это уникальный идентификатор апдейта и он помогает игнорировать повторные апдейты/восстановить порядок). citeturn9view0  

**Mini App initData и права.**  
- Telegram явно предупреждает: `initData` надо валидировать на сервере, а `initDataUnsafe` “не доверять”. citeturn9view2turn9view3  
- Рекомендуемый практический путь — серверная валидация подписи initData (HMAC‑SHA256 с ключом `WebAppData` + bot token); алгоритм и последовательность шагов приведены в документации сообщества Telegram Mini Apps (как “готовая реализация”). citeturn12view0  
- Права/события Mini Apps: события вида `web_app_request_write_access` описывают схему запроса разрешения у пользователя на возможность “писать” (это важно для сценариев push/notifications внутри Telegram). citeturn13view0  

### Безопасность ключей и секретов

- Claude/Anthropic: все запросы к API обязаны включать `x-api-key`, `anthropic-version`, `content-type`; при использовании официальных SDK они добавляются автоматически, что снижает риск ошибок конфигурации. citeturn6search0turn8view0turn5search1  
- Не допускайте передачи PII в `metadata.user_id`: в API reference явно указано, что `user_id` должен быть uuid/hash/opaque, и **нельзя** включать идентифицирующую информацию (имя, email, телефон). citeturn14view0  
- Секреты (API keys, bot token, OAuth client secret) должны управляться централизованно, с ротацией и аудитом, а не храниться в репозитории. Практики управления секретами суммированы в entity["organization","OWASP","security foundation"] Secrets Management Cheat Sheet. citeturn10view3  

### Логирование и наблюдаемость

- Claude API: API overview описывает наличие `request-id` в ответных заголовках (полезно для трейсинга инцидентов/саппорта) и объясняет ограничения/лимиты по токенам/запросам. citeturn6search0turn6search3  
- Включайте в логи: `chat_id`, `update_id`, режим (webhook/polling), latency Claude call, `usage` токены и “stop_reason” (из ответа Messages API). Формат ответа и `usage` показаны в примере “Using the Messages API”. citeturn5search0  

### Тестирование

**Минимум (достаточно, чтобы не “сломать прод”):**  
- unit‑тест: валидация initData (negative/positive cases), чтобы не открыть авторизацию “кому угодно”; citeturn9view2turn12view0  
- unit‑тест: проверка webhook secret header (401 при несовпадении); citeturn9view1  
- контрактные тесты: structured outputs (JSON schema) для критичных операций — чтобы downstream‑сервисы не падали от неожиданных форматов; caching schema до 24 часов учитывать при смене схем. citeturn6search2  

**Нагрузочные sanity‑checks:**  
- проверить реакцию на 429 и корректный backoff с `retry-after`. citeturn6search3  

## CI/CD, деплой, сравнения и чек‑лист проду

### CI/CD и деплой

**CI минимум:** линт + сборка бэкенда; smoke для Python.  
**CD минимум:** сборка Docker image и пуш в registry (пример — GHCR) + ручной rollout в Kubernetes или docker‑compose на VM.

Ключевые условия для прод‑API: только HTTPS endpoints (особенно webhook и `/api/*`), что соответствует базовым практикам безопасного REST. citeturn11view0turn9view1  

**Workflow “от коммита до прода” (упрощённо):**
```mermaid
flowchart LR
  P[Push to main] --> CI[CI: build/test]
  CI --> IMG[Build Docker image]
  IMG --> REG[Push to registry]
  REG --> DEP[Deploy (K8s/VM)]
  DEP --> SMK[Smoke /healthz + webhook check]
```

### Таблицы сравнения вариантов

**Node.js vs Python (как backend для Opus 4.6 + Telegram).**  
Фактическая база сравнения: официальные SDK есть для обоих языков, но требования окружения отличаются (Node.js 20+ для TypeScript SDK; Python 3.9+ для Python SDK). citeturn5search1turn8view0turn6search0  

| Критерий | Node.js (TypeScript) | Python |
|---|---|---|
| Официальный SDK | TypeScript SDK (`npm install @anthropic-ai/sdk`) | Python SDK (`pip install anthropic`) citeturn5search1turn8view0 |
| Мин. требования | Node.js 20 LTS+ по докам SDK | Python 3.9+ по докам SDK citeturn5search1turn8view0 |
| Стриминг ответов | поддерживается (SSE) | поддерживается (SSE) citeturn5search1turn8view0 |
| Типобезопасность контрактов | сильная (TS) + удобно для structured outputs | обычно через Pydantic/валидации; structured outputs поддерживаются | citeturn6search2turn5search1 |
| Рекомендация выбора | если команда/инфра уже на Node + TS | если команда/инфра уже на Python и сильна в FastAPI/ML |

**React vs Vue (mini‑app frontend).**  
Обе реализации используют Telegram WebApp JS API (подключение `telegram-web-app.js`, доступ к `initData`, `sendData`) и одинаковые серверные endpoint’ы. citeturn9view2turn9view4  

| Критерий | React | Vue |
|---|---|---|
| Стек | React + Vite | Vue 3 + Vite |
| Интеграция с Telegram WebApp | одинаковая (через `window.Telegram.WebApp`) | одинаковая |
| Рекомендация выбора | если уже есть React‑команда/компоненты | если уже есть Vue‑команда/внутренние UI‑стандарты |

**Webhook vs polling (получение апдейтов бота).**  
Основание: Telegram прямо определяет их как два взаимно исключающих пути (`getUpdates` vs `setWebhook`), апдейты хранятся до 24 часов; webhook повторяет запрос при не‑2xx; секретный токен поддерживается через заголовок. citeturn9view0turn9view1turn8view3  

| Критерий | Webhook | Polling (getUpdates) |
|---|---|---|
| Инфраструктура | нужен публичный HTTPS endpoint | можно без публичного домена |
| Надёжность доставки | Telegram повторяет запрос при не‑2xx | бот сам “вытягивает” апдейты |
| Безопасность канала | `secret_token` + header check | защита на стороне исходящих запросов |
| Рекомендация | прод/масштабирование | MVP/локальная разработка |

### Чек‑лист готовности к проду

| Область | Критерий “готово” | Статус |
|---|---|---|
| Telegram webhook | включён `secret_token`, проверяется header; endpoint отвечает 2xx быстро; учтена идемпотентность по `update_id` citeturn9view1turn9view0 | ☐ |
| Mini App auth | сервер валидирует `initData`; `initDataUnsafe` не используется для критических решений citeturn9view2turn12view0 | ☐ |
| Claude API | обязательные заголовки/SDK‑инициализация корректны; настроены лимиты и backoff на 429 (`retry-after`) citeturn6search0turn6search3 | ☐ |
| Контракты | structured outputs включены там, где нужны гарантированные схемы; учтено кеширование JSON schema до 24 часов citeturn6search2 | ☐ |
| Стоимость/скорость | prompt caching включён для длинных стабильных префиксов; понимаете TTL 5m/1h; мониторите cache hit rate citeturn5search2turn6search3 | ☐ |
| Секреты | секреты вне репозитория, есть ротация/аудит/минимизация доступа (Secrets Management best practices) citeturn10view3 | ☐ |
| Транспорт | все прод‑endpoint’ы только по HTTPS citeturn11view0turn9view1 | ☐ |
| Наблюдаемость | логируются ключевые идентификаторы (Telegram update_id, Claude request-id), latency и token usage citeturn9view0turn6search0turn5search0 | ☐ |