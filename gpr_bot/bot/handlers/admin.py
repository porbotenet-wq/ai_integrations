from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from sqlalchemy import select
from bot.db.models import User, UserRole, ConstructionObject, ObjectRole
from bot.utils.callbacks import AdminCB, ObjectCB
from bot.keyboards.common import role_select_kb, back_button
from bot.keyboards.main_menu import main_menu_keyboard
from bot.rbac.permissions import has_permission, ROLE_NAMES, ROLE_DEPARTMENT
from bot.services.audit_service import log_action
from bot.services.notification_service import get_unread_count
from bot.services.object_service import create_object
from bot.states.forms import CreateObjectForm
from datetime import datetime

router = Router()


# ─── ADMIN PANEL ─────────────────────────────────────────

@router.message(F.text.startswith("⚙️"))
@router.message(Command("admin"))
async def admin_panel(message: Message, db_user: User | None, session):
    if not db_user or not has_permission(db_user.role, "admin.manage_users"):
        await message.answer("❌ Нет доступа.")
        return

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

    lines.append(f"\n<b>Активные ({len(active)}):</b>")
    for u in active:
        role_name = ROLE_NAMES.get(u.role, u.role.value)
        lines.append(f"• {u.full_name} — {role_name}")

    lines.append("\n<b>Команды:</b>")
    lines.append("/viewas — просмотр меню от лица роли")
    lines.append("/newobject — создать объект")

    if not pending:
        await message.answer("\n".join(lines), parse_mode="HTML")


# ─── VIEW AS ROLE ────────────────────────────────────────

@router.message(Command("viewas"))
async def cmd_viewas(message: Message, db_user: User | None, session):
    if not db_user or db_user.role != UserRole.ADMIN:
        await message.answer("❌ Только для администратора.")
        return

    buttons = []
    for role in UserRole:
        name = ROLE_NAMES.get(role, role.value)
        buttons.append([InlineKeyboardButton(
            text=f"👤 {name}",
            callback_data=AdminCB(action="viewas", role=role.value).pack()
        )])

    await message.answer(
        "🔄 <b>Просмотр от лица роли</b>\n\nВыберите роль:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="HTML",
    )


@router.callback_query(AdminCB.filter(F.action == "viewas"))
async def viewas_role(callback: CallbackQuery, callback_data: AdminCB, db_user: User | None, session):
    if not db_user or db_user.role != UserRole.ADMIN:
        await callback.answer("Нет доступа")
        return

    role = UserRole(callback_data.role)
    role_name = ROLE_NAMES.get(role, role.value)

    # Show menu for this role
    unread = await get_unread_count(session, db_user.id)
    kb = main_menu_keyboard(role, unread)

    # Show permissions for this role
    from bot.rbac.permissions import get_user_permissions
    perms = get_user_permissions(role)

    lines = [
        f"👤 <b>Просмотр: {role_name}</b>\n",
        f"Разрешений: {len(perms)}",
        "",
    ]

    perm_groups = {}
    for p in sorted(perms):
        group = p.split(".")[0]
        perm_groups.setdefault(group, []).append(p.split(".")[1])

    for group, actions in perm_groups.items():
        lines.append(f"• <b>{group}</b>: {', '.join(actions)}")

    lines.append("\n⬇️ Клавиатура ниже показывает меню этой роли.")
    lines.append("Нажмите /start чтобы вернуться к своему меню.")

    await callback.message.answer(
        "\n".join(lines),
        reply_markup=kb,
        parse_mode="HTML",
    )
    await callback.answer(f"Режим: {role_name}")


# ─── CREATE OBJECT ───────────────────────────────────────

@router.message(Command("newobject"))
async def cmd_new_object(message: Message, db_user: User | None, state: FSMContext):
    if not db_user or not has_permission(db_user.role, "object.create"):
        await message.answer("❌ Нет прав на создание объектов.")
        return

    await message.answer(
        "🏗 <b>Создание объекта</b>\n\n"
        "Введите название объекта:",
        parse_mode="HTML",
    )
    await state.set_state(CreateObjectForm.name)


@router.message(CreateObjectForm.name)
async def obj_name(message: Message, state: FSMContext):
    await state.update_data(name=message.text.strip())
    await message.answer("🏙 Город:")
    await state.set_state(CreateObjectForm.city)


@router.message(CreateObjectForm.city)
async def obj_city(message: Message, state: FSMContext):
    await state.update_data(city=message.text.strip())
    await message.answer("📍 Адрес (или «—» чтобы пропустить):")
    await state.set_state(CreateObjectForm.address)


@router.message(CreateObjectForm.address)
async def obj_address(message: Message, state: FSMContext):
    addr = message.text.strip()
    await state.update_data(address="" if addr == "—" else addr)
    await message.answer(
        "📅 Дата начала (ДД.ММ.ГГГГ) или «—» чтобы пропустить:"
    )
    await state.set_state(CreateObjectForm.contract_date)


