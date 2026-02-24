"""
trigger_engine.py — Event-driven notification & escalation system
AI-Driven Facade ERP by Aleksey

Architecture:
  1. TriggerEngine — processes business events → creates notifications
  2. EscalationMatrix — 3-level auto-escalation (non-disableable)
  3. CascadeCalculator — supply delay → GPR cascade shift
  4. CronScheduler — time-based triggers (plan-fact, audits, deadlines)

Integration:
  from trigger_engine import TriggerEngine, CronScheduler
  engine = TriggerEngine(db_session, bot_api)

  # On any status change:
  await engine.fire("TASK_COMPLETED", task_id=123, user_id=5)

  # Cron (every minute):
  scheduler = CronScheduler(db_session, engine)
  await scheduler.tick()
"""

from datetime import datetime, timedelta, date, time
from enum import Enum
from typing import Any
import logging

logger = logging.getLogger("trigger_engine")


# ══════════════════════════════════════════════════════════
# ══  EVENT DEFINITIONS  ══════════════════════════════════
# ══════════════════════════════════════════════════════════

class Event(str, Enum):
    # ── Object lifecycle ──
    CONTRACT_SIGNED = "CONTRACT_SIGNED"
    GPR_CREATED = "GPR_CREATED"
    GPR_SIGNED_BY_ALL = "GPR_SIGNED_BY_ALL"
    OBJECT_STATUS_CHANGE = "OBJECT_STATUS_CHANGE"
    PROJECT_COMPLETED = "PROJECT_COMPLETED"

    # ── Tasks ──
    TASK_ASSIGNED = "TASK_ASSIGNED"
    TASK_COMPLETED = "TASK_COMPLETED"
    TASK_OVERDUE = "TASK_OVERDUE"
    TASK_BLOCKED = "TASK_BLOCKED"

    # ── GPR ──
    GPR_SIGN_REQUEST = "GPR_SIGN_REQUEST"
    GPR_SIGNED = "GPR_SIGNED"

    # ── Supply chain ──
    SUPPLY_DELAYED = "SUPPLY_DELAYED"
    MATERIAL_SHIPPED = "MATERIAL_SHIPPED"
    MATERIAL_RECEIVED = "MATERIAL_RECEIVED"

    # ── Construction ──
    CONSTRUCTION_STAGE_DONE = "CONSTRUCTION_STAGE_DONE"
    CONSTRUCTION_STAGE_REJECTED = "CONSTRUCTION_STAGE_REJECTED"
    KMD_ISSUED = "KMD_ISSUED"
    DEFECT_REPORTED = "DEFECT_REPORTED"
    DEFECT_RESOLVED = "DEFECT_RESOLVED"

    # ── Scheduled ──
    PLAN_FACT_REQUEST = "PLAN_FACT_REQUEST"
    PLAN_FACT_OVERDUE = "PLAN_FACT_OVERDUE"
    WEEKLY_AUDIT = "WEEKLY_AUDIT"
    DEADLINE_APPROACHING = "DEADLINE_APPROACHING"

    # ── Escalation ──
    ESCALATION_L1 = "ESCALATION_L1"
    ESCALATION_L2 = "ESCALATION_L2"
    ESCALATION_L3 = "ESCALATION_L3"


# ══════════════════════════════════════════════════════════
# ══  NOTIFICATION BUILDER  ═══════════════════════════════
# ══════════════════════════════════════════════════════════

