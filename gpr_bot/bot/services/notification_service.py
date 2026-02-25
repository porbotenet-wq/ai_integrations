from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from bot.db.models import Notification, NotificationType, User


async def create_notification(
    session: AsyncSession,
    user_id: int,
    type: NotificationType,
    title: str,
    text: str = "",
    entity_type: str = "",
    entity_id: int | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        text=text,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    session.add(notif)
    await session.flush()
    return notif


async def send_push(
    bot: Bot, session: AsyncSession, user_id: int,
    title: str, text: str = "",
    entity_type: str = "", entity_id: int | None = None,
):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return
    try:
        message = f"🔔 <b>{title}</b>"
        if text:
            message += f"\n{text}"

        # Build deep link keyboard
        kb = _build_push_keyboard(entity_type, entity_id)
        await bot.send_message(
            user.telegram_id, message,
            parse_mode="HTML", reply_markup=kb,
        )
    except Exception:
        pass


def _build_push_keyboard(entity_type: str, entity_id: int | None) -> InlineKeyboardMarkup | None:
    """Build inline keyboard with deep link to entity in Mini App."""
    if not entity_id:
        return None
    try:
        from bot.utils.deep_links import (
            object_button, object_tasks_button, object_gpr_button,
            object_supply_button, notifications_button,
        )
        buttons = []
        if entity_type == "object":
            buttons.append([object_button(entity_id)])
        elif entity_type == "task":
            buttons.append([object_tasks_button(entity_id)])
        elif entity_type == "gpr":
            buttons.append([object_gpr_button(entity_id)])
        elif entity_type == "supply":
            buttons.append([object_supply_button(entity_id)])
        elif entity_type == "stage":
            from bot.utils.deep_links import object_construction_button
            buttons.append([object_construction_button(entity_id)])
        else:
            buttons.append([notifications_button("📱 Подробнее")])

        return InlineKeyboardMarkup(inline_keyboard=buttons) if buttons else None
    except Exception:
        return None


async def notify_and_push(
    bot: Bot,
    session: AsyncSession,
    user_id: int,
    type: NotificationType,
    title: str,
    text: str = "",
    entity_type: str = "",
    entity_id: int | None = None,
):
    await create_notification(session, user_id, type, title, text, entity_type, entity_id)
    await send_push(bot, session, user_id, title, text, entity_type, entity_id)


async def get_unread_count(session: AsyncSession, user_id: int) -> int:
    result = await session.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    )
    return result.scalar() or 0


async def get_notifications(session: AsyncSession, user_id: int, limit: int = 20):
    result = await session.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.is_read, Notification.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def mark_read(session: AsyncSession, notification_id: int):
    result = await session.execute(select(Notification).where(Notification.id == notification_id))
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await session.flush()
    return notif
