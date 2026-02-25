"""
Production Chain API routes — zones, BOM, materials, warehouse, shipments
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from bot.db.session import async_session
from bot.db.models import (
    Zone, BOMItem, Material, ProductionPlan, ElementStatus,
    Warehouse, Shipment, ConstructionObject,
)

router = APIRouter(prefix="/api/production-chain", tags=["production-chain"])


async def get_db():
    async with async_session() as session:
        yield session


# ── Zones ────────────────────────────────────────────────

@router.get("/{object_id}/zones")
async def get_zones(object_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Zone)
        .where(Zone.object_id == object_id)
        .order_by(Zone.priority.asc(), Zone.name)
    )
    zones = result.scalars().all()

    output = []
    for z in zones:
        # Count BOM items per zone
        bom_total = (await db.execute(
            select(func.count(BOMItem.id)).where(BOMItem.zone_id == z.id)
        )).scalar() or 0
        bom_completed = (await db.execute(
            select(func.count(BOMItem.id)).where(
                BOMItem.zone_id == z.id, BOMItem.status == 'completed'
            )
        )).scalar() or 0

        output.append({
            "id": z.id,
            "name": z.name,
            "floor_axis": z.floor_axis,
            "system_type": z.system_type,
            "volume": z.volume,
            "priority": z.priority,
            "production_start_date": z.production_start_date.isoformat() if z.production_start_date else None,
            "delivery_date": z.delivery_date.isoformat() if z.delivery_date else None,
            "bom_total": bom_total,
            "bom_completed": bom_completed,
            "progress_pct": round(bom_completed / bom_total * 100) if bom_total > 0 else 0,
        })

    return output


# ── BOM Items (per zone) ─────────────────────────────────

@router.get("/{object_id}/zones/{zone_id}/bom")
async def get_bom_items(object_id: int, zone_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BOMItem).where(BOMItem.zone_id == zone_id).order_by(BOMItem.mark)
    )
    items = result.scalars().all()

    output = []
    for item in items:
        # Get warehouse status
        wh = (await db.execute(
            select(Warehouse).where(Warehouse.bom_item_id == item.id)
        )).scalar_one_or_none()

        # Get element status
        es = (await db.execute(
            select(ElementStatus).where(ElementStatus.bom_item_id == item.id)
        )).scalar_one_or_none()

        output.append({
            "id": item.id,
            "mark": item.mark,
            "item_type": item.item_type,
            "material": item.material,
            "quantity": item.quantity,
            "weight": item.weight,
            "status": item.status,
            "element_stage": es.status if es else None,
            "warehouse": {
                "produced_qty": wh.produced_qty,
                "shipped_qty": wh.shipped_qty,
                "remaining": wh.remaining,
                "ready_to_ship": wh.ready_to_ship,
            } if wh else None,
        })

    return output


# ── Materials (per object) ───────────────────────────────

@router.get("/{object_id}/materials")
async def get_materials(object_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Material).order_by(Material.name)
    )
    materials = result.scalars().all()
    return [
        {
            "id": m.id,
            "code": m.code,
            "name": m.name,
            "type": m.type,
            "unit": m.unit,
            "object_demand": m.object_demand,
            "purchased": m.purchased,
            "in_stock": m.in_stock,
            "in_production": m.in_production,
            "deficit": m.deficit,
            "coverage_pct": round(
                (m.purchased or 0) / m.object_demand * 100, 1
            ) if m.object_demand and m.object_demand > 0 else 0,
        }
        for m in materials
    ]


# ── Warehouse (per object via zones) ─────────────────────

@router.get("/{object_id}/warehouse")
async def get_warehouse(object_id: int, db: AsyncSession = Depends(get_db)):
    # Get all zones for this object
    zone_ids = (await db.execute(
        select(Zone.id).where(Zone.object_id == object_id)
    )).scalars().all()

    if not zone_ids:
        return {"summary": {"total": 0, "ready": 0, "shipped": 0}, "items": []}

    # Get BOM items with warehouse data
    result = await db.execute(
        select(BOMItem, Warehouse)
        .outerjoin(Warehouse, Warehouse.bom_item_id == BOMItem.id)
        .where(BOMItem.zone_id.in_(zone_ids))
        .order_by(BOMItem.mark)
    )
    rows = result.all()

    items = []
    total_produced = 0
    total_shipped = 0
    total_remaining = 0
    ready_count = 0

    for bom, wh in rows:
        produced = wh.produced_qty if wh else 0
        shipped = wh.shipped_qty if wh else 0
        remaining = wh.remaining if wh else 0
        ready = wh.ready_to_ship if wh else False

        total_produced += produced
        total_shipped += shipped
        total_remaining += remaining
        if ready:
            ready_count += 1

        items.append({
            "id": bom.id,
            "mark": bom.mark,
            "item_type": bom.item_type,
            "quantity": bom.quantity,
            "produced_qty": produced,
            "shipped_qty": shipped,
            "remaining": remaining,
            "ready_to_ship": ready,
            "ready_date": wh.ready_date.isoformat() if wh and wh.ready_date else None,
        })

    return {
        "summary": {
            "total_items": len(items),
            "total_produced": total_produced,
            "total_shipped": total_shipped,
            "total_remaining": total_remaining,
            "ready_to_ship": ready_count,
        },
        "items": items,
    }


# ── Shipments ────────────────────────────────────────────

@router.get("/{object_id}/shipments")
async def get_shipments(object_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Shipment)
        .where(Shipment.object_id == object_id)
        .order_by(Shipment.ship_date.desc())
    )
    shipments = result.scalars().all()
    return [
        {
            "id": s.id,
            "batch_number": s.batch_number,
            "ship_date": s.ship_date.isoformat() if s.ship_date else None,
            "items_list": s.items_list,
            "quantity": s.quantity,
            "vehicle": s.vehicle,
            "zone_id": s.zone_id,
        }
        for s in shipments
    ]
