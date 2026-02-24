from typing import Any, Awaitable, Callable, Dict
from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Message, CallbackQuery
import time

_user_last_action: dict[int, float] = {}
THROTTLE_SECONDS = 0.5


class ThrottlingMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        user_id = None
        if isinstance(event, Message) and event.from_user:
            user_id = event.from_user.id
        elif isinstance(event, CallbackQuery) and event.from_user:
            user_id = event.from_user.id

        if user_id:
            now = time.monotonic()
            last = _user_last_action.get(user_id, 0)
            if now - last < THROTTLE_SECONDS:
                if isinstance(event, CallbackQuery):
                    await event.answer("⏳ Подождите...")
                return
            _user_last_action[user_id] = now

        return await handler(event, data)
