"""Auth routes — Telegram initData validation + JWT"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from bot.db.session import async_session
from bot.db.models import User, ObjectRole
from bot.config import get_settings
import hashlib
import hmac
import json
import time
import urllib.parse
import jwt

router = APIRouter(prefix="/api/auth", tags=["auth"])

settings = get_settings()
JWT_SECRET = settings.api_secret_key
JWT_ALGO = "HS256"
JWT_EXP = 86400 * 7  # 7 days


class TelegramAuthRequest(BaseModel):
    init_data: str


class TelegramAuthResponse(BaseModel):
    user: dict
    token: str


def verify_init_data(init_data: str, bot_token: str) -> dict | None:
    """Validate Telegram WebApp initData, return user dict or None"""
    try:
        parsed = urllib.parse.parse_qs(init_data)
        received_hash = parsed.get("hash", [None])[0]
        if not received_hash:
            return None

        # Build data check string
        pairs = []
        for key, values in parsed.items():
            if key == "hash":
                continue
            pairs.append(f"{key}={values[0]}")
        pairs.sort()
        data_check_string = "\n".join(pairs)

        # Compute hash
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(computed, received_hash):
            return None

        # Check auth_date freshness (allow 24h)
        auth_date = int(parsed.get("auth_date", ["0"])[0])
        if time.time() - auth_date > 86400:
            return None

        # Parse user
        user_json = parsed.get("user", [None])[0]
        if user_json:
            return json.loads(user_json)
        return None
    except Exception:
        return None


def make_jwt(user_id: int, telegram_id: int, role: str) -> str:
    payload = {
        "sub": user_id,
        "tg": telegram_id,
        "role": role,
        "exp": int(time.time()) + JWT_EXP,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


@router.post("/telegram", response_model=TelegramAuthResponse)
async def auth_telegram(req: TelegramAuthRequest):
    """Authenticate via Telegram WebApp initData"""

    # In dev mode, allow bypass with fake initData
    tg_user = verify_init_data(req.init_data, settings.bot_token)

    # Dev fallback: if initData is just a telegram_id number
    if not tg_user and req.init_data.isdigit():
        tg_user = {"id": int(req.init_data), "first_name": "Dev", "last_name": "User"}

    if not tg_user:
        raise HTTPException(401, "Invalid initData")

    telegram_id = tg_user["id"]

    async with async_session() as db:
        # Find or create user
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()

        if not user:
            first = tg_user.get("first_name", "")
            last = tg_user.get("last_name", "")
            user = User(
                telegram_id=telegram_id,
                username=tg_user.get("username"),
                full_name=f"{first} {last}".strip() or "User",
                role="viewer",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        # Get object roles
        roles_result = await db.execute(
            select(ObjectRole).where(ObjectRole.user_id == user.id)
        )
        obj_roles = [
            {"object_id": r.object_id, "role": r.role.value if hasattr(r.role, 'value') else str(r.role)}
            for r in roles_result.scalars().all()
        ]

        token = make_jwt(user.id, telegram_id, user.role.value if hasattr(user.role, 'value') else str(user.role))

        return TelegramAuthResponse(
            user={
                "id": user.id,
                "telegram_id": user.telegram_id,
                "full_name": user.full_name,
                "username": user.username,
                "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
                "roles": [user.role.value if hasattr(user.role, 'value') else str(user.role)],
                "object_roles": obj_roles,
            },
            token=token,
        )
