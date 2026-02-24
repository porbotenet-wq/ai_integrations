"""Handler: 📊 Дашборд, /help, /report"""
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select, func
from bot.db.models import (
    User, ConstructionObject, ObjectStatus, Task, TaskStatus,
    SupplyOrder, SupplyStatus, DailyPlanFact,
)
from bot.db.session import async_session
from bot.keyboards.main_menu import BTN_DASHBOARD

router = Router()


# ─── 📊 Дашборд ─────────────────────────────────────────

@router.message(F.text.startswith("📊"))
async def dashboard(message: Message, db_user: User | None, session):
    if not db_user or not db_user.is_active:
        await message.answer("⚠️ Авторизуйтесь: /start")
        return

    # Active objects
    active = (await session.execute(
        select(func.count(ConstructionObject.id))
        .where(ConstructionObject.status == ObjectStatus.ACTIVE)
    )).scalar() or 0

    # Tasks stats
    total_tasks = (await session.execute(select(func.count(Task.id)))).scalar() or 0
    done_tasks = (await session.execute(
        select(func.count(Task.id)).where(Task.status == TaskStatus.DONE)
    )).scalar() or 0
    overdue_tasks = (await session.execute(
        select(func.count(Task.id)).where(Task.status == TaskStatus.OVERDUE)
    )).scalar() or 0
    in_progress = (await session.execute(
        select(func.count(Task.id)).where(Task.status == TaskStatus.IN_PROGRESS)
    )).scalar() or 0

    # Supply delays
    delayed = (await session.execute(
        select(func.count(SupplyOrder.id)).where(SupplyOrder.status == SupplyStatus.DELAYED)
    )).scalar() or 0

    # Today's fact entries
    from datetime import date
    today_facts = (await session.execute(
        select(func.count(DailyPlanFact.id))
        .where(DailyPlanFact.date == date.today())
    )).scalar() or 0

    pct = round(done_tasks / total_tasks * 100) if total_tasks > 0 else 0

    text = (
        f"📊 <b>Дашборд</b>\n\n"
        f"🏗 Активных объектов: <b>{active}</b>\n\n"
        f"<b>Задачи</b>\n"
        f"  📋 Всего: {total_tasks}\n"
        f"  ✅ Выполнено: {done_tasks} ({pct}%)\n"
        f"  🔄 В работе: {in_progress}\n"
        f"  ⚠️ Просрочено: {overdue_tasks}\n\n"
        f"<b>Поставки</b>\n"
        f"  🚚 Задержки: {delayed}\n\n"
        f"<b>Сегодня</b>\n"
        f"  📝 Записей факта: {today_facts}\n"
    )

    await message.answer(text, parse_mode="HTML")


# ─── /help ───────────────────────────────────────────────

@router.message(Command("help"))
async def cmd_help(message: Message, db_user: User | None, **kwargs):
    text = (
        "📖 <b>Справка по командам</b>\n\n"
        "<b>Основные:</b>\n"
        "/start — Главное меню\n"
        "/help — Эта справка\n"
        "/fact — Ввод факта выполнения\n\n"
        "<b>Навигация (кнопки):</b>\n"
        "📋 Мои объекты — список объектов\n"
        "⚡ Мои задачи — ваши задачи\n"
        "🔔 Уведомления — непрочитанные\n"
        "📊 Дашборд — сводка по проекту\n\n"
        "<b>Админ:</b>\n"
        "/admin — Панель администратора\n"
        "/viewas — Просмотр от лица роли\n"
        "/newobject — Создать объект\n"
        "/newtask — Создать задачу\n"
        "/report — Отчёт по объекту\n\n"
        "<b>Mini App:</b>\n"
        "Нажмите кнопку «STSphera» внизу для полного интерфейса."
    )
    await message.answer(text, parse_mode="HTML")


# ─── /report ─────────────────────────────────────────────

@router.message(Command("report"))
async def cmd_report(message: Message, db_user: User | None, session):
    if not db_user or not db_user.is_active:
        await message.answer("⚠️ Авторизуйтесь: /start")
        return

    # Get active objects
    objs = (await session.execute(
        select(ConstructionObject)
        .where(ConstructionObject.status.in_([ObjectStatus.ACTIVE, ObjectStatus.PLANNING]))
        .order_by(ConstructionObject.name)
    )).scalars().all()

    if not objs:
        await message.answer("📊 Нет активных объектов для отчёта.")
        return

    from datetime import date
    parts = [f"📊 <b>Отчёт на {date.today().isoformat()}</b>\n"]

    for obj in objs:
        # Tasks
        t_total = (await session.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id)
        )).scalar() or 0
        t_done = (await session.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id, Task.status == TaskStatus.DONE)
        )).scalar() or 0
        t_overdue = (await session.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id, Task.status == TaskStatus.OVERDUE)
        )).scalar() or 0

        # Today facts
        today_vol = (await session.execute(
            select(func.sum(DailyPlanFact.fact_volume))
            .where(DailyPlanFact.object_id == obj.id, DailyPlanFact.date == date.today())
        )).scalar() or 0

        pct = round(t_done / t_total * 100) if t_total > 0 else 0
        deadline = obj.deadline_date.isoformat() if obj.deadline_date else "—"

        parts.append(
            f"\n<b>🏗 {obj.name}</b>\n"
            f"  📅 Дедлайн: {deadline}\n"
            f"  📋 Задачи: {t_done}/{t_total} ({pct}%)"
            f"{f'  ⚠️ {t_overdue} просрочено' if t_overdue else ''}\n"
            f"  📝 Факт сегодня: {today_vol}"
        )

    await message.answer("\n".join(parts), parse_mode="HTML")
