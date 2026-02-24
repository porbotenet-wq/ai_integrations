from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from bot.db.models import UserRole
from bot.rbac.permissions import has_permission
from bot.config import get_settings

# Reply keyboard buttons (persistent) — kept for backward compat
BTN_OBJECTS = "📋 Мои объекты"
BTN_TASKS = "⚡ Мои задачи"
BTN_NOTIFICATIONS = "🔔 Уведомления"
BTN_DASHBOARD = "📊 Дашборд"
BTN_ADMIN = "⚙️ Админ"


def main_menu_inline(role: UserRole, unread_count: int = 0) -> InlineKeyboardMarkup:
    """Главное меню — inline кнопки"""
    notif_text = f"🔔 Уведомления ({unread_count})" if unread_count > 0 else "🔔 Уведомления"

    buttons = [
        [
            InlineKeyboardButton(text="📋 Объекты", callback_data="menu:objects"),
            InlineKeyboardButton(text="⚡ Задачи", callback_data="menu:tasks"),
        ],
        [
            InlineKeyboardButton(text=notif_text, callback_data="menu:notifications"),
            InlineKeyboardButton(text="📊 Дашборд", callback_data="menu:dashboard"),
        ],
        [
            InlineKeyboardButton(text="📝 Ввод факта", callback_data="menu:fact"),
            InlineKeyboardButton(text="➕ Новая задача", callback_data="menu:newtask"),
        ],
    ]

    # Mini App button
    settings = get_settings()
    webapp_url = settings.webapp_url
    if webapp_url:
        buttons.append([
            InlineKeyboardButton(text="📱 Открыть Mini App", web_app=WebAppInfo(url=webapp_url)),
        ])

    if has_permission(role, "admin.manage_users"):
        buttons.append([
            InlineKeyboardButton(text="⚙️ Админ", callback_data="menu:admin"),
            InlineKeyboardButton(text="📊 Отчёт", callback_data="menu:report"),
        ])

    buttons.append([
        InlineKeyboardButton(text="❓ Справка", callback_data="menu:help"),
    ])

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def progress_bar(pct: int, width: int = 10) -> str:
    """Визуальный прогресс-бар из символов"""
    filled = round(pct / 100 * width)
    empty = width - filled
    bar = "█" * filled + "░" * empty
    return f"[{bar}] {pct}%"


def object_card_text(obj, tasks_done: int = 0, tasks_total: int = 0, overdue: int = 0) -> str:
    """Форматированная карточка объекта"""
    pct = round(tasks_done / tasks_total * 100) if tasks_total > 0 else 0
    bar = progress_bar(pct)

    status_emoji = {
        "active": "🟢", "planning": "🔵", "draft": "⚪",
        "on_hold": "🟡", "completing": "🟠", "closed": "⚫",
    }
    s_emoji = status_emoji.get(obj.status.value, "⚪")

    deadline = ""
    if obj.deadline_date:
        from datetime import date
        days = (obj.deadline_date - date.today()).days
        if days < 0:
            deadline = f"⚠️ Просрочен на {abs(days)} дн."
        elif days == 0:
            deadline = "🔴 Дедлайн сегодня!"
        elif days <= 7:
            deadline = f"🟡 {days} дн. до дедлайна"
        else:
            deadline = f"📅 {obj.deadline_date.strftime('%d.%m.%Y')}"

    overdue_line = f"\n⚠️ Просрочено задач: {overdue}" if overdue > 0 else ""

    return (
        f"{s_emoji} <b>{obj.name}</b>\n"
        f"📍 {obj.city or '—'}\n"
        f"{bar}\n"
        f"✅ {tasks_done}/{tasks_total} задач{overdue_line}\n"
        f"{deadline}"
    )


# Backward compat alias
def main_menu_keyboard(role: UserRole, unread_count: int = 0):
    """Legacy alias → returns inline keyboard"""
    return main_menu_inline(role, unread_count)
