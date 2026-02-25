"""
Chat linking handler — привязка TG-групп к объектам.
/link <object_id> — привязать текущий чат к объекту
/unlink — отвязать текущий чат
/chatinfo — показать привязку
"""
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command
from sqlalchemy import select
from bot.db.models import User, ObjectChat, ConstructionObject, Task, TaskStatus
from bot.db.session import async_session
from bot.utils.deep_links import object_button
from aiogram.types import InlineKeyboardMarkup

router = Router()


@router.message(Command("link"))
async def cmd_link(message: Message):
    """Привязать текущий чат к объекту: /link <object_id> [task_id]"""
    if message.chat.type == "private":
        await message.answer("⚠️ Эта команда работает только в группах.")
        return

    args = message.text.split()
    if len(args) < 2:
        # Show available objects
        async with async_session() as db:
            result = await db.execute(
                select(ConstructionObject).order_by(ConstructionObject.id)
            )
            objects = result.scalars().all()

        if not objects:
            await message.answer("Нет доступных объектов.")
            return

        lines = ["🔗 <b>Привязка чата к объекту</b>\n", "Использование: <code>/link ID</code>\n", "Доступные объекты:"]
        for obj in objects:
            lines.append(f"  <code>{obj.id}</code> — {obj.name}")
        await message.answer("\n".join(lines), parse_mode="HTML")
        return

    object_id = int(args[1]) if args[1].isdigit() else None
    task_id = int(args[2]) if len(args) > 2 and args[2].isdigit() else None

    if not object_id:
        await message.answer("⚠️ Укажите ID объекта: <code>/link 2</code>", parse_mode="HTML")
        return

    async with async_session() as db:
        # Check object exists
        obj = await db.get(ConstructionObject, object_id)
        if not obj:
            await message.answer(f"⚠️ Объект #{object_id} не найден.")
            return

        # Check if already linked
        existing = (await db.execute(
            select(ObjectChat).where(
                ObjectChat.chat_id == message.chat.id,
                ObjectChat.object_id == object_id,
                ObjectChat.is_active == True,
            )
        )).scalar_one_or_none()

        if existing:
            await message.answer(f"ℹ️ Этот чат уже привязан к <b>{obj.name}</b>.", parse_mode="HTML")
            return

        # Find user
        user = (await db.execute(
            select(User).where(User.telegram_id == message.from_user.id)
        )).scalar_one_or_none()

        # Create link
        link = ObjectChat(
            object_id=object_id,
            task_id=task_id,
            chat_id=message.chat.id,
            chat_title=message.chat.title or message.chat.full_name,
            chat_type=message.chat.type,
            linked_by_id=user.id if user else None,
        )
        db.add(link)
        await db.commit()

    task_text = f"\n📌 Задача: #{task_id}" if task_id else ""
    kb = InlineKeyboardMarkup(inline_keyboard=[[object_button(object_id)]])

    await message.answer(
        f"✅ Чат привязан к объекту\n\n"
        f"🏗 <b>{obj.name}</b>{task_text}\n\n"
        f"Уведомления по объекту будут приходить сюда.",
        parse_mode="HTML",
        reply_markup=kb,
    )


@router.message(Command("unlink"))
async def cmd_unlink(message: Message):
    """Отвязать текущий чат от объекта"""
    if message.chat.type == "private":
        await message.answer("⚠️ Эта команда работает только в группах.")
        return

    async with async_session() as db:
        result = await db.execute(
            select(ObjectChat).where(
                ObjectChat.chat_id == message.chat.id,
                ObjectChat.is_active == True,
            )
        )
        links = result.scalars().all()

        if not links:
            await message.answer("ℹ️ Этот чат не привязан ни к одному объекту.")
            return

        for link in links:
            link.is_active = False
        await db.commit()

    await message.answer(
        f"🔓 Чат отвязан от {len(links)} объект(ов).\n"
        f"Уведомления больше не будут приходить сюда.",
    )


@router.message(Command("chatinfo"))
async def cmd_chatinfo(message: Message):
    """Показать привязки текущего чата"""
    async with async_session() as db:
        result = await db.execute(
            select(ObjectChat, ConstructionObject)
            .join(ConstructionObject, ConstructionObject.id == ObjectChat.object_id)
            .where(
                ObjectChat.chat_id == message.chat.id,
                ObjectChat.is_active == True,
            )
        )
        rows = result.all()

    if not rows:
        await message.answer(
            "ℹ️ Этот чат не привязан к объектам.\n"
            "Используйте <code>/link ID</code> для привязки.",
            parse_mode="HTML",
        )
        return

    lines = ["🔗 <b>Привязки чата</b>\n"]
    for link, obj in rows:
        task_text = f" → задача #{link.task_id}" if link.task_id else ""
        lines.append(f"  🏗 <b>{obj.name}</b> (#{obj.id}){task_text}")

    await message.answer("\n".join(lines), parse_mode="HTML")
