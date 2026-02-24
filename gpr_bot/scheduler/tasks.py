import asyncio
import logging
from datetime import datetime, date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from bot.config import get_settings
from bot.db.session import async_session, init_db
from bot.db.models import (
    Task, TaskStatus, User, UserRole, SupplyOrder, SupplyStatus,
    ConstructionObject, ObjectStatus, NotificationType, Notification,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


async def check_overdue_tasks():
    """Mark overdue tasks and notify assignees + project managers."""
    from aiogram import Bot
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
                        await bot.send_message(
                            assignee.telegram_id,
                            f"🔴 <b>Задача просрочена!</b>\n"
                            f"📋 {task.title}\n"
                            f"Дедлайн: {task.deadline.strftime('%d.%m.%Y')}",
                            parse_mode="HTML",
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


async def main():
    await init_db()

    scheduler = AsyncIOScheduler()

    # Check deadlines every hour
    scheduler.add_job(check_overdue_tasks, "interval", seconds=settings.check_deadlines_interval)

    # Check supply delays every 2 hours
    scheduler.add_job(check_delayed_supplies, "interval", hours=2)

    # Daily digest at configured hour
    scheduler.add_job(daily_digest, "cron", hour=settings.digest_hour, minute=0)

    scheduler.start()
    logger.info("Scheduler started")

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
