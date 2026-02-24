from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from bot.db.models import (
    User, ConstructionStage, ConstructionStageStatus,
    ChecklistItem, NotificationType,
)
from bot.utils.callbacks import ConstructionCB, ObjectCB
from bot.keyboards.common import construction_stages_kb, back_button
from bot.services.notification_service import notify_and_push
from bot.services.audit_service import log_action
from bot.rbac.permissions import has_permission
from bot.utils.formatters import fmt_status

router = Router()


def _require_auth(db_user):
    if db_user is None or not db_user.is_active:
        return None
    return db_user


@router.callback_query(ObjectCB.filter(F.action == "construction"))
async def construction_list(callback: CallbackQuery, callback_data: ObjectCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    obj_id = callback_data.id
    result = await session.execute(
        select(ConstructionStage)
        .where(ConstructionStage.object_id == obj_id)
        .order_by(ConstructionStage.sort_order)
    )
    stages = result.scalars().all()

    if not stages:
        await callback.message.edit_text(
            "🏗 Этапы монтажа не созданы.",
            reply_markup=back_button("object_detail", obj_id),
        )
        await callback.answer()
        return

    current = next((s for s in stages if s.status == ConstructionStageStatus.IN_PROGRESS), None)
    done_count = sum(1 for s in stages if s.status == ConstructionStageStatus.ACCEPTED)

    text = f"🏗 <b>Монтаж</b> — {done_count}/{len(stages)} этапов завершено"
    if current:
        text += f"\n\n▶️ Текущий: {current.name}"

    await callback.message.edit_text(
        text,
        reply_markup=construction_stages_kb(stages, obj_id),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(ConstructionCB.filter(F.action == "detail"))
async def construction_detail(callback: CallbackQuery, callback_data: ConstructionCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    result = await session.execute(
        select(ConstructionStage)
        .options(selectinload(ConstructionStage.checklist))
        .where(ConstructionStage.id == callback_data.id)
    )
    stage = result.scalar_one_or_none()
    if not stage:
        await callback.answer("Этап не найден")
        return

    lines = [
        f"🏗 <b>{stage.name}</b>",
        f"Статус: {fmt_status(stage.status)}",
    ]

    if stage.checklist:
        lines.append("\n<b>Чеклист:</b>")
        for item in stage.checklist:
            icon = "✅" if item.is_done else "⬜"
            lines.append(f"{icon} {item.title}")

    buttons = []
    if has_permission(user.role, "construction.start") and stage.status == ConstructionStageStatus.PENDING:
        buttons.append([InlineKeyboardButton(
            text="▶️ Начать этап", callback_data=ConstructionCB(action="start", id=stage.id).pack()
        )])

    if has_permission(user.role, "construction.complete") and stage.status == ConstructionStageStatus.IN_PROGRESS:
        buttons.append([InlineKeyboardButton(
            text="📤 Сдать работы", callback_data=ConstructionCB(action="complete", id=stage.id).pack()
        )])

    if has_permission(user.role, "construction.accept") and stage.status == ConstructionStageStatus.SUBMITTED:
        buttons.append([
            InlineKeyboardButton(text="✅ Принять", callback_data=ConstructionCB(action="accept", id=stage.id).pack()),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=ConstructionCB(action="reject_stage", id=stage.id).pack()),
        ])

    buttons.append([InlineKeyboardButton(
        text="◀️ Назад", callback_data=ObjectCB(action="construction", id=stage.object_id).pack()
    )])

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(ConstructionCB.filter(F.action == "start"))
async def construction_start(callback: CallbackQuery, callback_data: ConstructionCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    stage = await session.get(ConstructionStage, callback_data.id)
    if stage and stage.status == ConstructionStageStatus.PENDING:
        from datetime import datetime
        stage.status = ConstructionStageStatus.IN_PROGRESS
        stage.started_at = datetime.utcnow()
        await log_action(session, user.id, "stage_start", "construction_stage", stage.id)
        await session.commit()
        await callback.message.edit_text(f"▶️ Этап «{stage.name}» запущен.")
    await callback.answer()


@router.callback_query(ConstructionCB.filter(F.action == "complete"))
async def construction_complete(callback: CallbackQuery, callback_data: ConstructionCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    stage = await session.get(ConstructionStage, callback_data.id)
    if stage and stage.status == ConstructionStageStatus.IN_PROGRESS:
        stage.status = ConstructionStageStatus.SUBMITTED
        await log_action(session, user.id, "stage_submit", "construction_stage", stage.id)
        await session.commit()
        await callback.message.edit_text(f"📤 Этап «{stage.name}» отправлен на приёмку.")
    await callback.answer()


@router.callback_query(ConstructionCB.filter(F.action == "accept"))
async def construction_accept(callback: CallbackQuery, callback_data: ConstructionCB, db_user: User | None, session):
    user = _require_auth(db_user)
    if not user:
        await callback.answer("Авторизуйтесь")
        return

    stage = await session.get(ConstructionStage, callback_data.id)
    if stage and stage.status == ConstructionStageStatus.SUBMITTED:
        from datetime import datetime
        stage.status = ConstructionStageStatus.ACCEPTED
        stage.completed_at = datetime.utcnow()
        stage.accepted_by_id = user.id
        await log_action(session, user.id, "stage_accept", "construction_stage", stage.id)
        await session.commit()
        await callback.message.edit_text(f"✅ Этап «{stage.name}» принят.")
    await callback.answer()
