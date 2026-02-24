from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from bot.db.models import User, TaskStatus, NotificationType
from bot.keyboards.main_menu import BTN_TASKS
from bot.keyboards.tasks import tasks_list_kb, task_detail_kb
from bot.utils.callbacks import TaskCB, NavCB
from bot.utils.formatters import format_task_card
from bot.services.task_service import (
    get_user_tasks, get_task_by_id, transition_task,
    add_comment, reassign_task,
)
from bot.services.notification_service import notify_and_push
from bot.services.audit_service import log_action
from bot.states.forms import CommentForm, BlockedForm, DelegateForm

router = Router()


def _require_auth(db_user: User | None) -> User | None:
    if db_user is None or not db_user.is_active:
        return None
    return db_user


# ─── REPLY BUTTON: My Tasks ─────────────────────────────

@router.message(F.text.startswith("⚡"))
async def my_tasks(message: Message, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await message.answer("⚠️ Необходимо авторизоваться: /start")
        return

    tasks = await get_user_tasks(session, user)
    if not tasks:
        await message.answer("⚡ У вас нет активных задач.")
        return

    overdue = sum(1 for t in tasks if t.status == TaskStatus.OVERDUE)
    text = f"⚡ <b>Мои задачи</b> ({len(tasks)})"
    if overdue:
        text += f" | 🔴 Просрочено: {overdue}"

    await message.answer(text, reply_markup=tasks_list_kb(tasks), parse_mode="HTML")


# ─── CALLBACK: Task list pagination ──────────────────────

@router.callback_query(TaskCB.filter(F.action == "list"))
async def tasks_list_page(callback: CallbackQuery, callback_data: TaskCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    tasks = await get_user_tasks(session, user)
    await callback.message.edit_text(
        f"⚡ <b>Мои задачи</b> ({len(tasks)}):",
        reply_markup=tasks_list_kb(tasks, page=callback_data.page),
        parse_mode="HTML",
    )
    await callback.answer()


# ─── CALLBACK: Task detail ───────────────────────────────

@router.callback_query(TaskCB.filter(F.action == "detail"))
async def task_detail(callback: CallbackQuery, callback_data: TaskCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    task = await get_task_by_id(session, callback_data.id)
    if not task:
        await callback.answer("Задача не найдена")
        return

    is_assignee = task.assignee_id == user.id
    text = format_task_card(task)

    # Show comments
    if task.comments:
        text += "\n\n💬 <b>Комментарии:</b>"
        for c in task.comments[-3:]:  # last 3
            text += f"\n• {c.user.full_name}: {c.text}"

    await callback.message.edit_text(
        text,
        reply_markup=task_detail_kb(task.id, task.status, user.role, is_assignee),
        parse_mode="HTML",
    )
    await callback.answer()


# ─── CALLBACK: Complete task (submit for review) ─────────

@router.callback_query(TaskCB.filter(F.action == "complete"))
async def task_complete(callback: CallbackQuery, callback_data: TaskCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    task = await transition_task(session, callback_data.id, TaskStatus.REVIEW)
    if not task:
        await callback.answer("❌ Невозможно выполнить задачу")
        return

    await log_action(session, user.id, "task_complete", "task", task.id,
                     old_value={"status": "in_progress"}, new_value={"status": "review"})

    # Notify creator / project manager
    if task.created_by_id:
        await notify_and_push(
            callback.bot, session, task.created_by_id,
            NotificationType.TASK_ASSIGNED,
            f"Задача на проверке: {task.title}",
            f"Исполнитель {user.full_name} отправил задачу на проверку.",
            "task", task.id,
        )

    await session.commit()

    await callback.message.edit_text(
        f"✅ Задача «{task.title}» отправлена на проверку.",
        reply_markup=None,
    )
    await callback.answer("Отправлено на проверку")


# ─── CALLBACK: Approve task ──────────────────────────────

@router.callback_query(TaskCB.filter(F.action == "approve"))
async def task_approve(callback: CallbackQuery, callback_data: TaskCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    task = await transition_task(session, callback_data.id, TaskStatus.DONE)
    if not task:
        await callback.answer("❌ Невозможно принять задачу")
        return

    await log_action(session, user.id, "task_approve", "task", task.id)

    if task.assignee_id:
        await notify_and_push(
            callback.bot, session, task.assignee_id,
            NotificationType.TASK_ASSIGNED,
            f"✅ Задача принята: {task.title}",
            entity_type="task", entity_id=task.id,
        )

    await session.commit()

    await callback.message.edit_text(
        f"✅ Задача «{task.title}» принята.",
        reply_markup=None,
    )
    await callback.answer("Задача принята")


# ─── CALLBACK: Reject (return to work) ──────────────────

@router.callback_query(TaskCB.filter(F.action == "reject"))
async def task_reject(callback: CallbackQuery, callback_data: TaskCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    task = await transition_task(session, callback_data.id, TaskStatus.IN_PROGRESS)
    if not task:
        await callback.answer("❌ Невозможно вернуть задачу")
        return

    await log_action(session, user.id, "task_reject", "task", task.id)

    if task.assignee_id:
        await notify_and_push(
            callback.bot, session, task.assignee_id,
            NotificationType.TASK_ASSIGNED,
            f"↩️ Задача возвращена: {task.title}",
            "Требуется доработка.",
            "task", task.id,
        )

    await session.commit()

    await callback.message.edit_text(
        f"↩️ Задача «{task.title}» возвращена на доработку.",
        reply_markup=None,
    )
    await callback.answer()


# ─── CALLBACK: Block task ────────────────────────────────

@router.callback_query(TaskCB.filter(F.action == "block"))
async def task_block_start(callback: CallbackQuery, callback_data: TaskCB, state: FSMContext):
    await state.update_data(block_task_id=callback_data.id)
    await state.set_state(BlockedForm.reason)
    await callback.message.edit_text("🚫 Опишите причину блокировки:")
    await callback.answer()


@router.message(BlockedForm.reason)
async def task_block_reason(message: Message, state: FSMContext, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        return

    data = await state.get_data()
    task_id = data["block_task_id"]
    reason = message.text.strip()

    task = await transition_task(session, task_id, TaskStatus.BLOCKED, reason)
    if not task:
        await message.answer("❌ Невозможно заблокировать задачу")
        await state.clear()
        return

    await log_action(session, user.id, "task_block", "task", task.id, new_value={"reason": reason})

    if task.created_by_id:
        await notify_and_push(
            message.bot, session, task.created_by_id,
            NotificationType.ESCALATION,
            f"🚫 Задача заблокирована: {task.title}",
            f"Причина: {reason}\nИсполнитель: {user.full_name}",
            "task", task.id,
        )

    await session.commit()
    await state.clear()
    await message.answer(f"🚫 Задача «{task.title}» заблокирована.\nПричина: {reason}")


# ─── CALLBACK: Add comment ───────────────────────────────

@router.callback_query(TaskCB.filter(F.action == "comment"))
async def task_comment_start(callback: CallbackQuery, callback_data: TaskCB, state: FSMContext):
    await state.update_data(comment_task_id=callback_data.id)
    await state.set_state(CommentForm.text)
    await callback.message.edit_text("💬 Введите комментарий:")
    await callback.answer()


@router.message(CommentForm.text)
async def task_comment_save(message: Message, state: FSMContext, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        return

    data = await state.get_data()
    task_id = data["comment_task_id"]

    comment = await add_comment(session, task_id, user.id, message.text.strip())
    await session.commit()
    await state.clear()
    await message.answer(f"💬 Комментарий добавлен.")


# ─── NAV: Back to tasks ─────────────────────────────────

@router.callback_query(NavCB.filter((F.to == "back") & (F.ctx == "tasks")))
async def nav_back_tasks(callback: CallbackQuery, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    tasks = await get_user_tasks(session, user)
    await callback.message.edit_text(
        f"⚡ <b>Мои задачи</b> ({len(tasks)}):",
        reply_markup=tasks_list_kb(tasks),
        parse_mode="HTML",
    )
    await callback.answer()
