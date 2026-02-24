from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from sqlalchemy import select
from bot.db.models import User, UserRole
from bot.utils.callbacks import AdminCB
from bot.keyboards.common import role_select_kb
from bot.rbac.permissions import has_permission, ROLE_NAMES
from bot.services.audit_service import log_action

router = Router()


@router.message(F.text.startswith("⚙️"))
@router.message(Command("admin"))
async def admin_panel(message: Message, db_user: User | None, session):
    if not db_user or not has_permission(db_user.role, "admin.manage_users"):
        await message.answer("❌ Нет доступа.")
        return

    # Show pending users
    result = await session.execute(
        select(User).where(User.is_active == False).order_by(User.created_at.desc())
    )
    pending = result.scalars().all()

    result2 = await session.execute(
        select(User).where(User.is_active == True).order_by(User.full_name)
    )
    active = result2.scalars().all()

    lines = ["⚙️ <b>Админ-панель</b>\n"]

    if pending:
        lines.append(f"<b>Ожидают одобрения ({len(pending)}):</b>")
        buttons = []
        for u in pending:
            lines.append(f"• {u.full_name} (@{u.username or '—'}) — {u.phone or '—'}")
            buttons.append([InlineKeyboardButton(
                text=f"✅ {u.full_name}",
                callback_data=AdminCB(action="approve_user", user_id=u.id).pack()
            )])

        await message.answer(
            "\n".join(lines),
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
            parse_mode="HTML",
        )
    else:
        lines.append("Нет ожидающих заявок.\n")

    lines.append(f"\n<b>Активные пользователи ({len(active)}):</b>")
    for u in active:
        role_name = ROLE_NAMES.get(u.role, u.role.value)
        lines.append(f"• {u.full_name} — {role_name}")

    if not pending:
        await message.answer("\n".join(lines), parse_mode="HTML")


@router.callback_query(AdminCB.filter(F.action == "approve_user"))
async def approve_user(callback: CallbackQuery, callback_data: AdminCB, db_user: User | None, session):
    if not db_user or not has_permission(db_user.role, "admin.manage_users"):
        await callback.answer("Нет доступа")
        return

    user = await session.get(User, callback_data.user_id)
    if not user:
        await callback.answer("Пользователь не найден")
        return

    await callback.message.edit_text(
        f"Выберите роль для <b>{user.full_name}</b>:",
        reply_markup=role_select_kb(user.id),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(AdminCB.filter(F.action == "set_role"))
async def set_user_role(callback: CallbackQuery, callback_data: AdminCB, db_user: User | None, session):
    if not db_user or not has_permission(db_user.role, "admin.manage_roles"):
        await callback.answer("Нет доступа")
        return

    user = await session.get(User, callback_data.user_id)
    if not user:
        await callback.answer("Пользователь не найден")
        return

    new_role = UserRole(callback_data.role)
    old_role = user.role
    user.role = new_role
    user.is_active = True

    from bot.rbac.permissions import ROLE_DEPARTMENT
    if new_role in ROLE_DEPARTMENT:
        user.department = ROLE_DEPARTMENT[new_role]

    await log_action(session, db_user.id, "set_role", "user", user.id,
                     old_value={"role": old_role.value}, new_value={"role": new_role.value})
    await session.commit()

    role_name = ROLE_NAMES.get(new_role, new_role.value)
    await callback.message.edit_text(
        f"✅ {user.full_name} — роль назначена: <b>{role_name}</b>",
        parse_mode="HTML",
    )

    # Notify user
    try:
        await callback.bot.send_message(
            user.telegram_id,
            f"✅ Ваша заявка одобрена!\n"
            f"Роль: <b>{role_name}</b>\n\n"
            f"Нажмите /start для начала работы.",
            parse_mode="HTML",
        )
    except Exception:
        pass

    await callback.answer("Роль назначена")
