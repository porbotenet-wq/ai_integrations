from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from sqlalchemy import select
from bot.db.models import User, UserRole
from bot.db.session import async_session
from bot.keyboards.main_menu import main_menu_keyboard, BTN_OBJECTS, BTN_TASKS, BTN_NOTIFICATIONS, BTN_DASHBOARD, BTN_ADMIN
from bot.services.notification_service import get_unread_count
from bot.states.forms import RegisterForm
from bot.rbac.permissions import ROLE_NAMES
from bot.config import get_settings

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message, db_user: User | None, session, state: FSMContext):
    await state.clear()
    settings = get_settings()

    # Handle deep links: /start task_123, /start obj_456
    args = message.text.split(maxsplit=1)
    deep_link = args[1] if len(args) > 1 else None

    if db_user is None:
        # New user — check if admin (auto-register as admin)
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
                "👋 Добро пожаловать в систему управления ГПР!\n\n"
                "Вы ещё не зарегистрированы. Введите ваше ФИО:"
            )
            await state.set_state(RegisterForm.full_name)
            return

    if not db_user.is_active:
        await message.answer("⏳ Ваша заявка на регистрацию ожидает одобрения администратора.")
        return

    unread = await get_unread_count(session, db_user.id)
    role_name = ROLE_NAMES.get(db_user.role, db_user.role.value)

    text = (
        f"👤 {db_user.full_name}\n"
        f"🔑 {role_name}\n\n"
        "Выберите раздел:"
    )

    # Handle deep link
    if deep_link:
        # Will be handled by specific handlers
        pass

    await message.answer(text, reply_markup=main_menu_keyboard(db_user.role, unread))


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
        is_active=False,  # needs admin approval
    )
    session.add(user)
    await session.commit()

    await state.clear()
    await message.answer(
        "✅ Заявка на регистрацию отправлена!\n\n"
        "Администратор назначит вам роль и подтвердит доступ.\n"
        "Вы получите уведомление."
    )

    # Notify admins
    settings = get_settings()
    for admin_id in settings.admin_ids:
        try:
            await message.bot.send_message(
                admin_id,
                f"🆕 Новая заявка на регистрацию:\n"
                f"👤 {full_name}\n"
                f"📱 {phone}\n"
                f"TG: @{message.from_user.username or '—'}\n\n"
                f"Используйте /admin для управления пользователями.",
            )
        except Exception:
            pass
