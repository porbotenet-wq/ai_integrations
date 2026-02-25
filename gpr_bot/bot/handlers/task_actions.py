"""
Task acceptance handler — Принять/Отклонить назначенную задачу.
Callback data: task_accept:<id>, task_reject:<id>
"""
from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from sqlalchemy import select
from bot.db.models import User, Task, TaskStatus, TaskComment
from bot.db.session import async_session
from bot.utils.deep_links import object_tasks_button
from aiogram.types import InlineKeyboardMarkup

router = Router()


class RejectForm(StatesGroup):
    reason = State()


@router.callback_query(F.data.startswith("task_accept:"))
async def accept_task(callback: CallbackQuery):
    task_id = int(callback.data.split(":")[1])

    async with async_session() as db:
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
        if not task:
            await callback.answer("Задача не найдена", show_alert=True)
            return

        user = (await db.execute(
            select(User).where(User.telegram_id == callback.from_user.id)
        )).scalar_one_or_none()

        if not user or user.id != task.assignee_id:
            await callback.answer("Эта задача назначена не вам", show_alert=True)
            return

        if task.status not in (TaskStatus.NEW, TaskStatus.ASSIGNED):
            await callback.answer(f"Задача уже в статусе: {task.status.value}", show_alert=True)
            return

        old_status = task.status.value
        task.status = TaskStatus.IN_PROGRESS
        await db.commit()

        # Notify creator
        try:
            from bot.services.event_engine import on_task_status_changed
            await on_task_status_changed(db, task, old_status, changed_by=user)
        except Exception:
            pass

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [object_tasks_button(task.object_id)],
    ])

    await callback.message.edit_text(
        f"✅ <b>Задача принята</b>\n\n"
        f"<b>{task.title}</b>\n"
        f"Статус: В работе",
        parse_mode="HTML",
        reply_markup=kb,
    )
    await callback.answer("Задача принята ✅")


@router.callback_query(F.data.startswith("task_reject:"))
async def reject_task(callback: CallbackQuery, state: FSMContext):
    task_id = int(callback.data.split(":")[1])

    async with async_session() as db:
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
        if not task:
            await callback.answer("Задача не найдена", show_alert=True)
            return

        user = (await db.execute(
            select(User).where(User.telegram_id == callback.from_user.id)
        )).scalar_one_or_none()

        if not user or user.id != task.assignee_id:
            await callback.answer("Эта задача назначена не вам", show_alert=True)
            return

    await state.update_data(reject_task_id=task_id)
    await state.set_state(RejectForm.reason)

    await callback.message.edit_text(
        f"❌ <b>Отклонение задачи</b>\n\n"
        f"<b>{task.title}</b>\n\n"
        f"Напишите причину отклонения:",
        parse_mode="HTML",
    )
    await callback.answer()


@router.message(RejectForm.reason)
async def reject_reason(message: Message, state: FSMContext):
    data = await state.get_data()
    task_id = data.get("reject_task_id")
    reason = message.text.strip()

    if not task_id:
        await state.clear()
        return

    async with async_session() as db:
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
        if not task:
            await message.answer("Задача не найдена.")
            await state.clear()
            return

        user = (await db.execute(
            select(User).where(User.telegram_id == message.from_user.id)
        )).scalar_one_or_none()

        # Reset assignee, add comment with reason
        old_assignee_id = task.assignee_id
        task.assignee_id = None
        task.status = TaskStatus.NEW

        comment = TaskComment(
            task_id=task.id,
            user_id=user.id if user else None,
            text=f"❌ Отклонено: {reason}",
        )
        db.add(comment)
        await db.commit()

        # Notify creator
        if task.created_by_id:
            creator = await db.get(User, task.created_by_id)
            if creator:
                try:
                    from aiogram import Bot
                    from bot.config import get_settings
                    bot = Bot(token=get_settings().bot_token)
                    kb = InlineKeyboardMarkup(inline_keyboard=[
                        [object_tasks_button(task.object_id)],
                    ])
                    assignee_name = user.full_name if user else "Исполнитель"
                    await bot.send_message(
                        creator.telegram_id,
                        f"❌ <b>Задача отклонена</b>\n\n"
                        f"<b>{task.title}</b>\n"
                        f"Отклонил: {assignee_name}\n"
                        f"Причина: {reason}",
                        parse_mode="HTML",
                        reply_markup=kb,
                    )
                    await bot.session.close()
                except Exception:
                    pass

    await state.clear()
    await message.answer(
        f"❌ Задача отклонена.\n"
        f"Создатель получит уведомление.",
    )
