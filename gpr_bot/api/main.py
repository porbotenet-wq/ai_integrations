from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from bot.db.session import async_session, init_db
from bot.db.models import (
    ConstructionObject, ObjectStatus, GPR, GPRItem, Task, TaskStatus,
    SupplyOrder, SupplyStatus, ConstructionStage, ConstructionStageStatus,
    Department, User, ObjectRole,
)
from bot.rbac.permissions import DEPARTMENT_NAMES
from pydantic import BaseModel
from datetime import date
import hashlib, hmac
from bot.config import get_settings

app = FastAPI(title="GPR Bot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_db():
    async with async_session() as session:
        yield session


@app.on_event("startup")
async def startup():
    await init_db()


# ─── SCHEMAS ─────────────────────────────────────────────

class GPRItemOut(BaseModel):
    id: int
    department: str
    department_name: str
    title: str
    unit: str | None
    responsible: str | None
    start_date: date | None
    end_date: date | None
    duration_days: int | None
    notes: str | None

    class Config:
        from_attributes = True


class GPROut(BaseModel):
    id: int
    version: int
    status: str
    items: list[GPRItemOut]
    signatures: list[dict]


class DashboardOut(BaseModel):
    active_objects: int
    total_tasks: int
    overdue_tasks: int
    completed_tasks: int
    delayed_supplies: int
    objects: list[dict]


class ObjectSummary(BaseModel):
    id: int
    name: str
    city: str | None
    status: str
    deadline_date: date | None
    task_total: int
    task_done: int
    task_overdue: int


# ─── ROUTES ──────────────────────────────────────────────

@app.get("/api/gpr/{object_id}", response_model=GPROut)
async def get_gpr(object_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GPR)
        .options(
            selectinload(GPR.items),
            selectinload(GPR.signatures).selectinload(
                __import__('bot.db.models', fromlist=['GPRSignature']).GPRSignature.user
            ),
        )
        .where(GPR.object_id == object_id)
    )
    gpr = result.scalar_one_or_none()
    if not gpr:
        raise HTTPException(404, "GPR not found")

    items = [
        GPRItemOut(
            id=item.id,
            department=item.department.value,
            department_name=DEPARTMENT_NAMES.get(item.department, item.department.value),
            title=item.title,
            unit=item.unit,
            responsible=item.responsible,
            start_date=item.start_date,
            end_date=item.end_date,
            duration_days=item.duration_days,
            notes=item.notes,
        )
        for item in gpr.items
    ]

    signatures = [
        {
            "user": sig.user.full_name if sig.user else "—",
            "department": sig.department.value if sig.department else "",
            "signed": sig.signed,
            "signed_at": sig.signed_at.isoformat() if sig.signed_at else None,
        }
        for sig in gpr.signatures
    ]

    return GPROut(id=gpr.id, version=gpr.version, status=gpr.status.value, items=items, signatures=signatures)


@app.get("/api/dashboard", response_model=DashboardOut)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    active_objects = (await db.execute(
        select(func.count(ConstructionObject.id)).where(ConstructionObject.status == ObjectStatus.ACTIVE)
    )).scalar() or 0

    total_tasks = (await db.execute(select(func.count(Task.id)))).scalar() or 0

    overdue_tasks = (await db.execute(
        select(func.count(Task.id)).where(Task.status == TaskStatus.OVERDUE)
    )).scalar() or 0

    completed_tasks = (await db.execute(
        select(func.count(Task.id)).where(Task.status == TaskStatus.DONE)
    )).scalar() or 0

    delayed_supplies = (await db.execute(
        select(func.count(SupplyOrder.id)).where(SupplyOrder.status == SupplyStatus.DELAYED)
    )).scalar() or 0

    # Per-object summaries
    objs_result = await db.execute(
        select(ConstructionObject)
        .where(ConstructionObject.status.in_([ObjectStatus.ACTIVE, ObjectStatus.PLANNING]))
        .order_by(ConstructionObject.deadline_date)
    )
    objects = []
    for obj in objs_result.scalars().all():
        t_total = (await db.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id)
        )).scalar() or 0
        t_done = (await db.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id, Task.status == TaskStatus.DONE)
        )).scalar() or 0
        t_overdue = (await db.execute(
            select(func.count(Task.id)).where(Task.object_id == obj.id, Task.status == TaskStatus.OVERDUE)
        )).scalar() or 0

        objects.append({
            "id": obj.id,
            "name": obj.name,
            "city": obj.city,
            "status": obj.status.value,
            "deadline_date": obj.deadline_date.isoformat() if obj.deadline_date else None,
            "task_total": t_total,
            "task_done": t_done,
            "task_overdue": t_overdue,
            "progress_pct": round(t_done / t_total * 100) if t_total > 0 else 0,
        })

    return DashboardOut(
        active_objects=active_objects,
        total_tasks=total_tasks,
        overdue_tasks=overdue_tasks,
        completed_tasks=completed_tasks,
        delayed_supplies=delayed_supplies,
        objects=objects,
    )


@app.get("/api/objects/{object_id}/tasks")
async def get_object_tasks(
    object_id: int,
    department: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Task)
        .options(selectinload(Task.assignee))
        .where(Task.object_id == object_id)
        .order_by(Task.deadline.asc().nullslast())
    )
    if department:
        query = query.where(Task.department == Department(department))

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        {
            "id": t.id,
            "title": t.title,
            "department": t.department.value,
            "status": t.status.value,
            "assignee": t.assignee.full_name if t.assignee else None,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "priority": t.priority,
        }
        for t in tasks
    ]


@app.get("/api/objects/{object_id}/construction")
async def get_construction_stages(object_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ConstructionStage)
        .options(selectinload(ConstructionStage.checklist))
        .where(ConstructionStage.object_id == object_id)
        .order_by(ConstructionStage.sort_order)
    )
    stages = result.scalars().all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "status": s.status.value,
            "sort_order": s.sort_order,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "checklist": [
                {"id": c.id, "title": c.title, "is_done": c.is_done}
                for c in s.checklist
            ],
        }
        for s in stages
    ]


# ─── PRODUCTION / EXCEL / ANALYTICS / AUTH ROUTES ─────────
from api.routes.production import router as production_router
from api.routes.excel import router as excel_router
from api.routes.analytics import router as analytics_router
from api.routes.auth import router as auth_router

app.include_router(auth_router)
app.include_router(production_router)
app.include_router(excel_router)
app.include_router(analytics_router)

# ─── MINI APP V2 ROUTES ──────────────────────────────────
from api.routes.miniapp import register_miniapp_routes
register_miniapp_routes(app)


@app.get("/health")
async def health():
    return {"status": "ok"}
