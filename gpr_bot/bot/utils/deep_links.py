"""
Deep link utilities for Mini App integration.
Generates WebApp buttons that open specific pages in the Mini App.
"""
from aiogram.types import InlineKeyboardButton, WebAppInfo
from bot.config import get_settings


def _get_webapp_url() -> str:
    """Get current webapp URL (from config or tunnel file)."""
    settings = get_settings()
    # Try tunnel URL first (dynamic)
    try:
        with open("/tmp/cloudflared-url.txt") as f:
            url = f.read().strip()
            if url:
                return url
    except FileNotFoundError:
        pass
    return settings.webapp_url


def webapp_button(text: str, path: str = "/") -> InlineKeyboardButton:
    """Create a WebApp inline button with deep link path."""
    base = _get_webapp_url()
    url = f"{base}{path}" if path != "/" else base
    return InlineKeyboardButton(text=text, web_app=WebAppInfo(url=url))


def object_button(object_id: int, label: str = "📱 Открыть объект") -> InlineKeyboardButton:
    return webapp_button(label, f"/objects/{object_id}")


def object_tasks_button(object_id: int) -> InlineKeyboardButton:
    return webapp_button("⚡ Задачи", f"/objects/{object_id}?tab=tasks")


def object_gpr_button(object_id: int) -> InlineKeyboardButton:
    return webapp_button("📋 ГПР", f"/objects/{object_id}?tab=gpr")


def object_supply_button(object_id: int) -> InlineKeyboardButton:
    return webapp_button("📦 Поставки", f"/objects/{object_id}?tab=supply")


def object_construction_button(object_id: int) -> InlineKeyboardButton:
    return webapp_button("🏗 Монтаж", f"/objects/{object_id}?tab=construction")


def object_production_button(object_id: int) -> InlineKeyboardButton:
    return webapp_button("🏭 Производство", f"/objects/{object_id}?tab=production")


def dashboard_button(label: str = "📊 Дашборд") -> InlineKeyboardButton:
    return webapp_button(label, "/")


def notifications_button(label: str = "🔔 Уведомления") -> InlineKeyboardButton:
    return webapp_button(label, "/notifications")


def profile_button(label: str = "👤 Профиль") -> InlineKeyboardButton:
    return webapp_button(label, "/profile")
