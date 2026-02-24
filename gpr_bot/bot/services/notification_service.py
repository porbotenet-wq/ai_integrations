from aiogram import Bot
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


async def send_push(bot: Bot, session: AsyncSession, user_id: int, title: str, text: str = ""):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return
    try:
        message = f"🔔 <b>{title}</b>"
        if text:
            message += f"\n{text}"
        await bot.send_message(user.telegram_id, message, parse_mode="HTML")
    except Exception:
        pass


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
    await send_push(bot, session, user_id, title, text)


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