class NotificationBuilder:
    """Constructs notification data from event context."""

    # Type → (priority, category, title_template, actions)
    TEMPLATES: dict[str, dict] = {
        # ── Task events ──
        "TASK_ASSIGNED": {
            "priority": "normal", "category": "tasks",
            "title": "🔧 ЗАДАЧА: {task_title}",
            "text": "Назначена вам на объекте «{object_name}». Срок: {deadline}",
            "actions": [
                {"key": "accept", "label": "▶️ Принять", "icon": "▶️", "style": "primary"},
                {"key": "question", "label": "❓ Вопрос РП", "icon": "❓", "style": "default"},
            ],
            "deep_link": "/objects/{object_id}?tab=tasks&task={entity_id}",
        },
        "TASK_COMPLETED": {
            "priority": "normal", "category": "tasks",
            "title": "✅ Задача выполнена: {task_title}",
            "text": "Исполнитель: {executor_name}. Требуется проверка.",
            "actions": [
                {"key": "approve", "label": "✅ Принять", "icon": "✅", "style": "success"},
                {"key": "reject", "label": "↩️ Вернуть", "icon": "↩️", "style": "danger"},
            ],
        },
        "TASK_OVERDUE": {
            "priority": "high", "category": "tasks",
            "title": "🔴 ПРОСРОЧКА: {task_title}",
            "text": "Просрочена на {overdue_days} дн. Объект «{object_name}».",
            "actions": [
                {"key": "extend", "label": "📅 Перенести", "icon": "📅", "style": "default"},
                {"key": "escalate", "label": "⬆️ Эскалация", "icon": "⬆️", "style": "danger"},
            ],
        },
        "TASK_BLOCKED": {
            "priority": "high", "category": "tasks",
            "title": "⛔ БЛОКИРОВКА: {task_title}",
            "text": "Причина: {block_reason}. Требуется арбитраж.",
            "actions": [
                {"key": "resolve", "label": "🔧 Решить", "icon": "🔧", "style": "primary"},
                {"key": "escalate", "label": "⬆️ Эскалировать", "icon": "⬆️", "style": "danger"},
            ],
        },

        # ── GPR events ──
        "GPR_SIGN_REQUEST": {
            "priority": "high", "category": "gpr",
            "title": "📋 Подписание ГПР: {object_name}",
            "text": "Руководитель проекта направил ГПР v{gpr_version} на подписание.",
            "actions": [
                {"key": "sign", "label": "✍️ Подписать", "icon": "✍️", "style": "success"},
                {"key": "comment", "label": "💬 Замечания", "icon": "💬", "style": "default"},
            ],
        },
        "GPR_SIGNED": {
            "priority": "normal", "category": "gpr",
            "title": "✍️ ГПР подписан: {signer_name}",
            "text": "Подписал раздел «{department_name}» объекта «{object_name}».",
            "actions": [],
        },
        "GPR_SIGNED_BY_ALL": {
            "priority": "high", "category": "gpr",
            "title": "🎉 ГПР утверждён: {object_name}",
            "text": "Все отделы подписали. Объект переведён в ACTIVE. Задачи активированы.",
            "actions": [],
            "deep_link": "/objects/{object_id}?tab=gpr",
        },

        # ── Supply events ──
        "SUPPLY_DELAYED": {
            "priority": "high", "category": "supply",
            "title": "⚠️ Задержка поставки: {material_name}",
            "text": "Задержка на {delay_days} дн. Объект «{object_name}». "
                    "Каскадное влияние: затронуто {affected_tasks} задач.",
            "actions": [
                {"key": "accept_shift", "label": "Принять сдвиг", "icon": "✅", "style": "default"},
                {"key": "find_alt", "label": "Альт. поставщик", "icon": "🔍", "style": "primary"},
                {"key": "escalate", "label": "⬆️ Эскалация", "icon": "⬆️", "style": "danger"},
            ],
        },
        "MATERIAL_SHIPPED": {
            "priority": "normal", "category": "supply",
            "title": "🚛 ОТГРУЗКА: {material_name}",
            "text": "Партия {batch_number}, Машина {vehicle}. "
                    "Ожидайте на площадке «{object_name}»!",
            "actions": [
                {"key": "received", "label": "✅ Принял", "icon": "✅", "style": "success"},
                {"key": "not_arrived", "label": "❌ Не прибыла", "icon": "❌", "style": "danger"},
            ],
        },
        "MATERIAL_RECEIVED": {
            "priority": "low", "category": "supply",
            "title": "📦 Материал принят: {material_name}",
            "text": "ТТН зафиксирована. Объект «{object_name}». Остатки обновлены.",
            "actions": [],
        },

        # ── Construction events ──
        "CONSTRUCTION_STAGE_DONE": {
            "priority": "normal", "category": "construction",
            "title": "🏗 Этап завершён: {stage_name}",
            "text": "Объект «{object_name}», {zone}. Следующий этап разблокирован.",
            "actions": [
                {"key": "accept_stage", "label": "✅ Принять", "icon": "✅", "style": "success"},
                {"key": "reject_stage", "label": "❌ Замечания", "icon": "❌", "style": "danger"},
            ],
        },
        "DEFECT_REPORTED": {
            "priority": "critical", "category": "construction",
            "title": "🔴 ДЕФЕКТ: {defect_title}",
            "text": "Объект «{object_name}», {zone}. Захватка заблокирована. "
                    "Фото прикреплено.",
            "actions": [
                {"key": "assign_fix", "label": "🔧 Назначить", "icon": "🔧", "style": "primary"},
                {"key": "view_photo", "label": "📷 Фото", "icon": "📷", "style": "default"},
            ],
        },
        "KMD_ISSUED": {
            "priority": "normal", "category": "construction",
            "title": "📐 КМД выданы: {object_name}",
            "text": "Конструктор завершил разработку. Производство может начать изготовление.",
            "actions": [
                {"key": "start_production", "label": "🏭 Начать", "icon": "🏭", "style": "success"},
            ],
        },

        # ── Scheduled ──
        "PLAN_FACT_REQUEST": {
            "priority": "normal", "category": "tasks",
            "title": "📊 Заполните План-Факт",
            "text": "Ежедневный отчёт по объекту «{object_name}». Дедлайн: 20:00.",
            "actions": [
                {"key": "fill_report", "label": "📝 Заполнить", "icon": "📝", "style": "primary"},
            ],
            "deep_link": "/objects/{object_id}?tab=planfact",
        },
        "PLAN_FACT_OVERDUE": {
            "priority": "high", "category": "tasks",
            "title": "⏰ План-Факт не заполнен!",
            "text": "Отчёт по объекту «{object_name}» просрочен. "
                    "Следующий уровень: эскалация руководителю.",
            "actions": [
                {"key": "fill_report", "label": "📝 Заполнить сейчас", "icon": "📝", "style": "danger"},
            ],
        },
        "WEEKLY_AUDIT": {
            "priority": "normal", "category": "system",
            "title": "📋 Еженедельный аудит",
            "text": "Чек-лист контроля качества для объекта «{object_name}». "
                    "Заполните до конца дня.",
            "actions": [
                {"key": "start_audit", "label": "📋 Начать", "icon": "📋", "style": "primary"},
            ],
        },

        # ── Escalation ──
        "ESCALATION_L1": {
            "priority": "high", "category": "escalation",
            "title": "⏰ Напоминание: {original_title}",
            "text": "Вы не отреагировали на задачу за {hours}ч. "
                    "Следующий уровень: уведомление руководителю.",
            "escalation_level": 1,
            "actions": [
                {"key": "respond_now", "label": "Ответить", "icon": "💬", "style": "primary"},
            ],
        },
        "ESCALATION_L2": {
            "priority": "critical", "category": "escalation",
            "title": "⚠️ ЭСКАЛАЦИЯ: {original_title}",
            "text": "Исполнитель: {executor_name}. "
                    "Нет ответа {hours}ч. Требуется ваше вмешательство.",
            "escalation_level": 2,
            "actions": [
                {"key": "intervene", "label": "🔧 Вмешаться", "icon": "🔧", "style": "danger"},
                {"key": "reassign", "label": "👤 Переназначить", "icon": "👤", "style": "default"},
            ],
        },
        "ESCALATION_L3": {
            "priority": "critical", "category": "escalation",
            "title": "🔴 КРИТИЧЕСКАЯ ЭСКАЛАЦИЯ → Директорат",
            "text": "Дайджест красной зоны. Объект «{object_name}»: "
                    "{blocked_count} блокировок, {overdue_count} просрочек.",
            "escalation_level": 3,
            "actions": [
                {"key": "view_digest", "label": "📊 Дайджест", "icon": "📊", "style": "danger"},
            ],
        },

        # ── Cascade ──
        "CASCADE_SHIFT": {
            "priority": "high", "category": "supply",
            "title": "🔄 Каскадный сдвиг ГПР: {object_name}",
            "text": "Задержка «{trigger_material}» на {delay_days} дн. "
                    "Пересчитано: {affected_tasks} задач сдвинуты.",
            "actions": [
                {"key": "accept_shift", "label": "✅ Принять", "icon": "✅", "style": "primary"},
                {"key": "adjust_gpr", "label": "📅 Скорректировать ГПР", "icon": "📅", "style": "default"},
                {"key": "escalate", "label": "⬆️ Эскалация", "icon": "⬆️", "style": "danger"},
            ],
        },
    }

    @classmethod
    def build(cls, event: str, context: dict[str, Any],
              recipients: list[int]) -> list[dict]:
        """Build notification dicts for given event and recipients."""
        template = cls.TEMPLATES.get(event)
        if not template:
            logger.warning(f"No template for event: {event}")
            return []

        notifications = []
        for user_id in recipients:
            notif = {
                "user_id": user_id,
                "type": event.lower(),
                "priority": template["priority"],
                "category": template["category"],
                "title": _render(template["title"], context),
                "text": _render(template.get("text", ""), context),
                "entity_type": context.get("entity_type"),
                "entity_id": context.get("entity_id"),
                "object_id": context.get("object_id"),
                "object_name": context.get("object_name"),
                "is_read": False,
                "is_actionable": len(template.get("actions", [])) > 0,
                "escalation_level": template.get("escalation_level"),
                "actions": template.get("actions", []),
                "deep_link": _render(template.get("deep_link", ""), context) or None,
                "triggered_by": context.get("triggered_by"),
                "created_at": datetime.utcnow(),
                "expires_at": context.get("expires_at"),
            }
            notifications.append(notif)

        return notifications


