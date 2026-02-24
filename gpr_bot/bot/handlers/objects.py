from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from bot.db.models import User, UserRole, ObjectStatus
from bot.keyboards.main_menu import BTN_OBJECTS
from bot.keyboards.objects import objects_list_kb, object_detail_kb
from bot.utils.callbacks import ObjectCB, NavCB
from bot.utils.formatters import format_object_card
from bot.services.object_service import get_user_objects, get_object_by_id, get_object_team
from bot.services.notification_service import get_unread_count
from bot.rbac.permissions import has_permission, ROLE_NAMES
from bot.states.forms import CreateObjectForm
from datetime import datetime

router = Router()


def _require_auth(db_user: User | None) -> User | None:
    if db_user is None or not db_user.is_active:
        return None
    return db_user


# ─── REPLY BUTTON: My Objects ────────────────────────────

@router.message(F.text.startswith("📋"))
async def my_objects(message: Message, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await message.answer("⚠️ Необходимо авторизоваться: /start")
        return

    objects = await get_user_objects(session, user)
    if not objects:
        text = "📋 У вас нет активных объектов."
        if has_permission(user.role, "object.create"):
            text += "\n\nИспользуйте /new_object для создания."
        await message.answer(text)
        return

    await message.answer(
        f"📋 <b>Мои объекты</b> ({len(objects)}):",
        reply_markup=objects_list_kb(objects),
        parse_mode="HTML",
    )


# ─── CALLBACK: Object list pagination ────────────────────

@router.callback_query(ObjectCB.filter(F.action == "list"))
async def objects_list_page(callback: CallbackQuery, callback_data: ObjectCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    objects = await get_user_objects(session, user)
    await callback.message.edit_text(
        f"📋 <b>Мои объекты</b> ({len(objects)}):",
        reply_markup=objects_list_kb(objects, page=callback_data.page),
        parse_mode="HTML",
    )
    await callback.answer()


# ─── CALLBACK: Object detail ─────────────────────────────

@router.callback_query(ObjectCB.filter(F.action == "detail"))
async def object_detail(callback: CallbackQuery, callback_data: ObjectCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    obj = await get_object_by_id(session, callback_data.id)
    if not obj:
        await callback.answer("Объект не найден")
        return

    text = format_object_card(obj)

    await callback.message.edit_text(
        text,
        reply_markup=object_detail_kb(obj.id, user.role),
        parse_mode="HTML",
    )
    await callback.answer()


# ─── CALLBACK: Object team ───────────────────────────────

@router.callback_query(ObjectCB.filter(F.action == "team"))
async def object_team(callback: CallbackQuery, callback_data: ObjectCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    team = await get_object_team(session, callback_data.id)
    if not team:
        await callback.answer("Команда не назначена")
        return

    lines = ["👥 <b>Команда объекта:</b>\n"]
    for obj_role in team:
        role_name = ROLE_NAMES.get(obj_role.role, obj_role.role.value)
        u = obj_role.user
        lines.append(f"• {u.full_name} — {role_name}")
        if u.phone:
            lines.append(f"  📱 {u.phone}")

    from bot.keyboards.common import back_button
    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=back_button("object_detail", callback_data.id),
        parse_mode="HTML",
    )
    await callback.answer()


# ─── NAV: Back to objects ────────────────────────────────

@router.callback_query(NavCB.filter(F.to == "back", F.ctx == "objects"))
async def nav_back_objects(callback: CallbackQuery, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    objects = await get_user_objects(session, user)
    await callback.message.edit_text(
        f"📋 <b>Мои объекты</b> ({len(objects)}):",
        reply_markup=objects_list_kb(objects),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(NavCB.filter(F.to == "back", F.ctx == "object_detail"))
async def nav_back_object_detail(callback: CallbackQuery, callback_data: NavCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("⚠️ Авторизуйтесь")
        return

    obj = await get_object_by_id(session, callback_data.id)
    if not obj:
        await callback.answer("Объект не найден")
        return

    await callback.message.edit_text(
        format_object_card(obj),
        reply_markup=object_detail_kb(obj.id, user.role),
        parse_mode="HTML",
    )
    await callback.answer()
