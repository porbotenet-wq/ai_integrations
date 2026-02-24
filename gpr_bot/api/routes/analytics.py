"""Analytics API — Claude-powered анализ данных проекта"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from bot.db.session import async_session
from bot.db.models import ConstructionObject
from pydantic import BaseModel
import os
import json
import httpx

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")


async def get_db():
    async with async_session() as session:
        yield session


class AskRequest(BaseModel):
    question: str
    object_id: int | None = None


class AskResponse(BaseModel):
    answer: str
    data_context: dict | None = None


async def get_project_context(db: AsyncSession, object_id: int) -> str:
    """Собрать контекст проекта для Claude"""
    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        return "Объект не найден"

    # KPI
    kpi = await db.execute(text("""
        SELECT wt.name, wt.unit,
            COALESCE(SUM(fv.plan_qty),0) as plan,
            COALESCE(SUM(fv.fact_qty),0) as fact
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid
        GROUP BY wt.name, wt.unit, wt.sequence_order
        ORDER BY wt.sequence_order
    """), {"oid": object_id})
    kpi_rows = kpi.fetchall()

    # По фасадам
    facades = await db.execute(text("""
        SELECT fv.facade,
            COALESCE(SUM(CASE WHEN wt.code='МОД' THEN fv.plan_qty END),0) as mod_plan,
            COALESCE(SUM(CASE WHEN wt.code='МОД' THEN fv.fact_qty END),0) as mod_fact
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid
        GROUP BY fv.facade ORDER BY fv.facade
    """), {"oid": object_id})
    facade_rows = facades.fetchall()

    # Бригады
    crews = await db.execute(text("""
        SELECT code, name, specialization, max_workers, status FROM crews ORDER BY code
    """))
    crew_rows = crews.fetchall()

    # Последние записи план-факт
    recent = await db.execute(text("""
        SELECT date, floor, facade, work_name, plan_daily, fact_volume, crew_code
        FROM daily_plan_fact
        WHERE object_id = :oid
        ORDER BY date DESC, sequence_order
        LIMIT 30
    """), {"oid": object_id})
    recent_rows = recent.fetchall()

    # ГПР понедельно
    gpr = await db.execute(text("""
        SELECT wt.name, gw.week_code, gw.plan_qty, gw.fact_qty
        FROM gpr_weekly gw
        JOIN work_types wt ON wt.id = gw.work_type_id
        WHERE gw.object_id = :oid
        ORDER BY wt.sequence_order, gw.week_code
    """), {"oid": object_id})
    gpr_rows = gpr.fetchall()

    ctx = f"""ПРОЕКТ: {obj.name}
Адрес: {obj.address}
Период: {obj.contract_date} — {obj.deadline_date}
Статус: {obj.status.value if hasattr(obj.status, 'value') else obj.status}
Тип фасада: {obj.facade_type}
Объём: {obj.total_volume}

KPI ПО ВИДАМ РАБОТ:
"""
    for r in kpi_rows:
        plan, fact = float(r[2]), float(r[3])
        pct = round(fact / plan * 100, 1) if plan > 0 else 0
        ctx += f"  {r[0]} ({r[1]}): план={plan}, факт={fact}, {pct}%\n"

    ctx += "\nПО ФАСАДАМ (модули):\n"
    for r in facade_rows:
        p, f = float(r[1]), float(r[2])
        pct = round(f / p * 100, 1) if p > 0 else 0
        ctx += f"  {r[0]}: план={int(p)}, факт={int(f)}, {pct}%\n"

    ctx += "\nБРИГАДЫ:\n"
    for r in crew_rows:
        ctx += f"  {r[0]} {r[1]}: {r[2]}, макс {r[3]} чел, статус={r[4]}\n"

    ctx += "\nПОСЛЕДНИЕ ЗАПИСИ ПЛАН-ФАКТ:\n"
    for r in recent_rows:
        ctx += f"  {r[0]} | эт.{r[1]} {r[2]} | {r[3]}: план={r[4]}, факт={r[5]}, бригада={r[6]}\n"

    ctx += "\nГПР ПОНЕДЕЛЬНО:\n"
    for r in gpr_rows:
        ctx += f"  {r[0]} | {r[1]}: план={float(r[2])}, факт={float(r[3])}\n"

    return ctx


@router.post("/ask", response_model=AskResponse)
async def ask_analytics(req: AskRequest, db: AsyncSession = Depends(get_db)):
    """Задать вопрос Claude о данных проекта"""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")

    object_id = req.object_id
    if not object_id:
        # Берём первый активный объект
        r = await db.execute(text("SELECT id FROM objects WHERE status='active' LIMIT 1"))
        row = r.fetchone()
        if not row:
            raise HTTPException(404, "No active objects")
        object_id = row[0]

    context = await get_project_context(db, object_id)

    system_prompt = """Ты — аналитик строительного проекта СПК (светопрозрачные конструкции).
Отвечай на русском, кратко и по делу. Используй данные из контекста.
Если спрашивают про отклонения — считай разницу план/факт.
Если спрашивают про прогноз — экстраполируй текущий темп.
Форматируй числа с единицами измерения."""

    messages = [
        {"role": "user", "content": f"<context>\n{context}\n</context>\n\nВопрос: {req.question}"}
    ]

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": CLAUDE_MODEL,
                "max_tokens": 2048,
                "system": system_prompt,
                "messages": messages,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(502, f"Claude API error: {resp.status_code} {resp.text[:200]}")

    data = resp.json()
    answer = data.get("content", [{}])[0].get("text", "Нет ответа")

    return AskResponse(answer=answer, data_context={"object_id": object_id})


@router.get("/{object_id}/summary")
async def project_summary(object_id: int, db: AsyncSession = Depends(get_db)):
    """Сводка по проекту без Claude — чистые данные"""
    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        raise HTTPException(404, "Object not found")

    # Общий прогресс
    total = await db.execute(text("""
        SELECT
            COALESCE(SUM(plan_qty),0) as total_plan,
            COALESCE(SUM(fact_qty),0) as total_fact
        FROM floor_volumes WHERE object_id = :oid
    """), {"oid": object_id})
    t = total.fetchone()
    total_plan = float(t[0])
    total_fact = float(t[1])

    # Отстающие этажи (модули)
    lagging = await db.execute(text("""
        SELECT fv.floor, fv.facade, fv.plan_qty, fv.fact_qty
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid AND wt.code = 'МОД'
            AND fv.fact_qty < fv.plan_qty AND fv.plan_qty > 0
        ORDER BY (fv.fact_qty / fv.plan_qty) ASC
        LIMIT 10
    """), {"oid": object_id})

    return {
        "object": {"id": obj.id, "name": obj.name, "status": obj.status.value if hasattr(obj.status, 'value') else str(obj.status)},
        "total_plan": total_plan,
        "total_fact": total_fact,
        "total_pct": round(total_fact / total_plan * 100, 1) if total_plan > 0 else 0,
        "lagging_floors": [
            {"floor": r[0], "facade": r[1], "plan": float(r[2]), "fact": float(r[3]),
             "pct": round(float(r[3]) / float(r[2]) * 100, 1) if float(r[2]) > 0 else 0}
            for r in lagging
        ],
    }