def _render(template: str, context: dict) -> str:
    """Safe string formatting with fallback for missing keys."""
    try:
        return template.format(**context) if template else ""
    except KeyError:
        return template


# ══════════════════════════════════════════════════════════
# ══  TRIGGER ENGINE  ═════════════════════════════════════
# ══════════════════════════════════════════════════════════

class TriggerEngine:
    """
    Core event processor. Every status change in the system
    fires through here, producing notifications + side effects.

    Usage:
        engine = TriggerEngine(db, bot_api)
        await engine.fire("TASK_COMPLETED", task_id=123, user_id=5)
    """

    def __init__(self, db, bot_api=None):
        self.db = db
        self.bot_api = bot_api  # For sending Telegram push via Bot API

    async def fire(self, event: str, **context) -> list[dict]:
        """Fire an event and process all triggers."""
        logger.info(f"🔥 Event fired: {event} | context: {list(context.keys())}")

        # Resolve recipients based on event type
        recipients = await self._resolve_recipients(event, context)
        if not recipients:
            logger.warning(f"No recipients for event {event}")
            return []

        # Build notifications
        notifications = NotificationBuilder.build(event, context, recipients)

        # Persist to database
        saved = []
        for notif_data in notifications:
            notif = await self._save_notification(notif_data)
            saved.append(notif)

        # Write audit log
        await self._audit(event, context)

        # Send Telegram push (non-blocking)
        if self.bot_api:
            for notif_data in notifications:
                await self._send_push(notif_data)

        # Process side-effects (chain reactions)
        await self._process_side_effects(event, context)

        logger.info(f"✅ {event}: {len(saved)} notifications sent")
        return saved

    async def _resolve_recipients(self, event: str, ctx: dict) -> list[int]:
        """
        Determine who receives the notification based on event type.
        Mapping from documentation Event Model table.
        """
        from sqlalchemy import select
        # Пробел → import actual models; using pseudocode structure
        # from bot.db.models import User, ObjectRole, Task, ...

        object_id = ctx.get("object_id")
        user_id = ctx.get("user_id")

        # Event → recipient resolution rules (from architecture doc)
        RECIPIENT_RULES: dict[str, list[str]] = {
            "CONTRACT_SIGNED": ["project_manager"],
            "GPR_CREATED": ["all_department_heads"],
            "GPR_SIGNED_BY_ALL": ["all_team"],
            "TASK_ASSIGNED": ["assignee"],
            "TASK_COMPLETED": ["department_head", "project_manager"],
            "TASK_OVERDUE": ["assignee", "department_head", "project_manager"],
            "TASK_BLOCKED": ["project_manager"],
            "GPR_SIGN_REQUEST": ["signer"],
            "GPR_SIGNED": ["project_manager"],
            "SUPPLY_DELAYED": ["project_manager", "production", "construction_itr"],
            "MATERIAL_SHIPPED": ["construction_itr", "project_manager"],
            "MATERIAL_RECEIVED": ["supply", "project_manager"],
            "CONSTRUCTION_STAGE_DONE": ["pto", "project_manager"],
            "CONSTRUCTION_STAGE_REJECTED": ["construction_itr"],
            "DEFECT_REPORTED": ["production", "project_manager"],
            "DEFECT_RESOLVED": ["construction_itr", "project_manager"],
            "KMD_ISSUED": ["production", "project_manager"],
            "PLAN_FACT_REQUEST": ["assignee"],
            "PLAN_FACT_OVERDUE": ["assignee"],
            "WEEKLY_AUDIT": ["assignee"],
            "ESCALATION_L1": ["assignee"],
            "ESCALATION_L2": ["department_head"],
            "ESCALATION_L3": ["admin", "project_manager"],
            "PROJECT_COMPLETED": ["all_team"],
        }

        rules = RECIPIENT_RULES.get(event, [])
        recipient_ids: set[int] = set()

        for rule in rules:
            if rule == "assignee":
                if aid := ctx.get("assignee_id"):
                    recipient_ids.add(aid)
            elif rule == "signer":
                if sid := ctx.get("signer_id"):
                    recipient_ids.add(sid)
            elif rule == "project_manager" and object_id:
                pm_ids = await self._get_role_users(object_id, "project_manager")
                recipient_ids.update(pm_ids)
            elif rule == "department_head" and object_id:
                dept = ctx.get("department")
                if dept:
                    head_ids = await self._get_dept_head(object_id, dept)
                    recipient_ids.update(head_ids)
            elif rule == "all_department_heads" and object_id:
                heads = await self._get_all_heads(object_id)
                recipient_ids.update(heads)
            elif rule == "all_team" and object_id:
                team = await self._get_all_team(object_id)
                recipient_ids.update(team)
            elif rule in ("production", "supply", "construction_itr", "pto", "admin"):
                role_users = await self._get_role_users(object_id, rule)
                recipient_ids.update(role_users)

        # Never notify the person who triggered the event
        if trigger_user := ctx.get("triggered_by_id"):
            recipient_ids.discard(trigger_user)

        return list(recipient_ids)

    async def _get_role_users(self, object_id: int | None, role: str) -> list[int]:
        """Get user IDs by role on an object. Пробел → actual DB query."""
        # from sqlalchemy import select
        # result = await self.db.execute(
        #     select(ObjectRole.user_id)
        #     .where(ObjectRole.object_id == object_id, ObjectRole.role == role)
        # )
        # return [r[0] for r in result.all()]
        return []  # Placeholder

    async def _get_dept_head(self, object_id: int, dept: str) -> list[int]:
        """Get department head for object. Пробел → DB query."""
        return []

    async def _get_all_heads(self, object_id: int) -> list[int]:
        """Get all department heads for object."""
        return []

    async def _get_all_team(self, object_id: int) -> list[int]:
        """Get entire team for object."""
        return []

    async def _save_notification(self, data: dict) -> dict:
        """Persist notification to database. Пробел → actual Notification model."""
        # from bot.db.models import Notification
        # notif = Notification(**data)
        # self.db.add(notif)
        # await self.db.flush()
        # return notif
        return data

    async def _audit(self, event: str, ctx: dict):
        """Write to AuditLog."""
        # from bot.db.models import AuditLog
        # log = AuditLog(
        #     user_id=ctx.get("triggered_by_id") or ctx.get("user_id"),
        #     action=event.lower(),
        #     entity_type=ctx.get("entity_type"),
        #     entity_id=ctx.get("entity_id"),
        #     new_value=str(ctx),
        # )
        # self.db.add(log)
        pass

    async def _send_push(self, notif: dict):
        """Send Telegram push notification via Bot API."""
        if not self.bot_api:
            return

        user_id = notif.get("user_id")
        # Пробел → get telegram_id from user_id
        # telegram_id = await self._get_telegram_id(user_id)

        priority = notif.get("priority", "normal")
        title = notif.get("title", "")
        text = notif.get("text", "")
        actions = notif.get("actions", [])

        # Build inline keyboard from actions
        keyboard = []
        for action in actions[:3]:  # Max 3 buttons
            keyboard.append([{
                "text": f"{action['icon']} {action['label']}",
                "callback_data": f"notif_action:{notif.get('id', 0)}:{action['key']}",
            }])

        # Deep link button
        deep_link = notif.get("deep_link")
        if deep_link:
            keyboard.append([{
                "text": "📱 Открыть в Mini App",
                "web_app": {"url": f"{{MINIAPP_URL}}{deep_link}"},
            }])

        message = f"{title}\n\n{text}" if text else title

        # Critical → disable_notification=False (sound ON)
        # Low → disable_notification=True (silent)
        silent = priority in ("low", "normal")

        # await self.bot_api.send_message(
        #     chat_id=telegram_id,
        #     text=message,
        #     reply_markup={"inline_keyboard": keyboard} if keyboard else None,
        #     disable_notification=silent,
        # )

    async def _process_side_effects(self, event: str, ctx: dict):
        """
        Chain reactions — one event triggers another.
        From architecture doc: "событийные триггеры (зависимость от предшественника)"
        """

        if event == "GPR_SIGNED_BY_ALL":
            # Auto-activate object: PLANNING → ACTIVE
            # Auto-assign all GPR tasks
            object_id = ctx.get("object_id")
            # await self._activate_object(object_id)

        elif event == "KMD_ISSUED":
            # Trigger: production can start (if materials ready)
            # Check: КМД + materials → generate MATERIAL_READY event
            pass

        elif event == "MATERIAL_SHIPPED":
            # Trigger: notify construction to prepare for receiving
            # Auto-create task СМР-001 for прораб
            pass

        elif event == "MATERIAL_RECEIVED":
            # After прораб confirms receiving:
            # Auto-generate task СМР-002: quality check
            # Actions: [✅ Всё ОК] or [⚠️ Есть дефекты] + mandatory photo
            pass

        elif event == "CONSTRUCTION_STAGE_DONE":
            # Unlock next stage in sequence
            # Create АОСР task for ПТО
            pass

        elif event == "SUPPLY_DELAYED":
            # Cascade recalculation
            delay_days = ctx.get("delay_days", 0)
            object_id = ctx.get("object_id")
            material = ctx.get("material_name")
            if delay_days > 0 and object_id:
                cascade = CascadeCalculator(self.db)
                affected = await cascade.recalculate(object_id, material, delay_days)
                if affected > 0:
                    await self.fire(
                        "CASCADE_SHIFT",
                        object_id=object_id,
                        object_name=ctx.get("object_name"),
                        trigger_material=material,
                        delay_days=delay_days,
                        affected_tasks=affected,
                        entity_type="object",
                        entity_id=object_id,
                    )

        elif event == "DEFECT_REPORTED":
            # Block захватка, create fix task for production
            # Mandatory photo already enforced by frontend
            pass


