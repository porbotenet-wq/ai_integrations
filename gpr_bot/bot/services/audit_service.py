from sqlalchemy.ext.asyncio import AsyncSession
from bot.db.models import AuditLog


async def log_action(
    session: AsyncSession,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
    )
    session.add(entry)
    await session.flush()
    return entry
