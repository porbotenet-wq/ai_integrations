"""
Event Engine — автоматические уведомления при изменении сущностей.
Вызывается из API endpoints при смене статусов.
"""
import logging
from datetime import datetime
from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from bot.db.models import (
    User, UserRole, Task, TaskStatus, ObjectRole,
    Notification, NotificationType, ObjectChat,
)
from bot.utils.deep_links import object_button, object_tasks_button, notifications_button
from bot.config import get_settings

logger = logging.getLogger(__name__)


async def _get_bot() -> Bot:
    settings = get_settings()
    return Bot(token=settings.bot_token)


async def _get_object_users(db: AsyncSession, object_id: int, roles: list[UserRole] | None = None):
    """Get users assigned to an object, optionally filtered by role."""
    q = select(ObjectRole, User).join(User, User.id == ObjectRole.user_id).where(
        ObjectRole.object_id == object_id
    )
    if roles:
        q = q.where(ObjectRole.role.in_(roles))
    result = await db.execute(q)
    return [(or_.role, u) for or_, u in result.all()]


async def _send_to_user(bot: Bot, user: User, text: str, kb=None):
    """Send message to user, swallow errors."""
    try:
        await bot.send_message(user.telegram_id, text, parse_mode="HTML", reply_markup=kb)
    except Exception as e:
        logger.warning(f"Failed to send to {user.telegram_id}: {e}")


async def _send_to_linked_chats(bot: Bot, db: AsyncSession, object_id: int, text: str, kb=None):
    """Send to all TG groups linked to this object."""
    result = await db.execute(
        select(ObjectChat).where(ObjectChat.object_id == object_id, ObjectChat.is_active == True)
    )
    for chat in result.scalars().all():
        try:
            await bot.send_message(chat.chat_id, text, parse_mode="HTML", reply_markup=kb)
        except Exception as e:
            logger.warning(f"Failed to send to chat {chat.chat_id}: {e}")


async def _create_notif(db: AsyncSession, user_id: int, ntype: str, title: str, text: str = "",
                        entity_type: str = "", entity_id: int | None = None):
    notif = Notification(
        user_id=user_id, type=ntype, title=title, text=text,
        entity_type=entity_type, entity_id=entity_id,
    )
    db.add(notif)
    return notif


# ═══════════════════════════════════════════════════════════
# TASK EVENTS
# ═══════════════════════════════════════════════════════════

async def on_task_assigned(db: AsyncSession, task: Task, assigned_by: User | None = None):
    """Задача назначена исполнителю — push + кнопки Принять/Отклонить."""
    if not task.assignee_id:
        return

    bot = await _get_bot()
    assignee = await db.get(User, task.assignee_id)
    if not assignee:
        return

    by_text = f"\nНазначил: {assigned_by.full_name}" if assigned_by else ""
    deadline_text = f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""

    text = (
        f"📋 <b>Новая задача</b>\n\n"
        f"<b>{task.title}</b>{by_text}{deadline_text}"
    )

    # Accept/Reject buttons
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Принять", callback_data=f"task_accept:{task.id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"task_reject:{task.id}"),
        ],
        [object_tasks_button(task.object_id)],
    ])

    await _create_notif(db, assignee.id, "task_assigned",
                        f"📋 Новая задача: {task.title}", text,
                        "task", task.object_id)
    await _send_to_user(bot, assignee, text, kb)

    # Notify linked chats
    chat_text = (
        f"📋 <b>Задача назначена</b>\n"
        f"{task.title}\n"
        f"👤 Исполнитель: {assignee.full_name}{deadline_text}"
    )
    await _send_to_linked_chats(bot, db, task.object_id, chat_text)
    await bot.session.close()