# ══════════════════════════════════════════════════════════
# ══  ESCALATION MATRIX (non-disableable)  ════════════════
# ══════════════════════════════════════════════════════════

class EscalationMatrix:
    """
    3-level escalation system. Cannot be disabled by users.

    Level 1 (Reminder): After reminder_interval_1 (default 1h)
      → Re-notify assignee

    Level 2 (Manager): After reminder_interval_2 (default 2h)
      → Alert department head + project manager
      → Template: "⚠️ ЭСКАЛАЦИЯ. Исполнитель: {X}. Задача: {Y}. Нет ответа {Z}ч."

    Level 3 (Director): After 20:00 same day or 24h for critical tasks
      → Red zone digest to CEO/Director
      → Summary of all blocked + overdue items
    """

    # Escalation timing per notification type
    TIMING: dict[str, dict] = {
        # type → {l1_minutes, l2_minutes, l3_minutes}
        "task_assigned": {"l1": 60, "l2": 240, "l3": 1440},
        "task_overdue": {"l1": 30, "l2": 120, "l3": 480},
        "gpr_sign_request": {"l1": 120, "l2": 480, "l3": 1440},
        "plan_fact_request": {"l1": 60, "l2": 120, "l3": None},  # L3 at 20:00
        "material_shipped": {"l1": 30, "l2": 120, "l3": 480},
        "defect_reported": {"l1": 30, "l2": 60, "l3": 240},
        "construction_stage_done": {"l1": 60, "l2": 240, "l3": 1440},
    }

    # Special timing: material_shipped for прораб → 30 min to L2
    SPECIAL_RULES = {
        "material_shipped": {
            "l2_condition": "Прораб не подтвердил прибытие машины",
            "l2_minutes": 30,
        },
        "task_blocked": {
            "l2_condition": "Задача КМД висит без ответа",
            "l2_minutes": 240,  # 4 hours per doc
        },
    }

    def __init__(self, db, engine: TriggerEngine):
        self.db = db
        self.engine = engine

    async def check_pending(self):
        """
        Called by CronScheduler every minute.
        Finds actionable notifications without response and escalates.
        """
        # Query: all actionable notifications that are:
        # - is_actionable = True
        # - is_read = False (or read but no action taken)
        # - no response action logged
        # - created_at + escalation_time < now

        # Пробел → actual DB query
        # pending = await self.db.execute(
        #     select(Notification)
        #     .where(
        #         Notification.is_actionable == True,
        #         Notification.is_read == False,
        #     )
        # )

        pending_notifications = []  # Placeholder

        now = datetime.utcnow()

        for notif in pending_notifications:
            ntype = notif.get("type", "")
            timing = self.TIMING.get(ntype)
            if not timing:
                continue

            created = notif.get("created_at", now)
            elapsed_min = (now - created).total_seconds() / 60
            current_level = notif.get("escalation_level") or 0

            # Check Level 1
            if current_level < 1 and elapsed_min >= timing.get("l1", 60):
                await self._escalate(notif, level=1)

            # Check Level 2
            elif current_level < 2 and elapsed_min >= timing.get("l2", 240):
                await self._escalate(notif, level=2)

            # Check Level 3
            elif current_level < 3:
                l3_min = timing.get("l3")
                if l3_min and elapsed_min >= l3_min:
                    await self._escalate(notif, level=3)

    async def _escalate(self, original_notif: dict, level: int):
        """Fire escalation event."""
        event = f"ESCALATION_L{level}"
        hours = round((datetime.utcnow() - original_notif["created_at"]).total_seconds() / 3600, 1)

        context = {
            "original_title": original_notif.get("title", ""),
            "original_notif_id": original_notif.get("id"),
            "executor_name": original_notif.get("triggered_by", "Неизвестный"),
            "hours": hours,
            "object_id": original_notif.get("object_id"),
            "object_name": original_notif.get("object_name", ""),
            "entity_type": original_notif.get("entity_type"),
            "entity_id": original_notif.get("entity_id"),
            "assignee_id": original_notif.get("user_id"),
        }

        # Level 3 → collect digest
        if level == 3:
            context["blocked_count"] = 0  # Пробел → query blocked tasks
            context["overdue_count"] = 0  # Пробел → query overdue tasks

        await self.engine.fire(event, **context)

        # Mark original notification's escalation level
        # Пробел → update original_notif.escalation_level = level

        logger.warning(
            f"🚨 ESCALATION L{level}: {original_notif.get('title')} "
            f"({hours}h without response)"
        )

    async def check_evening_deadline(self):
        """
        Special L3 rule: if plan-fact not submitted by 20:00,
        send red zone digest to director.
        """
        now = datetime.utcnow()  # Пробел → timezone-aware
        if now.hour == 20 and now.minute < 5:  # Run once at ~20:00
            # Query all plan_fact_request notifications from today
            # that are still unread/unactioned
            # For each → fire ESCALATION_L3 to director
            pass


