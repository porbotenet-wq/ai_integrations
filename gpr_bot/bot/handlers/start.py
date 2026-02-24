from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from sqlalchemy import select, func
from bot.db.models import User, UserRole, Task, TaskStatus, ConstructionObject, ObjectStatus
from bot.db.session import async_session
from bot.keyboards.main_menu import main_menu_inline, object_card_text
from bot.services.notification_service import get_unread_count
from bot.states.forms import RegisterForm
from bot.rbac.permissions import ROLE_NAMES
from bot.config import get_settings

router = Router()

WELCOME_LOGO = (
    "━━━━━━━━━━━━━━━━━━━━\n"
    "  🏗  <b>STSphera</b>  🏗\n"
    "  Управление строительством\n"
    "━━━━━━━━━━━━━━━━━━━━"
)


@router.message(CommandStart())
async def cmd_start(message: Message, db_user: User | None, session, state: FSMContext):
    await state.clear()
    settings = get_settings()

    # Deep links
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
                f"{WELCOME_LOGO}\n\n"
                "👋 Добро пожаловать!\n\n"
                "Для начала работы введите ваше <b>ФИО</b>:",
                parse_mode="HTML",
            )
            await state.set_state(RegisterForm.full_name)
            return

    if not db_user.is_active:
        await message.answer(
            f"{WELCOME_LOGO}\n\n"
            "⏳ Ваша заявка ожидает одобрения администратора.\n"
            "Вы получите уведомление.",
            parse_mode="HTML",
        )
        return

    # Build welcome message with stats
    unread = await get_unread_count(session, db_user.id)
    role_name = ROLE_NAMES.get(db_user.role, db_user.role.value)

    # Quick stats
    active_objects = (await session.execute(
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

    # Greeting based on time
    from datetime import datetime
    hour = datetime.now().hour
    if hour < 6:
        greeting = "🌙 Доброй ночи"
    elif hour < 12:
        greeting = "☀️ Доброе утро"
    elif hour < 18:
        greeting = "🌤 Добрый день"
    else:
        greeting = "🌆 Добрый вечер"

    stats_lines = []
    if active_objects:
        stats_lines.append(f"🏗 Объектов: <b>{active_objects}</b>")
    if my_tasks:
        stats_lines.append(f"⚡ Задач в работе: <b>{my_tasks}</b>")
    if overdue:
        stats_lines.append(f"⚠️ Просрочено: <b>{overdue}</b>")
    if unread:
        stats_lines.append(f"🔔 Непрочитанных: <b>{unread}</b>")

    stats = "\n".join(stats_lines) if stats_lines else "✨ Всё чисто, задач нет"

    text = (
        f"{WELCOME_LOGO}\n\n"
        f"{greeting}, <b>{db_user.full_name}</b>!\n"
        f"🔑 {role_name}\n\n"
        f"{stats}\n\n"
        f"Выберите раздел:"
    )

    await message.answer(
        text,
        reply_markup=main_menu_inline(db_user.role, unread),
        parse_mode="HTML",
    )


# ─── Menu button handlers ────────────────────────────────

@router.callback_query(F.data == "menu:objects")
async def menu_objects(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer("Авторизуйтесь: /start")
        return
    # Trigger the objects handler
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
    from bot.handlers.fact import cmd_fact
    # Create a fake message-like call
    await callback.message.answer("Используйте команду /fact для ввода факта.")


@router.callback_query(F.data == "menu:newtask")
async def menu_newtask(callback: CallbackQuery):
    await callback.answer()
    await callback.message.answer("Используйте команду /newtask для создания задачи.")


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


# ─── Back to main menu ───────────────────────────────────

@router.callback_query(F.data == "menu:main")
async def back_to_main(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer()
        return
    unread = await get_unread_count(session, db_user.id)
    role_name = ROLE_NAMES.get(db_user.role, db_user.role.value)

    from datetime import datetime
    hour = datetime.now().hour
    greeting = "☀️" if hour < 18 else "🌆"

    text = (
        f"{WELCOME_LOGO}\n\n"
        f"{greeting} <b>{db_user.full_name}</b> | {role_name}\n\n"
        f"Выберите раздел:"
    )

    await callback.answer()
    await callback.message.edit_text(
        text,
        reply_markup=main_menu_inline(db_user.role, unread),
        parse_mode="HTML",
    )


# ─── Registration ────────────────────────────────────────

@router.message(RegisterForm.full_name)
async def register_name(message: Message, state: FSMContext):
    await state.update_data(full_name=message.text.strip())
    await message.answer("📱 Введите ваш номер телефона:")
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
        "✅ <b>Заявка отправлена!</b>\n\n"
        "Администратор назначит роль и подтвердит доступ.\n"
        "Вы получите уведомление.",
        parse_mode="HTML",
    )

    settings = get_settings()
    for admin_id in settings.admin_ids:
        try:
            await message.bot.send_message(
                admin_id,
                f"🆕 <b>Новая заявка</b>\n\n"
                f"👤 {full_name}\n"
                f"📱 {phone}\n"
                f"TG: @{message.from_user.username or '—'}\n\n"
                f"/admin — управление",
                parse_mode="HTML",
            )
        except Exception:
            pass
