from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
from bot.db.models import UserRole
from bot.rbac.permissions import has_permission

# Reply keyboard buttons (persistent)
BTN_OBJECTS = "📋 Мои объекты"
BTN_TASKS = "⚡ Мои задачи"
BTN_NOTIFICATIONS = "🔔 Уведомления"
BTN_DASHBOARD = "📊 Дашборд"
BTN_ADMIN = "⚙️ Админ"


def main_menu_keyboard(role: UserRole, unread_count: int = 0) -> ReplyKeyboardMarkup:
    notif_text = f"🔔 Уведомления ({unread_count})" if unread_count > 0 else BTN_NOTIFICATIONS

    row1 = [KeyboardButton(text=BTN_OBJECTS), KeyboardButton(text=BTN_TASKS)]
    row2 = [KeyboardButton(text=notif_text)]

    if has_permission(role, "dashboard.view"):
        row2.append(KeyboardButton(text=BTN_DASHBOARD))

    rows = [row1, row2]

    if has_permission(role, "admin.manage_users"):
        rows.append([KeyboardButton(text=BTN_ADMIN)])

    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True, is_persistent=True)
