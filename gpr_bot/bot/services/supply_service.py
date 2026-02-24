from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from bot.db.models import SupplyOrder, SupplyStatus


async def create_supply_order(
    session: AsyncSession,
    object_id: int,
    material_name: str,
    created_by_id: int,
    quantity: float | None = None,
    unit: str = "",
    expected_date: date | None = None,
    delivery_location: str = "",
) -> SupplyOrder:
    order = SupplyOrder(
        object_id=object_id,
        material_name=material_name,
        quantity=quantity,
        unit=unit,
        status=SupplyStatus.REQUESTED,
        expected_date=expected_date,
        delivery_location=delivery_location,
        created_by_id=created_by_id,
    )
    session.add(order)
    await session.flush()
    return order


async def get_object_supplies(
    session: AsyncSession, object_id: int, status_filter: SupplyStatus | None = None
) -> list[SupplyOrder]:
    query = (
        select(SupplyOrder)
        .where(SupplyOrder.object_id == object_id)
        .order_by(SupplyOrder.expected_date.asc().nullslast())
    )
    if status_filter:
        query = query.where(SupplyOrder.status == status_filter)
    result = await session.execute(query)
    return result.scalars().all()


async def get_supply_by_id(session: AsyncSession, order_id: int) -> SupplyOrder | None:
    result = await session.execute(
        select(SupplyOrder)
        .options(selectinload(SupplyOrder.created_by), selectinload(SupplyOrder.approved_by))
        .where(SupplyOrder.id == order_id)
    )
    return result.scalar_one_or_none()


async def approve_supply(session: AsyncSession, order_id: int, approved_by_id: int) -> SupplyOrder | None:
    order = await get_supply_by_id(session, order_id)
    if not order or order.status != SupplyStatus.REQUESTED:
        return None
    order.status = SupplyStatus.APPROVED
    order.approved_by_id = approved_by_id
    await session.flush()
    return order


async def update_supply_status(
    session: AsyncSession, order_id: int, new_status: SupplyStatus,
    actual_date: date | None = None,
) -> SupplyOrder | None:
    order = await get_supply_by_id(session, order_id)
    if not order:
        return None
    order.status = new_status
    if actual_date:
        order.actual_date = actual_date
    await session.flush()
    return order


async def get_delayed_supplies(session: AsyncSession) -> list[SupplyOrder]:
    today = date.today()
    result = await session.execute(
        select(SupplyOrder)
        .where(
            SupplyOrder.expected_date < today,
            SupplyOrder.status.in_([
                SupplyStatus.REQUESTED, SupplyStatus.APPROVED,
                SupplyStatus.ORDERED, SupplyStatus.SHIPPED,
            ]),
        )
    )
    return result.scalars().all()
