"""Handler: /fact — ввод факта выполнения работ (прораб, бригадир)"""
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy import select, func
from datetime import date

from bot.states.forms import FactForm
from bot.db.session import async_session
from bot.db.models import (
    ConstructionObject, ObjectStatus, WorkType, Crew,
    DailyPlanFact, ObjectRole, User,
)

router = Router()


# ─── /fact ───────────────────────────────────────────────

@router.message(Command("fact"))
async def cmd_fact(message: Message, state: FSMContext):
    """Начало ввода факта"""
    async with async_session() as db:
        # Найти пользователя
        result = await db.execute(
            select(User).where(User.telegram_id == message.from_user.id)
        )
        user = result.scalar_one_or_none()
        if not user:
            await message.answer("❌ Вы не зарегистрированы в системе.")
            return

        # Объекты пользователя (по object_roles или все для admin)
        if user.role.value == "admin":
            objs = (await db.execute(
                select(ConstructionObject)
                .where(ConstructionObject.status == ObjectStatus.ACTIVE)
            )).scalars().all()
        else:
            obj_ids = (await db.execute(
                select(ObjectRole.object_id).where(ObjectRole.user_id == user.id)
            )).scalars().all()
            if not obj_ids:
                await message.answer("❌ У вас нет привязанных объектов.")
                return
            objs = (await db.execute(
                select(ConstructionObject)
                .where(ConstructionObject.id.in_(obj_ids))
                .where(ConstructionObject.status == ObjectStatus.ACTIVE)
            )).scalars().all()

        if not objs:
            await message.answer("❌ Нет активных объектов.")
            return

        await state.update_data(user_id=user.id)

        if len(objs) == 1:
            # Один объект — пропускаем выбор
            await state.update_data(object_id=objs[0].id, object_name=objs[0].name)
            await show_work_types(message, state)
            return

        kb = InlineKeyboardBuilder()
        for obj in objs:
            kb.button(text=obj.name[:40], callback_data=f"fact_obj:{obj.id}")
        kb.adjust(1)

        await message.answer("🏗 Выберите объект:", reply_markup=kb.as_markup())
        await state.set_state(FactForm.select_object)


@router.callback_query(FactForm.select_object, F.data.startswith("fact_obj:"))
async def on_select_object(callback: CallbackQuery, state: FSMContext):
    object_id = int(callback.data.split(":")[1])
    async with async_session() as db:
        obj = await db.get(ConstructionObject, object_id)
        await state.update_data(object_id=object_id, object_name=obj.name if obj else "?")

    await callback.answer()
    await show_work_types(callback.message, state)


async def show_work_types(message: Message, state: FSMContext):
    """Показать виды работ"""
    async with async_session() as db:
        wts = (await db.execute(
            select(WorkType).order_by(WorkType.sequence_order)
        )).scalars().all()

    if not wts:
        await message.answer("❌ Виды работ не настроены.")
        await state.clear()
        return

    kb = InlineKeyboardBuilder()
    for wt in wts:
        kb.button(text=f"{wt.code} {wt.name}", callback_data=f"fact_wt:{wt.id}")
    kb.adjust(1)

    await message.answer("🔧 Вид работы:", reply_markup=kb.as_markup())
    await state.set_state(FactForm.select_work_type)


@router.callback_query(FactForm.select_work_type, F.data.startswith("fact_wt:"))
async def on_select_work_type(callback: CallbackQuery, state: FSMContext):
    wt_id = int(callback.data.split(":")[1])
    async with async_session() as db:
        wt = await db.get(WorkType, wt_id)
        await state.update_data(
            work_type_id=wt_id,
            work_code=wt.code if wt else "",
            work_name=wt.name if wt else "",
            unit=wt.unit if wt else "шт",
        )

    await callback.answer()
    await callback.message.answer("🏢 Этаж (число):")
    await state.set_state(FactForm.select_floor)


