from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from sqlalchemy import select, func
from bot.db.models import User, UserRole, Task, TaskStatus, ConstructionObject, ObjectStatus
from bot.db.session import async_session
from bot.keyboards.main_menu import main_menu_inline
from bot.services.notification_service import get_unread_count
from bot.states.forms import RegisterForm
from bot.rbac.permissions import ROLE_NAMES
from bot.utils.formatters import LINE, progress_bar
from bot.config import get_settings

router = Router()


def _greeting() -> str:
    from datetime import datetime
    h = datetime.now().hour
    if h < 6: return "🌙"
    if h < 12: return "☀️"
    if h < 18: return "🌤"
    return "🌆"


def _role_badge(role) -> str:
    name = ROLE_NAMES.get(role, role.value if hasattr(role, 'value') else str(role))
    return f"⟨ {name} ⟩"


@router.message(CommandStart())
async def cmd_start(message: Message, db_user: User | None, session, state: FSMContext):
    await state.clear()
    settings = get_settings()

    args = message.text.split(maxsplit=1)
    deep_link = args[1] if len(args) > 1 else None

    if db_user is None:
        if message.from_user.id in settings.admin_ids:
            user = User(
                telegram_id=message.from_user.id,
                username=message.from_user.username,
                full_name=message.from_user.full_name or "Admin",
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(user)
            await session.commit()
            db_user = user
        else:
            await message.answer(
                f"{'─' * 30}\n"
                f"  🏗  <b>S T S p h e r a</b>\n"
                f"{'─' * 30}\n\n"
                f"Система управления\n"
                f"фасадным строительством\n\n"
                f"{'┄' * 30}\n\n"
                f"Для начала работы\n"
                f"введите ваше <b>ФИО</b>:",
                parse_mode="HTML",
            )
            await state.set_state(RegisterForm.full_name)
            return

    if not db_user.is_active:
        await message.answer(
            f"⏳ Заявка на рассмотрении.\n"
            f"Вы получите уведомление.",
            parse_mode="HTML",
        )
        return

    await _send_main_menu(message, db_user, session)


async def _send_main_menu(message: Message, db_user: User, session, edit: bool = False):
    """Отправить или отредактировать главное меню"""
    unread = await get_unread_count(session, db_user.id)

    # Stats
    active_obj = (await session.execute(
        select(func.count(ConstructionObject.id))
        .where(ConstructionObject.status == ObjectStatus.ACTIVE)
    )).scalar() or 0

    my_tasks = (await session.execute(
        select(func.count(Task.id))
        .where(Task.assignee_id == db_user.id)
        .where(Task.status.in_([TaskStatus.NEW, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]))
    )).scalar() or 0

    overdue = (await session.execute(
        select(func.count(Task.id))
        .where(Task.assignee_id == db_user.id)
        .where(Task.status == TaskStatus.OVERDUE)
    )).scalar() or 0

    done = (await session.execute(
        select(func.count(Task.id))
        .where(Task.assignee_id == db_user.id)
        .where(Task.status == TaskStatus.DONE)
    )).scalar() or 0

    total = my_tasks + done + overdue
    pct = round(done / total * 100) if total > 0 else 0

    g = _greeting()
    role = _role_badge(db_user.role)

    # Build message
    lines = [
        f"{'─' * 30}",
        f"  🏗  <b>S T S p h e r a</b>",
        f"{'─' * 30}",
        f"",
        f"{g}  <b>{db_user.full_name}</b>",
        f"      {role}",
        f"",
    ]

    # Stats block
    if total > 0 or active_obj > 0:
        lines.append(f"{'┄' * 30}")
        if active_obj:
            lines.append(f"  🏗  Объектов     <b>{active_obj}</b>")
        if my_tasks:
            lines.append(f"  ⚡  В работе     <b>{my_tasks}</b>")
        if overdue:
            lines.append(f"  🔴  Просрочено   <b>{overdue}</b>")
        if unread:
            lines.append(f"  🔔  Новых        <b>{unread}</b>")
        if total > 0:
            lines.append(f"")
            lines.append(f"  {progress_bar(pct)}")
        lines.append(f"{'┄' * 30}")
    else:
        lines.append(f"  ✨  Нет активных задач")
        lines.append(f"{'┄' * 30}")

    text = "\n".join(lines)
    kb = main_menu_inline(db_user.role, unread)

    if edit:
        await message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await message.answer(text, reply_markup=kb, parse_mode="HTML")


# ─── Menu callbacks ──────────────────────────────────────

@router.callback_query(F.data == "menu:objects")
async def menu_objects(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer("Авторизуйтесь: /start")
        return
    from bot.handlers.objects import my_objects
    await callback.answer()
    await my_objects(callback.message, db_user, session)


@router.callback_query(F.data == "menu:tasks")
async def menu_tasks(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer("Авторизуйтесь: /start")
        return
    from bot.handlers.tasks import my_tasks
    await callback.answer()
    await my_tasks(callback.message, db_user, session)


@router.callback_query(F.data == "menu:notifications")
async def menu_notifications(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer("Авторизуйтесь: /start")
        return
    from bot.handlers.notifications import my_notifications
    await callback.answer()
    await my_notifications(callback.message, db_user, session)


@router.callback_query(F.data == "menu:dashboard")
async def menu_dashboard(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer("Авторизуйтесь: /start")
        return
    from bot.handlers.dashboard import dashboard
    await callback.answer()
    await dashboard(callback.message, db_user, session)


@router.callback_query(F.data == "menu:fact")
async def menu_fact(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await callback.message.answer(
        "📝 <b>Ввод факта выполнения</b>\n\n"
        "Нажмите /fact чтобы начать.",
        parse_mode="HTML",
    )


@router.callback_query(F.data == "menu:newtask")
async def menu_newtask(callback: CallbackQuery):
    await callback.answer()
    await callback.message.answer(
        "➕ <b>Создание задачи</b>\n\n"
        "Нажмите /newtask чтобы начать.",
        parse_mode="HTML",
    )


@router.callback_query(F.data == "menu:admin")
async def menu_admin(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer("Авторизуйтесь: /start")
        return
    from bot.handlers.admin import admin_panel
    await callback.answer()
    await admin_panel(callback.message, db_user, session)


@router.callback_query(F.data == "menu:report")
async def menu_report(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer("Авторизуйтесь: /start")
        return
    from bot.handlers.dashboard import cmd_report
    await callback.answer()
    await cmd_report(callback.message, db_user, session)


@router.callback_query(F.data == "menu:help")
async def menu_help(callback: CallbackQuery, db_user: User | None, **kwargs):
    from bot.handlers.dashboard import cmd_help
    await callback.answer()
    await cmd_help(callback.message, db_user)


@router.callback_query(F.data == "menu:main")
async def back_to_main(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer()
        return
    await callback.answer()
    await _send_main_menu(callback.message, db_user, session, edit=True)


# ─── Registration ────────────────────────────────────────

@router.message(RegisterForm.full_name)
async def register_name(message: Message, state: FSMContext):
    await state.update_data(full_name=message.text.strip())
    await message.answer(
        "📱 Номер телефона:",
    )
    await state.set_state(RegisterForm.phone)


@router.message(RegisterForm.phone)
async def register_phone(message: Message, state: FSMContext, session):
    data = await state.get_data()
    full_name = data["full_name"]
    phone = message.text.strip()

    user = User(
        telegram_id=message.from_user.id,
        username=message.from_user.username,
        full_name=full_name,
        phone=phone,
        role=UserRole.VIEWER,
        is_active=False,
    )
    session.add(user)
    await session.commit()
    await state.clear()

    await message.answer(
        f"{'─' * 30}\n"
        f"  ✅  <b>Заявка отправлена</b>\n"
        f"{'─' * 30}\n\n"
        f"Администратор назначит роль\n"
        f"и подтвердит доступ.\n\n"
        f"Ожидайте уведомление.",
        parse_mode="HTML",
    )

    settings = get_settings()
    for admin_id in settings.admin_ids:
        try:
            await message.bot.send_message(
                admin_id,
                f"🆕 <b>Новая заявка</b>\n"
                f"{'┄' * 28}\n"
                f"  👤  {full_name}\n"
                f"  📱  {phone}\n"
                f"  TG  @{message.from_user.username or '—'}\n"
                f"{'┄' * 28}\n\n"
                f"/admin — управление",
                parse_mode="HTML",
            )
        except Exception:
            pass
