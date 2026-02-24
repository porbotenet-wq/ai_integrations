from aiogram import Router, F
from aiogram.types import CallbackQuery
from bot.db.models import User, SupplyStatus, NotificationType
from bot.utils.callbacks import SupplyCB, ObjectCB
from bot.keyboards.common import supply_list_kb, back_button
from bot.utils.formatters import format_supply_card
from bot.services.supply_service import get_object_supplies, get_supply_by_id, approve_supply, update_supply_status
from bot.services.notification_service import notify_and_push
from bot.services.audit_service import log_action
from bot.rbac.permissions import has_permission
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

router = Router()


def _require_auth(db_user):
    if db_user is None or not db_user.is_active:
        return None
    return db_user


@router.callback_query(ObjectCB.filter(F.action == "supply"))
async def supply_list(callback: CallbackQuery, callback_data: ObjectCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    obj_id = callback_data.id
    orders = await get_object_supplies(session, obj_id)

    if not orders:
        await callback.message.edit_text(
            "📦 Поставки не найдены.",
            reply_markup=back_button("object_detail", obj_id),
        )
        await callback.answer()
        return

    delayed = sum(1 for o in orders if o.status == SupplyStatus.DELAYED)
    text = f"📦 <b>Поставки</b> ({len(orders)})"
    if delayed:
        text += f" | ⚠️ Задержано: {delayed}"

    await callback.message.edit_text(
        text,
        reply_markup=supply_list_kb(orders, obj_id),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(SupplyCB.filter(F.action == "detail"))
async def supply_detail(callback: CallbackQuery, callback_data: SupplyCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    order = await get_supply_by_id(session, callback_data.id)
    if not order:
        await callback.answer("Не найдено")
        return

    text = format_supply_card(order)
    buttons = []

    if has_permission(user.role, "supply.approve") and order.status == SupplyStatus.REQUESTED:
        buttons.append([InlineKeyboardButton(
            text="✅ Согласовать", callback_data=SupplyCB(action="approve", id=order.id).pack()
        )])

    if has_permission(user.role, "supply.update"):
        if order.status in (SupplyStatus.APPROVED, SupplyStatus.ORDERED):
            buttons.append([InlineKeyboardButton(
                text="🚚 Отгружено", callback_data=SupplyCB(action="ship", id=order.id).pack()
            )])
        if order.status == SupplyStatus.SHIPPED:
            buttons.append([InlineKeyboardButton(
                text="📬 Доставлено", callback_data=SupplyCB(action="receive", id=order.id).pack()
            )])

    buttons.append([InlineKeyboardButton(
        text="◀️ Назад", callback_data=ObjectCB(action="supply", id=order.object_id).pack()
    )])

    await callback.message.edit_text(
        text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(SupplyCB.filter(F.action == "approve"))
async def supply_approve(callback: CallbackQuery, callback_data: SupplyCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user or not has_permission(user.role, "supply.approve"):
        await callback.answer("Нет прав")
        return

    order = await approve_supply(session, callback_data.id, user.id)
    if not order:
        await callback.answer("Невозможно согласовать")
        return

    await log_action(session, user.id, "supply_approve", "supply", order.id)
    await session.commit()
    await callback.message.edit_text(f"✅ Заявка «{order.material_name}» согласована.")
    await callback.answer()


@router.callback_query(SupplyCB.filter(F.action == "ship"))
async def supply_ship(callback: CallbackQuery, callback_data: SupplyCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    from datetime import date
    order = await update_supply_status(session, callback_data.id, SupplyStatus.SHIPPED)
    if order:
        await log_action(session, user.id, "supply_ship", "supply", order.id)
        await session.commit()
        await callback.message.edit_text(f"🚚 «{order.material_name}» отмечено как отгружено.")
    await callback.answer()


@router.callback_query(SupplyCB.filter(F.action == "receive"))
async def supply_receive(callback: CallbackQuery, callback_data: SupplyCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    from datetime import date
    order = await update_supply_status(session, callback_data.id, SupplyStatus.DELIVERED, date.today())
    if order:
        await log_action(session, user.id, "supply_receive", "supply", order.id)
        await session.commit()
        await callback.message.edit_text(f"📬 «{order.material_name}» — доставка подтверждена.")
    await callback.answer()
