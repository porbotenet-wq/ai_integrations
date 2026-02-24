import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.config import get_settings
from bot.db.session import init_db
from bot.middlewares.auth import AuthMiddleware
from bot.middlewares.throttling import ThrottlingMiddleware

from bot.handlers import start, objects, tasks, gpr, supply, construction, notifications, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main():
    settings = get_settings()

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Create bot
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    # Create dispatcher
    dp = Dispatcher()

    # Register middlewares
    dp.message.middleware(ThrottlingMiddleware())
    dp.callback_query.middleware(ThrottlingMiddleware())
    dp.message.middleware(AuthMiddleware())
    dp.callback_query.middleware(AuthMiddleware())

    # Register routers
    dp.include_router(start.router)
    dp.include_router(objects.router)
    dp.include_router(tasks.router)
    dp.include_router(gpr.router)
    dp.include_router(supply.router)
    dp.include_router(construction.router)
    dp.include_router(notifications.router)
    dp.include_router(admin.router)

    # Set bot commands
    from aiogram.types import BotCommand
    await bot.set_my_commands([
        BotCommand(command="start", description="Главное меню"),
        BotCommand(command="admin", description="Админ-панель"),
        BotCommand(command="viewas", description="Просмотр от лица роли"),
        BotCommand(command="newobject", description="Создать объект"),
    ])

    logger.info("Bot starting...")

    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
