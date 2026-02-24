from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from bot.db.models import (
    ConstructionObject, ObjectStatus, ObjectRole, UserRole, User
)


async def create_object(
    session: AsyncSession,
    name: str,
    city: str = "",
    address: str = "",
    contract_date: date | None = None,
    deadline_date: date | None = None,
    budget: float | None = None,
    created_by_user_id: int | None = None,
) -> ConstructionObject:
    obj = ConstructionObject(
        name=name, city=city, address=address,
        contract_date=contract_date, deadline_date=deadline_date,
        budget=budget, status=ObjectStatus.DRAFT,
    )
    session.add(obj)
    await session.flush()

    if created_by_user_id:
        role = ObjectRole(
            object_id=obj.id,
            user_id=created_by_user_id,
            role=UserRole.PROJECT_MANAGER,
        )
        session.add(role)
        await session.flush()

    return obj


async def get_user_objects(session: AsyncSession, user: User) -> list[ConstructionObject]:
    if user.role in (UserRole.ADMIN, UserRole.PROJECT_MANAGER):
        result = await session.execute(
            select(ConstructionObject)
            .where(ConstructionObject.status != ObjectStatus.CLOSED)
            .order_by(ConstructionObject.deadline_date)
        )
    else:
        result = await session.execute(
            select(ConstructionObject)
            .join(ObjectRole, ObjectRole.object_id == ConstructionObject.id)
            .where(
                ObjectRole.user_id == user.id,
                ConstructionObject.status != ObjectStatus.CLOSED,
            )
            .order_by(ConstructionObject.deadline_date)
        )
    return result.scalars().all()


async def get_object_by_id(session: AsyncSession, object_id: int) -> ConstructionObject | None:
    result = await session.execute(
        select(ConstructionObject)
        .options(selectinload(ConstructionObject.roles).selectinload(ObjectRole.user))
        .where(ConstructionObject.id == object_id)
    )
    return result.scalar_one_or_none()


async def update_object_status(
    session: AsyncSession, object_id: int, new_status: ObjectStatus
) -> ConstructionObject | None:
    obj = await get_object_by_id(session, object_id)
    if obj:
        obj.status = new_status
        await session.flush()
    return obj


async def assign_user_to_object(
    session: AsyncSession, object_id: int, user_id: int, role: UserRole
):
    existing = await session.execute(
        select(ObjectRole).where(
            ObjectRole.object_id == object_id,
            ObjectRole.user_id == user_id,
            ObjectRole.role == role,
        )
    )
    if existing.scalar_one_or_none():
        return
    obj_role = ObjectRole(object_id=object_id, user_id=user_id, role=role)
    session.add(obj_role)
    await session.flush()


async def get_object_team(session: AsyncSession, object_id: int) -> list[ObjectRole]:
    result = await session.execute(
        select(ObjectRole)
        .options(selectinload(ObjectRole.user))
        .where(ObjectRole.object_id == object_id)
    )
    return result.scalars().all()
