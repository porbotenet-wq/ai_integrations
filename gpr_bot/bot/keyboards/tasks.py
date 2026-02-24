from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from bot.utils.callbacks import TaskCB, NavCB
from bot.utils.formatters import fmt_status, truncate, days_until
from bot.db.models import UserRole, TaskStatus
from bot.rbac.permissions import has_permission


def tasks_list_kb(tasks: list, page: int = 0, page_size: int = 5) -> InlineKeyboardMarkup:
    start = page * page_size
    end = start + page_size
    page_items = tasks[start:end]

    buttons = []
    for task in page_items:
        emoji = fmt_status(task.status).split()[0]
        deadline_hint = days_until(task.deadline) if task.deadline else ""
        label = f"{emoji} {truncate(task.title, 30)} {deadline_hint}"
        buttons.append([InlineKeyboardButton(
            text=label,
            callback_data=TaskCB(action="detail", id=task.id).pack()
        )])

    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton(text="◀️", callback_data=TaskCB(action="list", page=page - 1).pack()))
    if end < len(tasks):
        nav_row.append(InlineKeyboardButton(text="▶️", callback_data=TaskCB(action="list", page=page + 1).pack()))
    if nav_row:
        buttons.append(nav_row)

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def task_detail_kb(task_id: int, task_status: TaskStatus, role: UserRole, is_assignee: bool = False) -> InlineKeyboardMarkup:
    buttons = []

    if is_assignee and task_status in (TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE):
        buttons.append([
            InlineKeyboardButton(text="✅ Выполнить", callback_data=TaskCB(action="complete", id=task_id).pack()),
        ])

    if is_assignee and task_status in (TaskStatus.IN_PROGRESS, TaskStatus.ASSIGNED):
        buttons.append([
            InlineKeyboardButton(text="🚫 Заблокировать", callback_data=TaskCB(action="block", id=task_id).pack()),
        ])

    if has_permission(role, "task.approve") and task_status == TaskStatus.REVIEW:
        buttons.append([
            InlineKeyboardButton(text="✅ Принять", callback_data=TaskCB(action="approve", id=task_id).pack()),
            InlineKeyboardButton(text="↩️ Вернуть", callback_data=TaskCB(action="reject", id=task_id).pack()),
        ])

    action_row = []
    if has_permission(role, "task.delegate"):
        action_row.append(InlineKeyboardButton(text="🔄 Передать", callback_data=TaskCB(action="delegate", id=task_id).pack()))
    if has_permission(role, "task.reschedule"):
        action_row.append(InlineKeyboardButton(text="⏰ Перенести", callback_data=TaskCB(action="reschedule", id=task_id).pack()))
    if action_row:
        buttons.append(action_row)

    buttons.append([
        InlineKeyboardButton(text="💬 Комментарий", callback_data=TaskCB(action="comment", id=task_id).pack()),
    ])

    buttons.append([
        InlineKeyboardButton(text="◀️ Назад", callback_data=NavCB(to="back", ctx="tasks").pack()),
    ])

    return InlineKeyboardMarkup(inline_keyboard=buttons)
