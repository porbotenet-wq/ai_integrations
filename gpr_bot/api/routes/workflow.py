"""Workflow API — управление цепочкой этапов проекта"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from bot.db.session import async_session
from bot.db.models import (
    WorkflowTemplate, WorkflowTemplateStep,
    WorkflowInstance, WorkflowInstanceStep,
)
from pydantic import BaseModel
from datetime import date, timedelta

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


async def get_db():
    async with async_session() as session:
        yield session


PHASE_LABELS = {
    "contract": "📄 Договорной",
    "design": "📐 Проектирование",
    "supply": "📦 Снабжение",
    "production": "🏭 Производство",
    "construction": "🏗 Монтаж",
    "acceptance": "✅ Сдача",
}

STATUS_EMOJI = {
    "pending": "⬜", "active": "🔵", "in_progress": "🔷",
    "review": "🟣", "done": "✅", "blocked": "🟡",
}


@router.get("/templates")
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkflowTemplate).order_by(WorkflowTemplate.id)
    )
    templates = result.scalars().all()
    return [
        {"id": t.id, "name": t.name, "description": t.description, "is_default": t.is_default}
        for t in templates
    ]


@router.post("/instances/{object_id}/create")
async def create_workflow_instance(object_id: int, template_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Создать экземпляр workflow для объекта из шаблона"""
    # Check if already exists
    existing = await db.execute(
        select(WorkflowInstance).where(
            WorkflowInstance.object_id == object_id,
            WorkflowInstance.status == "active",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Active workflow already exists for this object")

    # Get template steps
    steps_result = await db.execute(
        select(WorkflowTemplateStep)
        .where(WorkflowTemplateStep.template_id == template_id)
        .order_by(WorkflowTemplateStep.step_number)
    )
    template_steps = steps_result.scalars().all()
    if not template_steps:
        raise HTTPException(404, "Template not found or has no steps")

    # Create instance
    instance = WorkflowInstance(object_id=object_id, template_id=template_id)
    db.add(instance)
    await db.flush()

    # Create instance steps with planned dates
    current_date = date.today()
    for ts in template_steps:
        planned_start = current_date
        duration = ts.duration_days or 1
        planned_end = planned_start + timedelta(days=duration)

        step = WorkflowInstanceStep(
            instance_id=instance.id,
            template_step_id=ts.id,
            step_number=ts.step_number,
            name=ts.name,
            phase=ts.phase,
            status="active" if ts.step_number == 1 else "pending",
            planned_start=planned_start,
            planned_end=planned_end,
        )
        db.add(step)
        current_date = planned_end  # sequential by default

    await db.commit()
    return {"instance_id": instance.id, "steps_created": len(template_steps)}


@router.get("/instances/{object_id}")
async def get_workflow(object_id: int, db: AsyncSession = Depends(get_db)):
    """Получить workflow объекта — сгруппированный по фазам"""
    result = await db.execute(
        select(WorkflowInstance)
        .where(WorkflowInstance.object_id == object_id, WorkflowInstance.status == "active")
    )
    instance = result.scalar_one_or_none()
    if not instance:
        return {"instance": None, "phases": [], "summary": None}

    steps_result = await db.execute(
        select(WorkflowInstanceStep)
        .options(selectinload(WorkflowInstanceStep.assignee))
        .where(WorkflowInstanceStep.instance_id == instance.id)
        .order_by(WorkflowInstanceStep.step_number)
    )
    steps = steps_result.scalars().all()

    today = date.today()
    phases = {}
    total_done = 0
    total_steps = len(steps)

    for s in steps:
        if s.phase not in phases:
            phases[s.phase] = {"phase": s.phase, "label": PHASE_LABELS.get(s.phase, s.phase), "steps": [], "done": 0, "total": 0}

        days_left = (s.planned_end - today).days if s.planned_end else None
        is_overdue = s.status not in ("done", "pending") and days_left is not None and days_left < 0

        phases[s.phase]["steps"].append({
            "id": s.id,
            "step_number": s.step_number,
            "name": s.name,
            "status": s.status,
            "status_emoji": STATUS_EMOJI.get(s.status, "⬜"),
            "assignee": s.assignee.full_name if s.assignee else None,
            "planned_start": s.planned_start.isoformat() if s.planned_start else None,
            "planned_end": s.planned_end.isoformat() if s.planned_end else None,
            "actual_start": s.actual_start.isoformat() if s.actual_start else None,
            "actual_end": s.actual_end.isoformat() if s.actual_end else None,
            "days_left": days_left,
            "overdue": is_overdue,
            "notes": s.notes,
        })
        phases[s.phase]["total"] += 1
        if s.status == "done":
            phases[s.phase]["done"] += 1
            total_done += 1

    phase_list = []
    for phase_key in ["contract", "design", "supply", "production", "construction", "acceptance"]:
        if phase_key in phases:
            p = phases[phase_key]
            p["pct"] = round(p["done"] / p["total"] * 100) if p["total"] > 0 else 0
            phase_list.append(p)

    return {
        "instance": {"id": instance.id, "status": instance.status, "started_at": instance.started_at.isoformat() if instance.started_at else None},
        "phases": phase_list,
        "summary": {
            "total_steps": total_steps,
            "done": total_done,
            "pct": round(total_done / total_steps * 100) if total_steps > 0 else 0,
        },
    }


class StepUpdateRequest(BaseModel):
    status: str | None = None
    notes: str | None = None
    assignee_id: int | None = None


@router.patch("/steps/{step_id}")
async def update_step(step_id: int, req: StepUpdateRequest, db: AsyncSession = Depends(get_db)):
    """Обновить статус шага workflow"""
    step = await db.get(WorkflowInstanceStep, step_id)
    if not step:
        raise HTTPException(404, "Step not found")

    today = date.today()

    if req.status:
        old_status = step.status
        step.status = req.status

        # Track actual dates
        if req.status in ("active", "in_progress") and not step.actual_start:
            step.actual_start = today
        if req.status == "done" and not step.actual_end:
            step.actual_end = today

        # Auto-activate next steps when done
        if req.status == "done":
            next_steps = await db.execute(
                select(WorkflowInstanceStep).where(
                    WorkflowInstanceStep.instance_id == step.instance_id,
                    WorkflowInstanceStep.step_number == step.step_number + 1,
                    WorkflowInstanceStep.status == "pending",
                )
            )
            for ns in next_steps.scalars():
                ns.status = "active"

    if req.notes is not None:
        step.notes = req.notes
    if req.assignee_id is not None:
        step.assignee_id = req.assignee_id

    await db.commit()
    return {"id": step.id, "status": step.status, "name": step.name}
