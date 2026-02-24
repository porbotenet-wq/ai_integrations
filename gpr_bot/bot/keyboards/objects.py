from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from bot.utils.callbacks import ObjectCB, NavCB, GPRCB
from bot.utils.formatters import fmt_status, truncate
from bot.db.models import UserRole
from bot.rbac.permissions import has_permission


def objects_list_kb(objects: list, page: int = 0, page_size: int = 5) -> InlineKeyboardMarkup:
    start = page * page_size
    end = start + page_size
    page_items = objects[start:end]

    buttons = []
    for obj in page_items:
        emoji = fmt_status(obj.status).split()[0]
        buttons.append([InlineKeyboardButton(
            text=f"{emoji} {truncate(obj.name, 35)} — {obj.city or ''}",
            callback_data=ObjectCB(action="detail", id=obj.id).pack()
        )])

    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton(text="◀️", callback_data=ObjectCB(action="list", page=page - 1).pack()))
    if end < len(objects):
        nav_row.append(InlineKeyboardButton(text="▶️", callback_data=ObjectCB(action="list", page=page + 1).pack()))
    if nav_row:
        buttons.append(nav_row)

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def object_detail_kb(obj_id: int, role: UserRole) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text="📄 ГПР", callback_data=GPRCB(action="view", id=obj_id).pack()),
         InlineKeyboardButton(text="📦 Поставки", callback_data=ObjectCB(action="supply", id=obj_id).pack())],
        [InlineKeyboardButton(text="🏗 Монтаж", callback_data=ObjectCB(action="construction", id=obj_id).pack()),
         InlineKeyboardButton(text="📎 Документы", callback_data=ObjectCB(action="docs", id=obj_id).pack())],
        [InlineKeyboardButton(text="👥 Команда", callback_data=ObjectCB(action="team", id=obj_id).pack())],
    ]

    if has_permission(role, "task.create"):
        buttons.append([InlineKeyboardButton(
            text="➕ Создать задачу",
            callback_data=ObjectCB(action="new_task", id=obj_id).pack()
        )])

    buttons.append([InlineKeyboardButton(
        text="◀️ Назад к списку",
        callback_data=NavCB(to="back", ctx="objects").pack()
    )])

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def gpr_detail_kb(gpr_id: int, obj_id: int, role: UserRole, can_sign: bool = False) -> InlineKeyboardMarkup:
    buttons = []

    if can_sign:
        buttons.append([
            InlineKeyboardButton(text="✅ Подписать", callback_data=GPRCB(action="sign", id=gpr_id).pack()),
            InlineKeyboardButton(text="❌ Замечания", callback_data=GPRCB(action="reject", id=gpr_id).pack()),
        ])

    # Mini App button for full GPR view
    buttons.append([InlineKeyboardButton(
        text="📊 Открыть полный ГПР",
        web_app=None  # Will be set with WebAppInfo(url=...) in production
    )])

    buttons.append([InlineKeyboardButton(
        text="◀️ Назад",
        callback_data=ObjectCB(action="detail", id=obj_id).pack()
    )])

    return InlineKeyboardMarkup(inline_keyboard=buttons)
