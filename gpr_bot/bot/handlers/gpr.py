from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select
from bot.db.models import User, GPRStatus, NotificationType, ObjectRole
from bot.utils.callbacks import GPRCB, ObjectCB
from bot.keyboards.objects import gpr_detail_kb
from bot.services.gpr_service import (
    get_gpr_by_object, create_gpr_from_template,
    sign_gpr, send_gpr_for_signatures,
)
from bot.services.notification_service import notify_and_push
from bot.services.audit_service import log_action
from bot.rbac.permissions import has_permission, DEPARTMENT_NAMES
from bot.utils.formatters import fmt_date

router = Router()


def _require_auth(db_user):
    if db_user is None or not db_user.is_active:
        return None
    return db_user


@router.callback_query(GPRCB.filter(F.action == "view"))
async def gpr_view(callback: CallbackQuery, callback_data: GPRCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    obj_id = callback_data.id
    gpr = await get_gpr_by_object(session, obj_id)

    if not gpr:
        if has_permission(user.role, "gpr.create"):
            await callback.message.edit_text(
                "📄 ГПР не создан.",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="📝 Создать ГПР", callback_data=GPRCB(action="create", id=obj_id).pack())],
                    [InlineKeyboardButton(text="◀️ Назад", callback_data=ObjectCB(action="detail", id=obj_id).pack())],
                ]),
            )
        else:
            await callback.answer("ГПР ещё не создан")
        return

    lines = [
        f"📄 <b>ГПР v{gpr.version}</b>",
        f"Статус: {gpr.status.value}",
        f"Позиций: {len(gpr.items)}",
        "",
    ]

    dept_items = {}
    for item in gpr.items:
        dept_items.setdefault(item.department, []).append(item)
    for dept, items in dept_items.items():
        name = DEPARTMENT_NAMES.get(dept, dept.value)
        lines.append(f"• {name}: {len(items)} позиций")

    if gpr.signatures:
        lines.append("\n<b>Подписи:</b>")
        for sig in gpr.signatures:
            icon = "✅" if sig.signed else "⏳"
            dt = fmt_date(sig.signed_at) if sig.signed_at else "—"
            lines.append(f"{icon} {sig.user.full_name} ({dt})")

    can_sign = (
        gpr.status == GPRStatus.PENDING_SIGNATURES
        and any(s.user_id == user.id and not s.signed for s in gpr.signatures)
    )

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=gpr_detail_kb(gpr.id, obj_id, user.role, can_sign),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(GPRCB.filter(F.action == "create"))
async def gpr_create(callback: CallbackQuery, callback_data: GPRCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user or not has_permission(user.role, "gpr.create"):
        await callback.answer("Нет прав")
        return

    obj_id = callback_data.id
    gpr = await create_gpr_from_template(session, obj_id, user.id)
    await send_gpr_for_signatures(session, gpr.id, obj_id)
    await log_action(session, user.id, "gpr_create", "gpr", gpr.id)

    result = await session.execute(select(ObjectRole).where(ObjectRole.object_id == obj_id))
    for obj_role in result.scalars().all():
        if obj_role.user_id != user.id:
            await notify_and_push(
                callback.bot, session, obj_role.user_id,
                NotificationType.GPR_SIGN_REQUEST,
                "📄 Новый ГПР на подписание",
                "Создан ГПР. Требуется ваша подпись.",
                "gpr", gpr.id,
            )

    await session.commit()
    await callback.message.edit_text(
        f"✅ ГПР создан ({len(gpr.items)} позиций) и отправлен на подписание.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📄 Посмотреть ГПР", callback_data=GPRCB(action="view", id=obj_id).pack())],
        ]),
    )
    await callback.answer()


@router.callback_query(GPRCB.filter(F.action == "sign"))
async def gpr_sign(callback: CallbackQuery, callback_data: GPRCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    all_signed = await sign_gpr(session, callback_data.id, user.id)
    await log_action(session, user.id, "gpr_sign", "gpr", callback_data.id)

    if all_signed:
        # Notify everyone
        gpr = await session.get(
            __import__('bot.db.models', fromlist=['GPR']).GPR, callback_data.id
        )
        if gpr:
            result = await session.execute(
                select(ObjectRole).where(ObjectRole.object_id == gpr.object_id)
            )
            for obj_role in result.scalars().all():
                await notify_and_push(
                    callback.bot, session, obj_role.user_id,
                    NotificationType.GPR_SIGNED,
                    "✅ ГПР полностью подписан!",
                    "Все подписи получены. Объект активирован.",
                    "gpr", callback_data.id,
                )

    await session.commit()

    msg = "✅ Вы подписали ГПР."
    if all_signed:
        msg += "\n\n🎉 Все подписи получены — объект активирован!"
    await callback.message.edit_text(msg)
    await callback.answer("Подписано")
