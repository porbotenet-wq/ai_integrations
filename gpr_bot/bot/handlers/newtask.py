"""Handler: /newtask — создание задачи через бота"""
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy import select
from datetime import datetime

from bot.states.forms import CreateTaskForm
from bot.db.session import async_session
from bot.db.models import (
    User, ConstructionObject, ObjectStatus, Task, TaskStatus,
    Department, ObjectRole,
)
from bot.rbac.permissions import has_permission, DEPARTMENT_NAMES

router = Router()


@router.message(Command("newtask"))
async def cmd_newtask(message: Message, db_user: User | None, state: FSMContext):
    if not db_user or not db_user.is_active:
        await message.answer("⚠️ Авторизуйтесь: /start")
        return

    if not has_permission(db_user.role, "task.create"):
        await message.answer("❌ Нет прав на создание задач.")
        return

    async with async_session() as db:
        if db_user.role.value == "admin":
            objs = (await db.execute(
                select(ConstructionObject)
                .where(ConstructionObject.status == ObjectStatus.ACTIVE)
            )).scalars().all()
        else:
            obj_ids = (await db.execute(
                select(ObjectRole.object_id).where(ObjectRole.user_id == db_user.id)
            )).scalars().all()
            objs = (await db.execute(
                select(ConstructionObject)
                .where(ConstructionObject.id.in_(obj_ids))
                .where(ConstructionObject.status == ObjectStatus.ACTIVE)
            )).scalars().all() if obj_ids else []

    if not objs:
        await message.answer("❌ Нет активных объектов.")
        return

    await state.update_data(user_id=db_user.id)

    if len(objs) == 1:
        await state.update_data(object_id=objs[0].id, object_name=objs[0].name)
        await message.answer("📝 Название задачи:")
        await state.set_state(CreateTaskForm.title)
        return

    kb = InlineKeyboardBuilder()
    for obj in objs:
        kb.button(text=obj.name[:40], callback_data=f"newtask_obj:{obj.id}")
    kb.adjust(1)
    await message.answer("🏗 Выберите объект:", reply_markup=kb.as_markup())
    await state.set_state(CreateTaskForm.select_object)


@router.callback_query(CreateTaskForm.select_object, F.data.startswith("newtask_obj:"))
async def on_select_object(callback: CallbackQuery, state: FSMContext):
    object_id = int(callback.data.split(":")[1])
    async with async_session() as db:
        obj = await db.get(ConstructionObject, object_id)
        await state.update_data(object_id=object_id, object_name=obj.name if obj else "?")
    await callback.answer()
    await callback.message.answer("📝 Название задачи:")
    await state.set_state(CreateTaskForm.title)


@router.message(CreateTaskForm.title)
async def on_title(message: Message, state: FSMContext):
    await state.update_data(title=message.text.strip())
    await message.answer("📄 Описание (или - чтобы пропустить):")
    await state.set_state(CreateTaskForm.description)


@router.message(CreateTaskForm.description)
async def on_description(message: Message, state: FSMContext):
    desc = message.text.strip()
    if desc == "-":
        desc = ""
    await state.update_data(description=desc)

    kb = InlineKeyboardBuilder()
    for dept in Department:
        name = DEPARTMENT_NAMES.get(dept, dept.value)
        kb.button(text=name, callback_data=f"newtask_dept:{dept.value}")
    kb.adjust(2)
    await message.answer("🏢 Отдел:", reply_markup=kb.as_markup())
    await state.set_state(CreateTaskForm.department)


@router.callback_query(CreateTaskForm.department, F.data.startswith("newtask_dept:"))
async def on_department(callback: CallbackQuery, state: FSMContext):
    dept = callback.data.split(":")[1]
    dept_name = DEPARTMENT_NAMES.get(Department(dept), dept)
    await state.update_data(department=dept, department_name=dept_name)
    await callback.answer()
    await callback.message.answer("📅 Дедлайн (ДД.ММ.ГГГГ или - без дедлайна):")
    await state.set_state(CreateTaskForm.deadline)


@router.message(CreateTaskForm.deadline)
async def on_deadline(message: Message, state: FSMContext):
    text = message.text.strip()
    deadline = None
    if text != "-":
        try:
            deadline = datetime.strptime(text, "%d.%m.%Y").date()
        except ValueError:
            await message.answer("❌ Формат: ДД.ММ.ГГГГ (например 15.03.2026)")
            return

    await state.update_data(deadline=deadline.isoformat() if deadline else None)

    data = await state.get_data()
    text = (
        f"📋 <b>Новая задача</b>\n\n"
        f"🏗 Объект: {data.get('object_name')}\n"
        f"📝 {data.get('title')}\n"
        f"📄 {data.get('description') or '—'}\n"
        f"🏢 {data.get('department_name')}\n"
        f"📅 Дедлайн: {text if deadline else '—'}\n"
    )

    kb = InlineKeyboardBuilder()
    kb.button(text="✅ Создать", callback_data="newtask_save")
    kb.button(text="❌ Отмена", callback_data="newtask_cancel")
    kb.adjust(2)

    await message.answer(text, reply_markup=kb.as_markup(), parse_mode="HTML")
    await state.set_state(CreateTaskForm.confirm)


@router.callback_query(CreateTaskForm.confirm, F.data == "newtask_save")
async def on_save(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()

    async with async_session() as db:
        task = Task(
            object_id=data["object_id"],
            title=data["title"],
            description=data.get("description"),
            department=Department(data["department"]),
            status=TaskStatus.NEW,
            creator_id=data["user_id"],
            deadline=datetime.fromisoformat(data["deadline"]).date() if data.get("deadline") else None,
        )
        db.add(task)
        await db.commit()

    await callback.answer("✅ Задача создана!")
    await callback.message.edit_text(
        callback.message.text + "\n\n✅ <b>Задача создана</b>",
        parse_mode="HTML",
    )
    await state.clear()


@router.callback_query(CreateTaskForm.confirm, F.data == "newtask_cancel")
async def on_cancel(callback: CallbackQuery, state: FSMContext):
    await callback.answer("Отменено")
    await callback.message.edit_text("❌ Создание задачи отменено.")
    await state.clear()