@router.message(CreateObjectForm.contract_date)
async def obj_contract_date(message: Message, state: FSMContext):
    text = message.text.strip()
    if text == "—":
        await state.update_data(contract_date=None)
    else:
        try:
            dt = datetime.strptime(text, "%d.%m.%Y").date()
            await state.update_data(contract_date=dt.isoformat())
        except ValueError:
            await message.answer("❌ Неверный формат. Используйте ДД.ММ.ГГГГ или «—»:")
            return

    await message.answer("📅 Дедлайн (ДД.ММ.ГГГГ) или «—»:")
    await state.set_state(CreateObjectForm.deadline_date)


@router.message(CreateObjectForm.deadline_date)
async def obj_deadline(message: Message, state: FSMContext):
    text = message.text.strip()
    if text == "—":
        await state.update_data(deadline_date=None)
    else:
        try:
            dt = datetime.strptime(text, "%d.%m.%Y").date()
            await state.update_data(deadline_date=dt.isoformat())
        except ValueError:
            await message.answer("❌ Неверный формат. Используйте ДД.ММ.ГГГГ или «—»:")
            return

    data = await state.get_data()
    contract = data.get("contract_date") or "—"
    deadline = data.get("deadline_date") or "—"

    text = (
        f"🏗 <b>Подтверждение</b>\n\n"
        f"📋 {data['name']}\n"
        f"🏙 {data.get('city', '—')}\n"
        f"📍 {data.get('address') or '—'}\n"
        f"📅 Начало: {contract}\n"
        f"📅 Дедлайн: {deadline}\n\n"
        f"Создать объект?"
    )

    await message.answer(
        text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Создать", callback_data="obj_confirm_create"),
                InlineKeyboardButton(text="❌ Отмена", callback_data="obj_cancel_create"),
            ]
        ]),
        parse_mode="HTML",
    )
    await state.set_state(CreateObjectForm.confirm)


@router.callback_query(F.data == "obj_confirm_create")
async def obj_confirm(callback: CallbackQuery, state: FSMContext, db_user: User | None, session):
    if not db_user or not has_permission(db_user.role, "object.create"):
        await callback.answer("Нет прав")
        return

    data = await state.get_data()
    from datetime import date as date_type

    contract_date = None
    if data.get("contract_date"):
        contract_date = date_type.fromisoformat(data["contract_date"])

    deadline_date = None
    if data.get("deadline_date"):
        deadline_date = date_type.fromisoformat(data["deadline_date"])

    obj = await create_object(
        session,
        name=data["name"],
        city=data.get("city", ""),
        address=data.get("address", ""),
        contract_date=contract_date,
        deadline_date=deadline_date,
        created_by_user_id=db_user.id,
    )

    await log_action(session, db_user.id, "object_create", "object", obj.id)

    # ── Auto-create workflow from default template ──
    from bot.db.models import WorkflowTemplate, WorkflowTemplateStep, WorkflowInstance, WorkflowInstanceStep
    from sqlalchemy import select
    from datetime import timedelta

    tmpl_result = await session.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.is_default == True).limit(1)
    )
    default_tmpl = tmpl_result.scalar_one_or_none()
    if default_tmpl:
        wf_instance = WorkflowInstance(
            object_id=obj.id, template_id=default_tmpl.id, status="active"
        )
        session.add(wf_instance)
        await session.flush()

        tmpl_steps = await session.execute(
            select(WorkflowTemplateStep)
            .where(WorkflowTemplateStep.template_id == default_tmpl.id)
            .order_by(WorkflowTemplateStep.step_number)
        )
        start_date = contract_date or date_type.today()
        for ts in tmpl_steps.scalars():
            duration = ts.duration_days or 1
            planned_end = start_date + timedelta(days=duration)
            # Assign to creator if role matches
            assignee_id = db_user.id if ts.responsible_role == db_user.role.value else None

            wf_step = WorkflowInstanceStep(
                instance_id=wf_instance.id,
                template_step_id=ts.id,
                step_number=ts.step_number,
                name=ts.name,
                phase=ts.phase,
                assignee_id=assignee_id,
                status="active" if ts.step_number == 1 else "pending",
                planned_start=start_date,
                planned_end=planned_end,
            )
            session.add(wf_step)
            start_date = planned_end

    await session.commit()
    await state.clear()

    workflow_msg = "\n🔄 Workflow создан (64 этапа)" if default_tmpl else ""
    await callback.message.edit_text(
        f"✅ Объект создан: <b>{obj.name}</b> (ID: {obj.id})\n"
        f"Статус: Черновик{workflow_msg}\n\n"
        f"Вы назначены руководителем проекта.",
        parse_mode="HTML",
    )
    await callback.answer("Объект создан")


@router.callback_query(F.data == "obj_cancel_create")
async def obj_cancel(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text("❌ Создание объекта отменено.")
    await callback.answer()


# ─── APPROVE / SET ROLE ──────────────────────────────────

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

    if new_role in ROLE_DEPARTMENT:
        user.department = ROLE_DEPARTMENT[new_role]

    await log_action(session, db_user.id, "set_role", "user", user.id,
                     old_value={"role": old_role.value}, new_value={"role": new_role.value})
    await session.commit()

    role_name = ROLE_NAMES.get(new_role, new_role.value)
    await callback.message.edit_text(
        f"✅ {user.full_name} — роль: <b>{role_name}</b>",
        parse_mode="HTML",
    )

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
