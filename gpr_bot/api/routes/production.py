"""Production API routes — план/факт, бригады, виды работ, Excel импорт/экспорт"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from bot.db.session import async_session
from bot.db.models import (
    Crew, WorkType, FloorVolume, GPRWeekly, DailyProgress,
    DailyPlanFact, ConstructionObject,
)
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
import io

router = APIRouter(prefix="/api/production", tags=["production"])


async def get_db():
    async with async_session() as session:
        yield session


# ─── SCHEMAS ─────────────────────────────────────────────

class CrewOut(BaseModel):
    id: int
    code: str
    name: str
    foreman: str | None
    phone: str | None
    specialization: str | None
    max_workers: int
    status: str
    class Config:
        from_attributes = True


class WorkTypeOut(BaseModel):
    id: int
    code: str
    name: str
    unit: str
    category: str | None
    sequence_order: int
    requires_inspection: bool
    class Config:
        from_attributes = True


class FloorVolumeOut(BaseModel):
    floor: int
    facade: str
    work_code: str
    work_name: str
    plan_qty: float
    fact_qty: float
    pct: float
    status: str
    inspection_brackets: str
    inspection_floor: str


class DailyProgressOut(BaseModel):
    date: date
    day_number: int | None
    week_code: str | None
    modules_plan: float
    modules_fact: float
    brackets_plan: float
    brackets_fact: float
    sealant_plan: float
    sealant_fact: float
    hermetic_plan: float
    hermetic_fact: float


class GPRWeeklyOut(BaseModel):
    work_code: str
    work_name: str
    unit: str
    total_volume: float
    weeks: dict  # {"Н1": 200, "Н2": 400, ...}
    fact_total: float
    pct: float


class DashboardProductionOut(BaseModel):
    object_name: str
    period: str
    total_modules: int
    fact_modules: int
    pct_modules: float
    total_brackets: int
    fact_brackets: int
    facades: list[dict]
    kpi: list[dict]


# ─── ROUTES ──────────────────────────────────────────────

@router.get("/crews", response_model=list[CrewOut])
async def list_crews(object_id: int | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Crew).order_by(Crew.code)
    if object_id:
        q = q.where(Crew.object_id == object_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/work-types", response_model=list[WorkTypeOut])
async def list_work_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkType).order_by(WorkType.sequence_order))
    return result.scalars().all()


@router.get("/{object_id}/dashboard", response_model=DashboardProductionOut)
async def production_dashboard(object_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        raise HTTPException(404, "Object not found")

    # KPI по видам работ
    kpi_result = await db.execute(text("""
        SELECT wt.name, wt.unit,
            COALESCE(SUM(fv.plan_qty), 0) as total_plan,
            COALESCE(SUM(fv.fact_qty), 0) as total_fact
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid
        GROUP BY wt.name, wt.unit, wt.sequence_order
        ORDER BY wt.sequence_order
    """), {"oid": object_id})
    kpi = []
    for row in kpi_result:
        plan = float(row[2])
        fact = float(row[3])
        kpi.append({
            "name": row[0], "unit": row[1],
            "plan": plan, "fact": fact,
            "pct": round(fact / plan * 100, 1) if plan > 0 else 0,
            "remaining": plan - fact,
        })

    # По фасадам (модули)
    facade_result = await db.execute(text("""
        SELECT fv.facade,
            COALESCE(SUM(fv.plan_qty), 0),
            COALESCE(SUM(fv.fact_qty), 0)
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid AND wt.code = 'МОД'
        GROUP BY fv.facade ORDER BY fv.facade
    """), {"oid": object_id})
    facades = []
    total_mod_plan = 0
    total_mod_fact = 0
    for row in facade_result:
        p, f = float(row[1]), float(row[2])
        total_mod_plan += p
        total_mod_fact += f
        facades.append({
            "facade": row[0], "plan": int(p), "fact": int(f),
            "pct": round(f / p * 100, 1) if p > 0 else 0,
            "status": "Не начат" if f == 0 else ("Завершён" if f >= p else "В работе"),
        })

    # Кронштейны
    brk_result = await db.execute(text("""
        SELECT COALESCE(SUM(fv.plan_qty), 0), COALESCE(SUM(fv.fact_qty), 0)
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid AND wt.code IN ('КРН-Н', 'КРН-В')
    """), {"oid": object_id})
    brk = brk_result.fetchone()

    return DashboardProductionOut(
        object_name=obj.name,
        period=f"{obj.contract_date} — {obj.deadline_date}" if obj.contract_date else "",
        total_modules=int(total_mod_plan),
        fact_modules=int(total_mod_fact),
        pct_modules=round(total_mod_fact / total_mod_plan * 100, 1) if total_mod_plan > 0 else 0,
        total_brackets=int(float(brk[0])) if brk else 0,
        fact_brackets=int(float(brk[1])) if brk else 0,
        facades=facades,
        kpi=kpi,
    )


@router.get("/{object_id}/floor-volumes")
async def get_floor_volumes(
    object_id: int,
    floor: int | None = None,
    facade: str | None = None,
    work_code: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = text("""
        SELECT fv.floor, fv.facade, wt.code, wt.name,
            fv.plan_qty, fv.fact_qty,
            CASE WHEN fv.plan_qty > 0 THEN ROUND(fv.fact_qty / fv.plan_qty * 100, 1) ELSE 0 END as pct,
            fv.status, fv.inspection_brackets, fv.inspection_floor
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid
        ORDER BY fv.floor, fv.facade, wt.sequence_order
    """)
    result = await db.execute(q, {"oid": object_id})
    rows = result.fetchall()

    data = []
    for r in rows:
        if floor and r[0] != floor:
            continue
        if facade and facade not in r[1]:
            continue
        if work_code and r[2] != work_code:
            continue
        data.append(FloorVolumeOut(
            floor=r[0], facade=r[1], work_code=r[2], work_name=r[3],
            plan_qty=float(r[4]), fact_qty=float(r[5]), pct=float(r[6]),
            status=r[7], inspection_brackets=r[8], inspection_floor=r[9],
        ))
    return data


@router.get("/{object_id}/daily-progress", response_model=list[DailyProgressOut])
async def get_daily_progress(
    object_id: int,
    week: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(DailyProgress).where(DailyProgress.object_id == object_id).order_by(DailyProgress.date)
    if week:
        q = q.where(DailyProgress.week_code == week)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{object_id}/gpr-weekly")
async def get_gpr_weekly(object_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT wt.code, wt.name, wt.unit,
            gw.week_code, gw.plan_qty, gw.fact_qty
        FROM gpr_weekly gw
        JOIN work_types wt ON wt.id = gw.work_type_id
        WHERE gw.object_id = :oid
        ORDER BY wt.sequence_order, gw.week_code
    """), {"oid": object_id})

    grouped = {}
    for row in result:
        code = row[0]
        if code not in grouped:
            grouped[code] = {
                "work_code": code, "work_name": row[1], "unit": row[2],
                "weeks": {}, "total_volume": 0, "fact_total": 0,
            }
        grouped[code]["weeks"][row[3]] = {"plan": float(row[4]), "fact": float(row[5])}
        grouped[code]["total_volume"] += float(row[4])
        grouped[code]["fact_total"] += float(row[5])

    out = []
    for v in grouped.values():
        tv = v["total_volume"]
        ft = v["fact_total"]
        out.append(GPRWeeklyOut(
            work_code=v["work_code"], work_name=v["work_name"], unit=v["unit"],
            total_volume=tv, weeks=v["weeks"], fact_total=ft,
            pct=round(ft / tv * 100, 1) if tv > 0 else 0,
        ))
    return out


