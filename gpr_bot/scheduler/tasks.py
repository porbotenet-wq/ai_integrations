import asyncio
import logging
from datetime import datetime, date, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, func, and_
from bot.config import get_settings
from bot.db.session import async_session, init_db
from bot.db.models import (
    Task, TaskStatus, User, UserRole, SupplyOrder, SupplyStatus,
    ConstructionObject, ObjectStatus, NotificationType, Notification,
    ObjectRole, DailyPlanFact,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


async def check_overdue_tasks():
    """Mark overdue tasks and notify assignees + project managers."""
    from aiogram import Bot
    from bot.utils.deep_links import object_tasks_button
    from aiogram.types import InlineKeyboardMarkup
    bot = Bot(token=settings.bot_token)

    async with async_session() as session:
        today = date.today()

        # Find tasks past deadline that aren't done/already overdue
        result = await session.execute(
            select(Task).where(
                Task.deadline < today,
                Task.status.notin_([TaskStatus.DONE, TaskStatus.OVERDUE]),
            )
        )
        tasks = result.scalars().all()

        for task in tasks:
            old_status = task.status
            task.status = TaskStatus.OVERDUE
            logger.info(f"Task {task.id} '{task.title}' marked OVERDUE")

            # Notify assignee
            if task.assignee_id:
                notif = Notification(
                    user_id=task.assignee_id,
                    type=NotificationType.TASK_OVERDUE,
                    title=f"🔴 Просрочена: {task.title}",
                    text=f"Дедлайн: {task.deadline.strftime('%d.%m.%Y')}",
                    entity_type="task",
                    entity_id=task.id,
                )
                session.add(notif)

                assignee = await session.get(User, task.assignee_id)
                if assignee:
                    try:
                        kb = InlineKeyboardMarkup(inline_keyboard=[[object_tasks_button(task.object_id)]])
                        await bot.send_message(
                            assignee.telegram_id,
                            f"🔴 <b>Задача просрочена!</b>\n"
                            f"📋 {task.title}\n"
                            f"Дедлайн: {task.deadline.strftime('%d.%m.%Y')}",
                            parse_mode="HTML",
                            reply_markup=kb,
                        )
                    except Exception:
                        pass

            # Notify project managers
            pm_result = await session.execute(
                select(User).where(User.role == UserRole.PROJECT_MANAGER, User.is_active == True)
            )
            for pm in pm_result.scalars().all():
                if pm.id != task.assignee_id:
                    try:
                        await bot.send_message(
                            pm.telegram_id,
                            f"⚠️ <b>Просроченная задача</b>\n"
                            f"📋 {task.title}\n"
                            f"Исполнитель: {(await session.get(User, task.assignee_id)).full_name if task.assignee_id else '—'}",
                            parse_mode="HTML",
                        )
                    except Exception:
                        pass

        await session.commit()
    await bot.session.close()


async def check_delayed_supplies():
    """Check for supplies past expected delivery date."""
    from aiogram import Bot
    bot = Bot(token=settings.bot_token)

    async with async_session() as session:
        today = date.today()
        result = await session.execute(
            select(SupplyOrder).where(
                SupplyOrder.expected_date < today,
                SupplyOrder.status.in_([
                    SupplyStatus.REQUESTED, SupplyStatus.APPROVED,
                    SupplyStatus.ORDERED,
                ]),
            )
        )
        orders = result.scalars().all()

        for order in orders:
            if order.status != SupplyStatus.DELAYED:
                order.status = SupplyStatus.DELAYED

                # Notify PMs
                pm_result = await session.execute(
                    select(User).where(User.role == UserRole.PROJECT_MANAGER, User.is_active == True)
                )
                for pm in pm_result.scalars().all():
                    try:
                        await bot.send_message(
                            pm.telegram_id,
                            f"⚠️ <b>Задержка поставки</b>\n"
                            f"📦 {order.material_name}\n"
                            f"Ожидалось: {order.expected_date.strftime('%d.%m.%Y')}",
                            parse_mode="HTML",
                        )
                    except Exception:
                        pass

        await session.commit()
    await bot.session.close()


async def daily_digest():
    """Send morning digest to project managers."""
    from aiogram import Bot
    bot = Bot(token=settings.bot_token)

    async with async_session() as session:
        # Count active objects, overdue tasks, delayed supplies
        from sqlalchemy import func

        obj_count = (await session.execute(
            select(func.count(ConstructionObject.id)).where(ConstructionObject.status == ObjectStatus.ACTIVE)
        )).scalar() or 0

        overdue_count = (await session.execute(
            select(func.count(Task.id)).where(Task.status == TaskStatus.OVERDUE)
        )).scalar() or 0

        delayed_count = (await session.execute(
            select(func.count(SupplyOrder.id)).where(SupplyOrder.status == SupplyStatus.DELAYED)
        )).scalar() or 0

        text = (
            f"📊 <b>Утренний дайджест</b>\n\n"
            f"🏗 Активных объектов: {obj_count}\n"
            f"🔴 Просроченных задач: {overdue_count}\n"
            f"⚠️ Задержанных поставок: {delayed_count}"
        )

        pm_result = await session.execute(
            select(User).where(User.role.in_([UserRole.PROJECT_MANAGER, UserRole.ADMIN]), User.is_active == True)
        )
        for pm in pm_result.scalars().all():
            try:
                await bot.send_message(pm.telegram_id, text, parse_mode="HTML")
            except Exception:
                pass

    await bot.session.close()


async def deadline_reminders():
    """Напоминания за 24ч и 2ч до дедлайна задачи."""
    from aiogram import Bot
    from bot.utils.deep_links import object_tasks_button
    from aiogram.types import InlineKeyboardMarkup
    bot = Bot(token=settings.bot_token)

    async with async_session() as session:
        now = datetime.utcnow()
        today = date.today()
        tomorrow = today + timedelta(days=1)

        # Tasks with deadline tomorrow (24h reminder)
        result_24h = await session.execute(
            select(Task).where(
                Task.deadline == tomorrow,
                Task.status.notin_([TaskStatus.DONE, TaskStatus.OVERDUE]),
                Task.assignee_id.isnot(None),
            )
        )
        for task in result_24h.scalars().all():
            assignee = await session.get(User, task.assignee_id)
            if not assignee:
                continue

            # Check if already reminded today
            existing = (await session.execute(
                select(func.count(Notification.id)).where(
                    Notification.user_id == assignee.id,
                    Notification.entity_id == task.id,
                    Notification.title.contains("24ч"),
                    Notification.created_at >= datetime.combine(today, datetime.min.time()),
                )
            )).scalar()
            if existing:
                continue

            kb = InlineKeyboardMarkup(inline_keyboard=[[object_tasks_button(task.object_id)]])
            text = (
                f"⏰ <b>Напоминание: 24ч до дедлайна</b>\n\n"
                f"📋 {task.title}\n"
                f"📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}"
            )
            notif = Notification(
                user_id=assignee.id, type="task_overdue",
                title=f"⏰ 24ч до дедлайна: {task.title}",
                text=text, entity_type="task", entity_id=task.id,
            )
            session.add(notif)
            try:
                await bot.send_message(assignee.telegram_id, text, parse_mode="HTML", reply_markup=kb)
            except Exception:
                pass
            logger.info(f"24h reminder sent for task {task.id} to user {assignee.id}")

        # Tasks with deadline today (2h reminder — only between 7-20)
        if 7 <= now.hour <= 20:
            result_2h = await session.execute(
                select(Task).where(
                    Task.deadline == today,
                    Task.status.notin_([TaskStatus.DONE, TaskStatus.OVERDUE]),
                    Task.assignee_id.isnot(None),
                )
            )
            for task in result_2h.scalars().all():
                assignee = await session.get(User, task.assignee_id)
                if not assignee:
                    continue

                existing = (await session.execute(
                    select(func.count(Notification.id)).where(
                        Notification.user_id == assignee.id,
                        Notification.entity_id == task.id,
                        Notification.title.contains("Сегодня"),
                        Notification.created_at >= datetime.combine(today, datetime.min.time()),
                    )
                )).scalar()
                if existing:
                    continue

                kb = InlineKeyboardMarkup(inline_keyboard=[[object_tasks_button(task.object_id)]])
                text = (
                    f"🔴 <b>Дедлайн сегодня!</b>\n\n"
                    f"📋 {task.title}"
                )
                notif = Notification(
                    user_id=assignee.id, type="task_overdue",
                    title=f"🔴 Сегодня дедлайн: {task.title}",
                    text=text, entity_type="task", entity_id=task.id,
                )
                session.add(notif)
                try:
                    await bot.send_message(assignee.telegram_id, text, parse_mode="HTML", reply_markup=kb)
                except Exception:
                    pass

        await session.commit()
    await bot.session.close()


async def escalation_check():
    """Эскалация просроченных задач: 1д → исполнитель, 3д → PM, 7д → директор."""
    from aiogram import Bot
    from bot.utils.deep_links import object_tasks_button
    from aiogram.types import InlineKeyboardMarkup
    bot = Bot(token=settings.bot_token)

    async with async_session() as session:
        today = date.today()

        result = await session.execute(
            select(Task).where(Task.status == TaskStatus.OVERDUE, Task.deadline.isnot(None))
        )
        for task in result.scalars().all():
            days_overdue = (today - task.deadline).days
            if days_overdue <= 0:
                continue

            kb = InlineKeyboardMarkup(inline_keyboard=[[object_tasks_button(task.object_id)]])

            # 1 day — re-notify assignee
            if days_overdue == 1 and task.assignee_id:
                assignee = await session.get(User, task.assignee_id)
                if assignee:
                    text = (
                        f"🔴 <b>Просрочено 1 день</b>\n\n"
                        f"📋 {task.title}\n"
                        f"Дедлайн был: {task.deadline.strftime('%d.%m.%Y')}"
                    )
                    try:
                        await bot.send_message(assignee.telegram_id, text, parse_mode="HTML", reply_markup=kb)
                    except Exception:
                        pass

            # 3 days — escalate to PM
            if days_overdue == 3:
                pms = await session.execute(
                    select(User).join(ObjectRole, ObjectRole.user_id == User.id).where(
                        ObjectRole.object_id == task.object_id,
                        ObjectRole.role.in_([UserRole.PROJECT_MANAGER, UserRole.ADMIN]),
                    )
                )
                assignee = await session.get(User, task.assignee_id) if task.assignee_id else None
                for pm in pms.scalars().all():
                    text = (
                        f"⚠️ <b>Эскалация: 3 дня просрочки</b>\n\n"
                        f"📋 {task.title}\n"
                        f"👤 Исполнитель: {assignee.full_name if assignee else '—'}\n"
                        f"Дедлайн: {task.deadline.strftime('%d.%m.%Y')}"
                    )
                    notif = Notification(
                        user_id=pm.id, type="escalation",
                        title=f"⚠️ Эскалация: {task.title}",
                        text=text, entity_type="task", entity_id=task.id,
                    )
                    session.add(notif)
                    try:
                        await bot.send_message(pm.telegram_id, text, parse_mode="HTML", reply_markup=kb)
                    except Exception:
                        pass

            # 7 days — escalate to director
            if days_overdue == 7:
                directors = await session.execute(
                    select(User).where(
                        User.role.in_([UserRole.DIRECTOR, UserRole.ADMIN]),
                        User.is_active == True,
                    )
                )
                assignee = await session.get(User, task.assignee_id) if task.assignee_id else None
                for director in directors.scalars().all():
                    text = (
                        f"🚨 <b>Критическая эскалация: 7 дней просрочки</b>\n\n"
                        f"📋 {task.title}\n"
                        f"👤 Исполнитель: {assignee.full_name if assignee else '—'}\n"
                        f"Дедлайн: {task.deadline.strftime('%d.%m.%Y')}"
                    )
                    notif = Notification(
                        user_id=director.id, type="escalation",
                        title=f"🚨 Критическая: {task.title}",
                        text=text, entity_type="task", entity_id=task.id,
                    )
                    session.add(notif)
                    try:
                        await bot.send_message(director.telegram_id, text, parse_mode="HTML", reply_markup=kb)
                    except Exception:
                        pass

        await session.commit()
    await bot.session.close()


async def check_missing_fact():
    """Напоминание прорабам о незаполненном факте за вчера."""
    from aiogram import Bot
    bot = Bot(token=settings.bot_token)

    async with async_session() as session:
        yesterday = date.today() - timedelta(days=1)

        # Get active objects
        objs = (await session.execute(
            select(ConstructionObject).where(ConstructionObject.status == ObjectStatus.ACTIVE)
        )).scalars().all()

        for obj in objs:
            # Check if any fact was entered yesterday
            fact_count = (await session.execute(
                select(func.count(DailyPlanFact.id)).where(
                    DailyPlanFact.object_id == obj.id,
                    DailyPlanFact.date == yesterday,
                    DailyPlanFact.fact_volume > 0,
                )
            )).scalar() or 0

            if fact_count > 0:
                continue

            # Notify construction ITRs and PMs on this object
            users = (await session.execute(
                select(User).join(ObjectRole, ObjectRole.user_id == User.id).where(
                    ObjectRole.object_id == obj.id,
                    ObjectRole.role.in_([
                        UserRole.CONSTRUCTION_ITR, UserRole.PROJECT_MANAGER,
                    ]),
                )
            )).scalars().all()

            for user in users:
                text = (
                    f"📝 <b>Не заполнен факт за {yesterday.strftime('%d.%m.%Y')}</b>\n\n"
                    f"🏗 {obj.name}\n"
                    f"Используйте /fact для ввода данных"
                )
                try:
                    await bot.send_message(user.telegram_id, text, parse_mode="HTML")
                except Exception:
                    pass

            if users:
                logger.info(f"Missing fact reminder sent for object {obj.id} ({len(users)} users)")

    await bot.session.close()


async def main():
    await init_db()

    scheduler = AsyncIOScheduler()

    # Check deadlines every hour
    scheduler.add_job(check_overdue_tasks, "interval", seconds=settings.check_deadlines_interval)

    # Check supply delays every 2 hours
    scheduler.add_job(check_delayed_supplies, "interval", hours=2)

    # Daily digest at configured hour
    scheduler.add_job(daily_digest, "cron", hour=settings.digest_hour, minute=0)

    # Deadline reminders — every 2 hours during work hours
    scheduler.add_job(deadline_reminders, "cron", hour="7,9,11,13,15,17", minute=0)

    # Escalation check — twice daily
    scheduler.add_job(escalation_check, "cron", hour="9,15", minute=30)

    # Missing fact reminder — every morning at 8:30
    scheduler.add_job(check_missing_fact, "cron", hour=8, minute=30)

    scheduler.start()
    logger.info("Scheduler started")

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
