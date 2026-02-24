"""
Formatters — визуальное оформление всех сообщений бота.
Стиль: Architectural Cinema — чистые линии, структура, контраст.
"""
from datetime import date, datetime
from bot.db.models import ObjectStatus, TaskStatus, SupplyStatus, ConstructionStageStatus


# ─── Визуальные элементы ─────────────────────────────────

LINE = "─" * 28
THIN = "┄" * 28

def header(title: str, emoji: str = "") -> str:
    return f"{emoji} <b>{title}</b>\n{LINE}"

def section(title: str) -> str:
    return f"\n<b>{title}</b>"

def kv(key: str, value, indent: bool = True) -> str:
    """Key-value строка"""
    prefix = "  " if indent else ""
    return f"{prefix}{key}  <b>{value}</b>"

def progress_bar(pct: int, width: int = 12) -> str:
    """Прогресс-бар: ▓▓▓▓▓░░░░░ 42%"""
    if pct < 0: pct = 0
    if pct > 100: pct = 100
    filled = round(pct / 100 * width)
    return f"{'▓' * filled}{'░' * (width - filled)} {pct}%"

def mini_bar(pct: int) -> str:
    """Компактный бар для списков"""
    blocks = ["░", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"]
    filled = pct / 100 * 8
    full = int(filled)
    part = int((filled - full) * 8)
    bar = "█" * full
    if full < 8:
        bar += blocks[part]
        bar += "░" * (8 - full - 1)
    return bar

def badge(text: str) -> str:
    return f"[ {text} ]"


# ─── Статусы ─────────────────────────────────────────────

STATUS_ICON = {
    # Objects
    ObjectStatus.DRAFT: "◻️",
    ObjectStatus.PLANNING: "🔷",
    ObjectStatus.ACTIVE: "🟢",
    ObjectStatus.ON_HOLD: "🟡",
    ObjectStatus.COMPLETING: "🔶",
    ObjectStatus.CLOSED: "⬛",
    # Tasks
    TaskStatus.NEW: "◻️",
    TaskStatus.ASSIGNED: "🔹",
    TaskStatus.IN_PROGRESS: "🔵",
    TaskStatus.REVIEW: "🟣",
    TaskStatus.BLOCKED: "🔴",
    TaskStatus.DONE: "✅",
    TaskStatus.OVERDUE: "🔴",
    # Supply
    SupplyStatus.REQUESTED: "◻️",
    SupplyStatus.APPROVED: "🔹",
    SupplyStatus.ORDERED: "🔷",
    SupplyStatus.SHIPPED: "🚛",
    SupplyStatus.DELIVERED: "✅",
    SupplyStatus.DELAYED: "🔴",
    # Construction
    ConstructionStageStatus.PENDING: "◻️",
    ConstructionStageStatus.IN_PROGRESS: "🔵",
    ConstructionStageStatus.SUBMITTED: "🟣",
    ConstructionStageStatus.ACCEPTED: "✅",
    ConstructionStageStatus.REJECTED: "🔴",
}

STATUS_NAME = {
    ObjectStatus.DRAFT: "Черновик",
    ObjectStatus.PLANNING: "Планирование",
    ObjectStatus.ACTIVE: "Активный",
    ObjectStatus.ON_HOLD: "Приостановлен",
    ObjectStatus.COMPLETING: "Завершение",
    ObjectStatus.CLOSED: "Закрыт",
    TaskStatus.NEW: "Новая",
    TaskStatus.ASSIGNED: "Назначена",
    TaskStatus.IN_PROGRESS: "В работе",
    TaskStatus.REVIEW: "На проверке",
    TaskStatus.BLOCKED: "Заблокирована",
    TaskStatus.DONE: "Выполнена",
    TaskStatus.OVERDUE: "Просрочена",
}

# Legacy aliases
STATUS_EMOJI = STATUS_ICON
STATUS_NAMES_RU = STATUS_NAME


def fmt_status(status) -> str:
    icon = STATUS_ICON.get(status, "")
    name = STATUS_NAME.get(status, str(status.value) if hasattr(status, 'value') else str(status))
    return f"{icon} {name}"


# ─── Даты ────────────────────────────────────────────────

def fmt_date(d: date | datetime | None) -> str:
    if d is None:
        return "—"
    if isinstance(d, datetime):
        d = d.date()
    return d.strftime("%d.%m.%Y")


def fmt_date_short(d: date | datetime | None) -> str:
    if d is None:
        return "—"
    if isinstance(d, datetime):
        d = d.date()
    months = ["", "янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
    return f"{d.day} {months[d.month]}"


def days_until(d: date | None) -> str:
    if d is None:
        return ""
    delta = (d - date.today()).days
    if delta < -1:
        return f"🔴 просрочено {abs(delta)} дн."
    elif delta == -1:
        return "🔴 просрочено вчера"
    elif delta == 0:
        return "⚡ сегодня"
    elif delta == 1:
        return "завтра"
    elif delta <= 3:
        return f"⚠️ {delta} дн."
    elif delta <= 7:
        return f"{delta} дн."
    return ""


def deadline_line(d: date | None) -> str:
    if d is None:
        return ""
    urgency = days_until(d)
    if urgency:
        return f"📅 {fmt_date(d)}  {urgency}"
    return f"📅 {fmt_date(d)}"


# ─── Утилиты ─────────────────────────────────────────────

def truncate(text: str, max_len: int = 50) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 1] + "…"


# ─── Карточки ────────────────────────────────────────────

def format_object_card(obj, tasks_done: int = 0, tasks_total: int = 0, overdue: int = 0) -> str:
    pct = round(tasks_done / tasks_total * 100) if tasks_total > 0 else 0
    status = fmt_status(obj.status)

    lines = [
        f"🏗 <b>{obj.name}</b>",
        f"   📍 {obj.city or '—'}  ·  {status}",
        "",
        f"   {progress_bar(pct)}",
        f"   ✅ {tasks_done}/{tasks_total} задач",
    ]

    if overdue > 0:
        lines.append(f"   🔴 {overdue} просрочено")

    dl = deadline_line(obj.deadline_date)
    if dl:
        lines.append(f"   {dl}")

    if obj.contract_date:
        lines.append(f"   📄 Договор: {fmt_date(obj.contract_date)}")

    return "\n".join(lines)


def format_object_list_item(obj, idx: int = 0, tasks_done: int = 0, tasks_total: int = 0) -> str:
    """Компактная строка для списка объектов"""
    pct = round(tasks_done / tasks_total * 100) if tasks_total > 0 else 0
    icon = STATUS_ICON.get(obj.status, "◻️")
    return f"{icon} <b>{obj.name}</b>  {mini_bar(pct)} {pct}%"


def format_task_card(task) -> str:
    assignee = task.assignee.full_name if task.assignee else "—"
    status = fmt_status(task.status)

    lines = [
        f"📋 <b>{task.title}</b>",
        f"   {status}",
        f"   👤 {assignee}",
    ]

    dl = deadline_line(task.deadline)
    if dl:
        lines.append(f"   {dl}")

    if task.description:
        lines.append(f"\n   📝 {truncate(task.description, 120)}")

    if task.blocked_reason:
        lines.append(f"   🔴 {task.blocked_reason}")

    return "\n".join(lines)


def format_task_list_item(task) -> str:
    """Компактная строка для списка задач"""
    icon = STATUS_ICON.get(task.status, "◻️")
    urgency = days_until(task.deadline) if task.deadline else ""
    return f"{icon} {truncate(task.title, 30)}  {urgency}"


def format_supply_card(order) -> str:
    status = fmt_status(order.status)
    lines = [
        f"📦 <b>{order.material_name}</b>",
        f"   {status}",
        f"   Кол-во: {order.quantity or '—'} {order.unit or ''}",
    ]
    if order.supplier:
        lines.append(f"   🏭 {order.supplier}")
    if order.expected_date:
        lines.append(f"   📅 Ожидание: {fmt_date(order.expected_date)}")
    if order.delivery_location:
        lines.append(f"   📍 {order.delivery_location}")
    return "\n".join(lines)


PAGE_SIZE = 5
