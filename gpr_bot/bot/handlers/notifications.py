from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from bot.db.models import User
from bot.keyboards.common import notifications_list_kb
from bot.utils.callbacks import NotifCB
from bot.services.notification_service import get_notifications, mark_read
from bot.utils.formatters import fmt_date

router = Router()


@router.message(F.text.startswith("🔔"))
async def my_notifications(message: Message, db_user: User | None, session):
    if not db_user or not db_user.is_active:
        await message.answer("⚠️ Авторизуйтесь: /start")
        return

    notifs = await get_notifications(session, db_user.id)
    if not notifs:
        await message.answer("🔔 Нет уведомлений.")
        return

    unread = sum(1 for n in notifs if not n.is_read)
    text = f"🔔 <b>Уведомления</b>"
    if unread:
        text += f" ({unread} новых)"

    await message.answer(text, reply_markup=notifications_list_kb(notifs), parse_mode="HTML")


@router.callback_query(NotifCB.filter(F.action == "list"))
async def notif_list_page(callback: CallbackQuery, callback_data: NotifCB, db_user: User | None, session):
    if not db_user or not db_user.is_active:
        await callback.answer("Авторизуйтесь")
        return

    notifs = await get_notifications(session, db_user.id)
    await callback.message.edit_text(
        f"🔔 <b>Уведомления</b>",
        reply_markup=notifications_list_kb(notifs, page=callback_data.page),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(NotifCB.filter(F.action == "read"))
async def notif_read(callback: CallbackQuery, callback_data: NotifCB, db_user: User | None, session):
    if not db_user or not db_user.is_active:
        await callback.answer("Авторизуйтесь")
        return

    notif = await mark_read(session, callback_data.id)
    await session.commit()

    if notif:
        text = f"🔔 <b>{notif.title}</b>\n\n{notif.text or ''}\n\n<i>{fmt_date(notif.created_at)}</i>"
        from bot.keyboards.common import back_button
        # Could add deep-link button to entity here
        await callback.message.edit_text(text, reply_markup=back_button("notifications"), parse_mode="HTML")

    await callback.answer()


from bot.utils.callbacks import NavCB

@router.callback_query(NavCB.filter(F.to == "back", F.ctx == "notifications"))
async def nav_back_notifs(callback: CallbackQuery, db_user: User | None, session):
    if not db_user:
        await callback.answer("Авторизуйтесь")
        return

    notifs = await get_notifications(session, db_user.id)
    await callback.message.edit_text(
        f"🔔 <b>Уведомления</b>",
        reply_markup=notifications_list_kb(notifs),
        parse_mode="HTML",
    )
    await callback.answer()