# ══════════════════════════════════════════════════════════
# ══  CASCADE CALCULATOR  ═════════════════════════════════
# ══════════════════════════════════════════════════════════

class CascadeCalculator:
    """
    When supply is delayed, recalculate cascade impact on GPR.
    "Если менеджер фиксирует задержку на 5 дней, бот пересчитывает
     каскадное влияние на весь ГПР объекта."
    """

    def __init__(self, db):
        self.db = db

    async def recalculate(self, object_id: int, material: str,
                          delay_days: int) -> int:
        """
        Shift dependent GPR items by delay_days.
        Returns number of affected tasks.
        """
        affected = 0

        # 1. Find GPR items that depend on this material
        # Пробел → actual query: GPRItem where dependency includes material supply
        # dependent_items = await self.db.execute(...)

        # 2. For each dependent item, shift planned_start and planned_end
        # gpr_item.planned_start += timedelta(days=delay_days)
        # gpr_item.planned_end += timedelta(days=delay_days)

        # 3. Cascade: find items that depend on shifted items
        # (predecessor/successor relationships)
        # Recursively shift all downstream tasks

        # 4. Log all shifts in AuditLog
        # AuditLog(action="cascade_shift", entity_type="gpr_item", ...)

        logger.info(
            f"🔄 Cascade recalculation: object={object_id}, "
            f"material={material}, delay={delay_days}d, affected={affected}"
        )

        return affected