async def on_task_status_changed(db: AsyncSession, task: Task, old_status: str, changed_by: User | None = None):
    """Статус задачи изменился — уведомить заинтересованных."""
    bot = await _get_bot()
    new_status = task.status.value if hasattr(task.status, 'value') else task.status

    STATUS_EMOJI = {
        'in_progress': '🔵', 'review': '🟡', 'done': '✅',
        'overdue': '🔴', 'blocked': '⛔', 'assigned': '📌',
    }
    emoji = STATUS_EMOJI.get(new_status, '📋')
    STATUS_LABELS = {
        'new': 'Новая', 'assigned': 'Назначена', 'in_progress': 'В работе',
        'review': 'На проверке', 'done': 'Выполнена', 'overdue': 'Просрочена',
        'blocked': 'Заблокирована',
    }
    label = STATUS_LABELS.get(new_status, new_status)

    text = (
        f"{emoji} <b>Статус задачи изменён</b>\n\n"
        f"<b>{task.title}</b>\n"
        f"{old_status} → <b>{label}</b>"
    )
    if changed_by:
        text += f"\nИзменил: {changed_by.full_name}"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [object_tasks_button(task.object_id)],
    ])

    # Notify creator
    if task.created_by_id and task.created_by_id != (changed_by.id if changed_by else None):
        creator = await db.get(User, task.created_by_id)
        if creator:
            await _create_notif(db, creator.id, "task_assigned", f"{emoji} {task.title}: {label}",
                                text, "task", task.object_id)
            await _send_to_user(bot, creator, text, kb)

    # Notify assignee if changed by someone else
    if task.assignee_id and task.assignee_id != (changed_by.id if changed_by else None):
        assignee = await db.get(User, task.assignee_id)
        if assignee:
            await _send_to_user(bot, assignee, text, kb)

    # If done — notify project managers
    if new_status == 'done':
        managers = await _get_object_users(db, task.object_id,
                                           [UserRole.PROJECT_MANAGER, UserRole.ADMIN])
        for role, pm in managers:
            if pm.id not in (task.assignee_id, task.created_by_id):
                await _send_to_user(bot, pm, text, kb)

    # If blocked — escalate to PM
    if new_status == 'blocked':
        managers = await _get_object_users(db, task.object_id,
                                           [UserRole.PROJECT_MANAGER, UserRole.ADMIN])
        block_text = (
            f"⛔ <b>Задача заблокирована</b>\n\n"
            f"<b>{task.title}</b>\n"
            f"Причина: {task.blocked_reason or 'не указана'}"
        )
        for role, pm in managers:
            await _create_notif(db, pm.id, "escalation", f"⛔ Блокировка: {task.title}",
                                block_text, "task", task.object_id)
            await _send_to_user(bot, pm, block_text, kb)

    # Linked chats
    await _send_to_linked_chats(bot, db, task.object_id, text, kb)
    await bot.session.close()


# ═══════════════════════════════════════════════════════════
# SUPPLY EVENTS
# ═══════════════════════════════════════════════════════════

async def on_supply_status_changed(db: AsyncSession, order, old_status: str):
    """Статус поставки изменился."""
    bot = await _get_bot()
    new_status = order.status.value if hasattr(order.status, 'value') else order.status

    SUPPLY_EMOJI = {
        'requested': '📝', 'approved': '✅', 'ordered': '📦',
        'shipped': '🚛', 'delivered': '📬', 'delayed': '⚠️',
    }
    emoji = SUPPLY_EMOJI.get(new_status, '📦')

    text = (
        f"{emoji} <b>Поставка: {order.material_name}</b>\n"
        f"Статус: <b>{new_status}</b>\n"
        f"Кол-во: {order.quantity} {order.unit or ''}"
    )
    if new_status == 'delayed':
        text += f"\n⚠️ Ожидалось: {order.expected_date.strftime('%d.%m.%Y')}" if order.expected_date else ""

    # Notify supply department + PMs
    managers = await _get_object_users(db, order.object_id,
                                       [UserRole.PROJECT_MANAGER, UserRole.ADMIN, UserRole.SUPPLY])
    for role, user in managers:
        ntype = "supply_delayed" if new_status == 'delayed' else "supply_shipped"
        await _create_notif(db, user.id, ntype, f"{emoji} {order.material_name}",
                            text, "supply", order.object_id)
        await _send_to_user(bot, user, text)

    await _send_to_linked_chats(bot, db, order.object_id, text)
    await bot.session.close()


# ═══════════════════════════════════════════════════════════
# CONSTRUCTION EVENTS
# ═══════════════════════════════════════════════════════════

async def on_stage_completed(db: AsyncSession, stage, object_id: int):
    """Этап монтажа завершён — уведомить ПТО для приёмки."""
    bot = await _get_bot()

    text = (
        f"🏗 <b>Этап завершён</b>\n\n"
        f"<b>{stage.name}</b>\n"
        f"Ожидает приёмки Технадзором"
    )

    # Notify PTO + PMs
    users = await _get_object_users(db, object_id,
                                    [UserRole.PTO, UserRole.PROJECT_MANAGER, UserRole.ADMIN])
    for role, user in users:
        await _create_notif(db, user.id, "stage_completed", f"🏗 Завершён: {stage.name}",
                            text, "stage", object_id)
        await _send_to_user(bot, user, text)

    await _send_to_linked_chats(bot, db, object_id, text)
    await bot.session.close()


# ═══════════════════════════════════════════════════════════
# FACT DEVIATION
# ═══════════════════════════════════════════════════════════

async def on_fact_deviation(db: AsyncSession, object_id: int, work_name: str, deviation_pct: float):
    """Отклонение факта от плана >15% — эскалация."""
    if abs(deviation_pct) < 15:
        return

    bot = await _get_bot()
    emoji = "🔴" if deviation_pct < -15 else "🟡"

    text = (
        f"{emoji} <b>Отклонение план/факт</b>\n\n"
        f"Работа: {work_name}\n"
        f"Отклонение: <b>{deviation_pct:+.1f}%</b>"
    )

    managers = await _get_object_users(db, object_id,
                                       [UserRole.PROJECT_MANAGER, UserRole.ADMIN, UserRole.PTO])
    for role, user in managers:
        await _create_notif(db, user.id, "escalation", f"{emoji} Отклонение: {work_name}",
                            text, "object", object_id)
        await _send_to_user(bot, user, text)

    await _send_to_linked_chats(bot, db, object_id, text)
    await bot.session.close()