@router.message(FactForm.select_floor)
async def on_floor(message: Message, state: FSMContext):
    try:
        floor = int(message.text.strip())
    except ValueError:
        await message.answer("❌ Введите число (этаж):")
        return

    await state.update_data(floor=floor)

    kb = InlineKeyboardBuilder()
    for facade in ["Север", "Юг", "Восток", "Запад", "Все"]:
        kb.button(text=facade, callback_data=f"fact_facade:{facade}")
    kb.adjust(3)

    await message.answer("🧭 Фасад:", reply_markup=kb.as_markup())
    await state.set_state(FactForm.select_facade)


@router.callback_query(FactForm.select_facade, F.data.startswith("fact_facade:"))
async def on_facade(callback: CallbackQuery, state: FSMContext):
    facade = callback.data.split(":")[1]
    data = await state.get_data()
    unit = data.get("unit", "шт")

    await state.update_data(facade=facade)
    await callback.answer()
    await callback.message.answer(f"📊 Объём выполнения ({unit}):")
    await state.set_state(FactForm.enter_volume)


@router.message(FactForm.enter_volume)
async def on_volume(message: Message, state: FSMContext):
    try:
        volume = float(message.text.strip().replace(",", "."))
    except ValueError:
        await message.answer("❌ Введите число:")
        return

    await state.update_data(fact_volume=volume)
    await message.answer("👷 Кол-во рабочих (или 0 если неизвестно):")
    await state.set_state(FactForm.enter_workers)


@router.message(FactForm.enter_workers)
async def on_workers(message: Message, state: FSMContext):
    try:
        workers = int(message.text.strip())
    except ValueError:
        workers = 0

    await state.update_data(workers_count=workers)
    await message.answer("📝 Примечание (или - чтобы пропустить):")
    await state.set_state(FactForm.enter_notes)


@router.message(FactForm.enter_notes)
async def on_notes(message: Message, state: FSMContext):
    notes = message.text.strip()
    if notes == "-":
        notes = ""
    await state.update_data(notes=notes)

    data = await state.get_data()

    # Подтверждение
    text = (
        f"📋 <b>Подтверждение факта</b>\n\n"
        f"🏗 Объект: {data.get('object_name')}\n"
        f"🔧 Работа: {data.get('work_code')} — {data.get('work_name')}\n"
        f"🏢 Этаж: {data.get('floor')}\n"
        f"🧭 Фасад: {data.get('facade')}\n"
        f"📊 Объём: {data.get('fact_volume')} {data.get('unit')}\n"
        f"👷 Рабочих: {data.get('workers_count')}\n"
        f"📝 Примечание: {notes or '—'}\n"
        f"📅 Дата: {date.today().isoformat()}"
    )

    kb = InlineKeyboardBuilder()
    kb.button(text="✅ Сохранить", callback_data="fact_save")
    kb.button(text="❌ Отмена", callback_data="fact_cancel")
    kb.adjust(2)

    await message.answer(text, reply_markup=kb.as_markup(), parse_mode="HTML")
    await state.set_state(FactForm.confirm)


@router.callback_query(FactForm.confirm, F.data == "fact_save")
async def on_save(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()

    async with async_session() as db:
        record = DailyPlanFact(
            object_id=data["object_id"],
            date=date.today(),
            work_name=data.get("work_name"),
            work_code=data.get("work_code"),
            work_type_id=data.get("work_type_id"),
            fact_volume=data.get("fact_volume", 0),
            unit=data.get("unit"),
            floor=data.get("floor"),
            facade=data.get("facade"),
            workers_count=data.get("workers_count"),
            notes=data.get("notes"),
            executor_id=data.get("user_id"),
        )
        db.add(record)
        await db.commit()

    await callback.answer("✅ Сохранено!")
    await callback.message.edit_text(
        callback.message.text + "\n\n✅ <b>Записано в систему</b>",
        parse_mode="HTML",
    )
    await state.clear()


@router.callback_query(FactForm.confirm, F.data == "fact_cancel")
async def on_cancel(callback: CallbackQuery, state: FSMContext):
    await callback.answer("Отменено")
    await callback.message.edit_text("❌ Ввод факта отменён.")
    await state.clear()
