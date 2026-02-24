from datetime import date, datetime
from bot.db.models import ObjectStatus, TaskStatus, SupplyStatus, ConstructionStageStatus

STATUS_EMOJI = {
    ObjectStatus.DRAFT: "📝",
    ObjectStatus.PLANNING: "📋",
    ObjectStatus.ACTIVE: "🟢",
    ObjectStatus.ON_HOLD: "⏸",
    ObjectStatus.COMPLETING: "🏁",
    ObjectStatus.CLOSED: "✅",

    TaskStatus.NEW: "🆕",
    TaskStatus.ASSIGNED: "👤",
    TaskStatus.IN_PROGRESS: "🔄",
    TaskStatus.REVIEW: "👁",
    TaskStatus.BLOCKED: "🚫",
    TaskStatus.DONE: "✅",
    TaskStatus.OVERDUE: "🔴",

    SupplyStatus.REQUESTED: "📨",
    SupplyStatus.APPROVED: "✅",
    SupplyStatus.ORDERED: "📦",
    SupplyStatus.SHIPPED: "🚚",
    SupplyStatus.DELIVERED: "📬",
    SupplyStatus.DELAYED: "⚠️",

    ConstructionStageStatus.PENDING: "⏳",
    ConstructionStageStatus.IN_PROGRESS: "🔨",
    ConstructionStageStatus.SUBMITTED: "📤",
    ConstructionStageStatus.ACCEPTED: "✅",
    ConstructionStageStatus.REJECTED: "❌",
}

STATUS_NAMES_RU = {
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


def fmt_date(d: date | datetime | None) -> str:
    if d is None:
        return "—"
    if isinstance(d, datetime):
        d = d.date()
    return d.strftime("%d.%m.%Y")


def fmt_status(status) -> str:
    emoji = STATUS_EMOJI.get(status, "")
    name = STATUS_NAMES_RU.get(status, str(status.value))
    return f"{emoji} {name}"


def days_until(d: date | None) -> str:
    if d is None:
        return ""
    delta = (d - date.today()).days
    if delta < 0:
        return f"⚠️ просрочено на {abs(delta)} дн."
    elif delta == 0:
        return "📌 сегодня"
    elif delta <= 3:
        return f"⏰ через {delta} дн."
    return f"через {delta} дн."


def truncate(text: str, max_len: int = 50) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 1] + "…"


def format_object_card(obj) -> str:
    lines = [
        f"🏗 <b>{obj.name}</b>",
        f"📍 {obj.city or '—'}",
        f"Статус: {fmt_status(obj.status)}",
        f"Договор: {fmt_date(obj.contract_date)}",
        f"Дедлайн: {fmt_date(obj.deadline_date)} {days_until(obj.deadline_date)}",
    ]
    return "\n".join(lines)


def format_task_card(task) -> str:
    assignee_name = task.assignee.full_name if task.assignee else "Не назначен"
    lines = [
        f"📋 <b>{task.title}</b>",
        f"Статус: {fmt_status(task.status)}",
        f"Исполнитель: {assignee_name}",
        f"Дедлайн: {fmt_date(task.deadline)} {days_until(task.deadline)}",
    ]
    if task.description:
        lines.append(f"📝 {truncate(task.description, 100)}")
    if task.blocked_reason:
        lines.append(f"🚫 Блокировка: {task.blocked_reason}")
    return "\n".join(lines)


def format_supply_card(order) -> str:
    lines = [
        f"📦 <b>{order.material_name}</b>",
        f"Статус: {fmt_status(order.status)}",
        f"Кол-во: {order.quantity or '—'} {order.unit or ''}",
        f"Ожидаемая дата: {fmt_date(order.expected_date)}",
        f"Поставщик: {order.supplier or '—'}",
        f"Место: {order.delivery_location or '—'}",
    ]
    return "\n".join(lines)


PAGE_SIZE = 5
