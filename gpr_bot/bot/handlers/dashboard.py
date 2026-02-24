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
from bot.utils.formatters import LINE, progress_bar, fmt_date, days_until

router = Router()


@router.message(F.text.startswith("📊"))
async def dashboard(message: Message, db_user: User | None, session):
    if not db_user or not db_user.is_active:
        await message.answer("⚠️ /start")
        return

    active = (await session.execute(
        select(func.count(ConstructionObject.id))
        .where(ConstructionObject.status == ObjectStatus.ACTIVE)
    )).scalar() or 0

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

    delayed = (await session.execute(
        select(func.count(SupplyOrder.id)).where(SupplyOrder.status == SupplyStatus.DELAYED)
    )).scalar() or 0

    from datetime import date
    today_facts = (await session.execute(
        select(func.count(DailyPlanFact.id))
        .where(DailyPlanFact.date == date.today())
    )).scalar() or 0

    pct = round(done_tasks / total_tasks * 100) if total_tasks > 0 else 0

    text = (
        f"{'─' * 30}\n"
        f"  📊  <b>Д А Ш Б О Р Д</b>\n"
        f"{'─' * 30}\n"
        f"\n"
        f"  🏗  Объектов       <b>{active}</b>\n"
        f"\n"
        f"  <b>Задачи</b>\n"
        f"  {'┄' * 24}\n"
        f"  📋  Всего          <b>{total_tasks}</b>\n"
        f"  ✅  Выполнено      <b>{done_tasks}</b>\n"
        f"  🔵  В работе       <b>{in_progress}</b>\n"
        f"  🔴  Просрочено     <b>{overdue_tasks}</b>\n"
        f"\n"
        f"  {progress_bar(pct)}\n"
        f"\n"
        f"  <b>Поставки</b>\n"
        f"  {'┄' * 24}\n"
        f"  🔴  Задержки       <b>{delayed}</b>\n"
        f"\n"
        f"  <b>Сегодня</b>\n"
        f"  {'┄' * 24}\n"
        f"  📝  Записей факта  <b>{today_facts}</b>\n"
        f"{'─' * 30}"
    )

    await message.answer(text, parse_mode="HTML")


@router.message(Command("help"))
async def cmd_help(message: Message, db_user: User | None, **kwargs):
    text = (
        f"{'─' * 30}\n"
        f"  ❓  <b>С П Р А В К А</b>\n"
        f"{'─' * 30}\n"
        f"\n"
        f"  <b>Основные</b>\n"
        f"  /start    Главное меню\n"
        f"  /fact     Ввод факта\n"
        f"  /newtask  Создать задачу\n"
        f"  /report   Отчёт\n"
        f"  /help     Справка\n"
        f"\n"
        f"  <b>Администрирование</b>\n"
        f"  /admin      Панель\n"
        f"  /viewas     Просмотр от роли\n"
        f"  /newobject  Создать объект\n"
        f"\n"
        f"  <b>Mini App</b>\n"
        f"  Кнопка «STSphera» внизу\n"
        f"  для полного интерфейса\n"
        f"{'─' * 30}"
    )
    await message.answer(text, parse_mode="HTML")


@router.message(Command("report"))
async def cmd_report(message: Message, db_user: User | None, session):
    if not db_user or not db_user.is_active:
        await message.answer("⚠️ /start")
        return

    objs = (await session.execute(
        select(ConstructionObject)
        .where(ConstructionObject.status.in_([ObjectStatus.ACTIVE, ObjectStatus.PLANNING]))
        .order_by(ConstructionObject.name)
    )).scalars().all()

    if not objs:
        await message.answer("Нет активных объектов.")
        return

    from datetime import date

    parts = [
        f"{'─' * 30}",
        f"  📊  <b>О Т Ч Ё Т</b>",
        f"  {date.today().strftime('%d.%m.%Y')}",
        f"{'─' * 30}",
    ]

    for obj in objs:
        t_total = (await session.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id)
        )).scalar() or 0
        t_done = (await session.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id, Task.status == TaskStatus.DONE)
        )).scalar() or 0
        t_overdue = (await session.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id, Task.status == TaskStatus.OVERDUE)
        )).scalar() or 0

        today_vol = (await session.execute(
            select(func.sum(DailyPlanFact.fact_volume))
            .where(DailyPlanFact.object_id == obj.id, DailyPlanFact.date == date.today())
        )).scalar() or 0

        pct = round(t_done / t_total * 100) if t_total > 0 else 0
        dl = days_until(obj.deadline_date)

        parts.append(f"\n  🏗 <b>{obj.name}</b>")
        parts.append(f"  {progress_bar(pct)}")
        parts.append(f"  ✅ {t_done}/{t_total} задач")
        if t_overdue:
            parts.append(f"  🔴 {t_overdue} просрочено")
        if obj.deadline_date:
            parts.append(f"  📅 {fmt_date(obj.deadline_date)}  {dl}")
        if today_vol:
            parts.append(f"  📝 Факт сегодня: {today_vol}")
        parts.append(f"  {'┄' * 24}")

    parts.append(f"{'─' * 30}")

    await message.answer("\n".join(parts), parse_mode="HTML")