@router.get("/{object_id}/plan-fact")
async def get_plan_fact(
    object_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    work_code: str | None = None,
    crew_code: str | None = None,
    floor: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(DailyPlanFact).where(DailyPlanFact.object_id == object_id)
    if date_from:
        q = q.where(DailyPlanFact.date >= date_from)
    if date_to:
        q = q.where(DailyPlanFact.date <= date_to)
    if work_code:
        q = q.where(DailyPlanFact.work_code == work_code)
    if crew_code:
        q = q.where(DailyPlanFact.crew_code == crew_code)
    if floor:
        q = q.where(DailyPlanFact.floor == floor)
    q = q.order_by(DailyPlanFact.date, DailyPlanFact.sequence_order)

    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id, "date": r.date.isoformat() if r.date else None,
            "day_number": r.day_number, "floor": r.floor, "facade": r.facade,
            "work_name": r.work_name, "work_code": r.work_code,
            "sequence_order": r.sequence_order,
            "plan": r.plan_daily, "fact": r.fact_volume,
            "deviation": r.deviation, "pct": r.completion_pct,
            "crew_code": r.crew_code, "workers": r.workers_count,
            "productivity": r.productivity,
            "inspection_status": r.inspection_status,
            "cumulative_plan": r.cumulative_plan,
            "cumulative_fact": r.cumulative_fact,
        }
        for r in rows
    ]