# ══════════════════════════════════════════════════════════
# ══  CRON SCHEDULER  ═════════════════════════════════════
# ══════════════════════════════════════════════════════════

class CronScheduler:
    """
    Time-based triggers. Run via:
      scheduler = CronScheduler(db, engine)

      # In FastAPI startup:
      @app.on_event("startup")
      async def start_scheduler():
          asyncio.create_task(scheduler.run_forever())
    """

    def __init__(self, db, engine: TriggerEngine):
        self.db = db
        self.engine = engine
        self.escalation = EscalationMatrix(db, engine)

    async def run_forever(self, interval_seconds: int = 60):
        """Main loop — runs every minute."""
        import asyncio
        while True:
            try:
                await self.tick()
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(interval_seconds)

    async def tick(self):
        """Single scheduler tick — called every minute."""
        now = datetime.utcnow()  # Пробел → timezone-aware (MSK)
        current_time = now.time()

        # ── 1. Check deadline approaching (daily, morning) ──
        if current_time.hour == 9 and current_time.minute < 2:
            await self._check_approaching_deadlines()

        # ── 2. Plan-Fact request (configurable, default 18:00) ──
        if current_time.hour == 18 and current_time.minute < 2:
            await self._send_plan_fact_requests()

        # ── 3. Plan-Fact overdue check (19:00 = 1h after request) ──
        if current_time.hour == 19 and current_time.minute < 2:
            await self._check_plan_fact_overdue()

        # ── 4. Evening deadline → L3 escalation (20:00) ──
        if current_time.hour == 20 and current_time.minute < 2:
            await self.escalation.check_evening_deadline()

        # ── 5. Weekly audit (Monday 10:00) ──
        if now.weekday() == 0 and current_time.hour == 10 and current_time.minute < 2:
            await self._send_weekly_audits()

        # ── 6. Task overdue detection (every 5 min) ──
        if current_time.minute % 5 == 0:
            await self._check_overdue_tasks()

        # ── 7. Escalation matrix check (every minute) ──
        await self.escalation.check_pending()

        # ── 8. GPR deviation check (every 30 min) ──
        if current_time.minute % 30 == 0:
            await self._check_gpr_deviations()

    async def _check_approaching_deadlines(self):
        """Notify about tasks due tomorrow."""
        # Query: tasks where deadline = tomorrow and status not DONE
        # For each → fire DEADLINE_APPROACHING
        # Пробел → actual query
        logger.info("⏰ Checking approaching deadlines")

    async def _send_plan_fact_requests(self):
        """
        СМР-008: Daily plan-fact data collection at 18:00.
        Send to all прорабы and ИТР on active objects.
        """
        # Query: active objects → construction_itr users
        # For each → fire PLAN_FACT_REQUEST
        logger.info("📊 Sending plan-fact requests")

    async def _check_plan_fact_overdue(self):
        """Check which plan-fact reports were not filled (1h after request)."""
        # Query: PLAN_FACT_REQUEST notifications from today
        # that are still unactioned
        # For each → fire PLAN_FACT_OVERDUE + start L1 escalation
        logger.info("⏰ Checking plan-fact overdue")

    async def _send_weekly_audits(self):
        """
        СМР-010: Monday 10:00 — quality control checklists.
        """
        # Query: active objects → responsible roles
        # For each → fire WEEKLY_AUDIT
        logger.info("📋 Sending weekly audit checklists")

    async def _check_overdue_tasks(self):
        """
        Auto-detection: tasks past deadline → status OVERDUE.
        Fire TASK_OVERDUE event with escalation.
        """
        # Query: tasks where deadline < now and status not DONE/OVERDUE
        # For each:
        #   - Update status → OVERDUE
        #   - Fire TASK_OVERDUE event
        #   - Calculate overdue_days
        logger.info("🔴 Checking overdue tasks")

    async def _check_gpr_deviations(self):
        """
        UC-5: Auto plan/fact comparison.
        If deviation > 3 days → alert project manager.
        """
        # Query: active GPR items where actual_end - planned_end > 3 days
        # Or: items that should be done by now but are still in_progress
        # For deviations > 3d → fire CASCADE warning
        logger.info("📊 Checking GPR deviations (plan vs fact)")
