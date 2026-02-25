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
    Warehouse, Shipment, ConstructionObject, ObjectChat,
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


# ── Element Status (tracking pipeline) ───────────────────

STAGE_ORDER = ['design', 'production_queue', 'in_production', 'quality_check', 'warehouse', 'shipped', 'installed']
STAGE_LABELS = {
    'design': 'Проектирование',
    'production_queue': 'Очередь произв.',
    'in_production': 'В производстве',
    'quality_check': 'Контроль качества',
    'warehouse': 'На складе',
    'shipped': 'Отгружено',
    'installed': 'Смонтировано',
}


@router.get("/{object_id}/element-status")
async def get_element_status(object_id: int, db: AsyncSession = Depends(get_db)):
    """Get element tracking pipeline — BOM items grouped by production stage."""
    # Get all zones for this object
    zone_ids = (await db.execute(
        select(Zone.id).where(Zone.object_id == object_id)
    )).scalars().all()

    if not zone_ids:
        return {"stages": [], "summary": {}}

    # Get BOM items with element status and zone info
    result = await db.execute(
        select(BOMItem, ElementStatus, Zone)
        .outerjoin(ElementStatus, ElementStatus.bom_item_id == BOMItem.id)
        .join(Zone, Zone.id == BOMItem.zone_id)
        .where(BOMItem.zone_id.in_(zone_ids))
        .order_by(BOMItem.mark)
    )
    rows = result.all()

    # Group by stage
    by_stage: dict[str, list] = {s: [] for s in STAGE_ORDER}
    total = 0
    total_defects = 0

    for bom, es, zone in rows:
        stage = es.status if es else 'design'
        if stage not in by_stage:
            stage = 'design'
        total += 1
        defects = es.defect_count if es else 0
        total_defects += defects

        by_stage[stage].append({
            "id": bom.id,
            "mark": bom.mark,
            "item_type": bom.item_type,
            "material": bom.material,
            "quantity": bom.quantity,
            "zone_name": zone.name,
            "completion_pct": es.completion_pct if es else 0,
            "defect_count": defects,
            "time_norm": es.time_norm if es else None,
            "time_fact": es.time_fact if es else None,
            "comment": es.comment if es else None,
            "stage_date": es.stage_date.isoformat() if es and es.stage_date else None,
        })

    stages = []
    for s in STAGE_ORDER:
        items = by_stage[s]
        stages.append({
            "key": s,
            "label": STAGE_LABELS[s],
            "count": len(items),
            "items": items,
        })

    # Summary
    completed_stages = {'warehouse', 'shipped', 'installed'}
    done = sum(len(by_stage[s]) for s in completed_stages)

    return {
        "stages": stages,
        "summary": {
            "total": total,
            "done": done,
            "in_progress": total - done,
            "defects": total_defects,
            "completion_pct": round(done / total * 100) if total > 0 else 0,
        },
    }


# ── Object Chats (linked TG groups) ──────────────────────

@router.get("/{object_id}/chats")
async def get_object_chats(object_id: int, db: AsyncSession = Depends(get_db)):
    """Get TG chats linked to this object."""
    result = await db.execute(
        select(ObjectChat)
        .where(ObjectChat.object_id == object_id, ObjectChat.is_active == True)
        .order_by(ObjectChat.created_at.desc())
    )
    chats = result.scalars().all()
    return [
        {
            "id": c.id,
            "chat_id": c.chat_id,
            "chat_title": c.chat_title,
            "chat_type": c.chat_type,
            "task_id": c.task_id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in chats
    ]
