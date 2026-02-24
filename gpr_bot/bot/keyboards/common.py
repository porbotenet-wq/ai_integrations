from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from bot.utils.callbacks import NavCB, SupplyCB, ConstructionCB, NotifCB, AdminCB
from bot.db.models import UserRole, Department
from bot.rbac.permissions import ROLE_NAMES, DEPARTMENT_NAMES


def confirm_cancel_kb(confirm_data: str, cancel_ctx: str = "main") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data=confirm_data),
            InlineKeyboardButton(text="❌ Отмена", callback_data=NavCB(to="back", ctx=cancel_ctx).pack()),
        ]
    ])


def back_button(ctx: str = "main", id: int = 0) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◀️ Назад", callback_data=NavCB(to="back", ctx=ctx, id=id).pack())]
    ])


def supply_list_kb(orders: list, obj_id: int, page: int = 0, page_size: int = 5) -> InlineKeyboardMarkup:
    start = page * page_size
    end = start + page_size
    page_items = orders[start:end]

    buttons = []
    for order in page_items:
        from bot.utils.formatters import fmt_status, truncate
        emoji = fmt_status(order.status).split()[0]
        buttons.append([InlineKeyboardButton(
            text=f"{emoji} {truncate(order.material_name, 35)}",
            callback_data=SupplyCB(action="detail", id=order.id).pack()
        )])

    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton(text="◀️", callback_data=SupplyCB(action="list", id=obj_id, page=page - 1).pack()))
    if end < len(orders):
        nav_row.append(InlineKeyboardButton(text="▶️", callback_data=SupplyCB(action="list", id=obj_id, page=page + 1).pack()))
    if nav_row:
        buttons.append(nav_row)

    buttons.append([InlineKeyboardButton(
        text="◀️ Назад к объекту",
        callback_data=NavCB(to="back", ctx="object_detail", id=obj_id).pack()
    )])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def construction_stages_kb(stages: list, obj_id: int) -> InlineKeyboardMarkup:
    buttons = []
    for stage in stages:
        from bot.utils.formatters import fmt_status
        emoji = fmt_status(stage.status).split()[0]
        buttons.append([InlineKeyboardButton(
            text=f"{emoji} {stage.name}",
            callback_data=ConstructionCB(action="detail", id=stage.id).pack()
        )])

    buttons.append([InlineKeyboardButton(
        text="◀️ Назад к объекту",
        callback_data=NavCB(to="back", ctx="object_detail", id=obj_id).pack()
    )])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def notifications_list_kb(notifications: list, page: int = 0, page_size: int = 5) -> InlineKeyboardMarkup:
    start = page * page_size
    end = start + page_size
    page_items = notifications[start:end]

    buttons = []
    for notif in page_items:
        prefix = "🔵" if not notif.is_read else "⚪"
        from bot.utils.formatters import truncate
        buttons.append([InlineKeyboardButton(
            text=f"{prefix} {truncate(notif.title, 40)}",
            callback_data=NotifCB(action="read", id=notif.id).pack()
        )])

    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton(text="◀️", callback_data=NotifCB(action="list", page=page - 1).pack()))
    if end < len(notifications):
        nav_row.append(InlineKeyboardButton(text="▶️", callback_data=NotifCB(action="list", page=page + 1).pack()))
    if nav_row:
        buttons.append(nav_row)

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def department_select_kb(prefix: str = "dept") -> InlineKeyboardMarkup:
    buttons = []
    for dept in Department:
        buttons.append([InlineKeyboardButton(
            text=DEPARTMENT_NAMES.get(dept, dept.value),
            callback_data=f"{prefix}:{dept.value}"
        )])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def role_select_kb(user_id: int) -> InlineKeyboardMarkup:
    buttons = []
    for role in UserRole:
        if role == UserRole.ADMIN:
            continue
        buttons.append([InlineKeyboardButton(
            text=ROLE_NAMES.get(role, role.value),
            callback_data=AdminCB(action="set_role", user_id=user_id, role=role.value).pack()
        )])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
