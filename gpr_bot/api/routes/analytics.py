"""Analytics API — AI-powered анализ данных проекта (Kimi / Anthropic / OpenAI-compatible)"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from bot.db.session import async_session
from bot.db.models import ConstructionObject, AIChatMessage
from pydantic import BaseModel
from typing import Optional
import json
import httpx

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Config loaded from Settings (bot/config.py) via env
from bot.config import get_settings
_s = get_settings()
AI_PROVIDER = _s.ai_provider
AI_API_KEY = _s.ai_api_key
AI_MODEL = _s.ai_model
AI_BASE_URL = _s.ai_base_url


async def get_db():
    async with async_session() as session:
        yield session


class AskRequest(BaseModel):
    question: str
    object_id: int | None = None
    telegram_id: int | None = None
    role: str | None = None  # foreman | manager | director


class AskResponse(BaseModel):
    answer: str
    data_context: dict | None = None


# Роль-зависимые подсказки
ROLE_HINTS = {
    "foreman": [
        "Какой прогресс на моём этаже?",
        "Что осталось сделать сегодня?",
        "Какие материалы нужны на завтра?",
        "Отклонения по моему участку",
        "Сколько бригад работает?",
    ],
    "manager": [
        "Сводка отклонений по всем фасадам",
        "Какие работы критически отстают?",
        "Прогноз завершения по текущим темпам",
        "Топ-5 проблемных этажей",
        "Загрузка бригад на этой неделе",
    ],
    "director": [
        "Общий прогресс и прогноз сроков",
        "Риски срыва дедлайна",
        "Сравнение план/факт по месяцам",
        "Какие ресурсы нужно добавить?",
        "Финансовые отклонения",
    ],
    "default": [
        "Какой общий прогресс по объекту?",
        "Какие работы отстают от плана?",
        "Прогноз завершения по текущим темпам?",
        "Какие материалы в дефиците?",
        "Сводка по фасадам",
    ],
}


SYSTEM_PROMPT = """Ты — аналитик строительного проекта СПК (светопрозрачные конструкции).
Отвечай на русском, кратко и по делу. Используй данные из контекста.
Если спрашивают про отклонения — считай разницу план/факт.
Если спрашивают про прогноз — экстраполируй текущий темп.
Форматируй числа с единицами измерения."""


async def get_project_context(db: AsyncSession, object_id: int) -> str:
    """Собрать контекст проекта для AI"""
    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        return "Объект не найден"

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

    crews = await db.execute(text(
        "SELECT code, name, specialization, max_workers, status FROM crews ORDER BY code"
    ))
    crew_rows = crews.fetchall()

    recent = await db.execute(text("""
        SELECT date, floor, facade, work_name, plan_daily, fact_volume, crew_code
        FROM daily_plan_fact
        WHERE object_id = :oid
        ORDER BY date DESC, sequence_order LIMIT 30
    """), {"oid": object_id})
    recent_rows = recent.fetchall()

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

    return ctx


async def call_ai(system: str, user_msg: str) -> str:
    """Универсальный вызов AI — Kimi/OpenAI-compatible или Anthropic"""
    if not AI_API_KEY:
        raise HTTPException(500, "AI_API_KEY not configured. Set AI_API_KEY or KIMI_API_KEY in .env")

    async with httpx.AsyncClient(timeout=60) as client:
        if AI_PROVIDER == "anthropic":
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": AI_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": AI_MODEL,
                    "max_tokens": 2048,
                    "system": system,
                    "messages": [{"role": "user", "content": user_msg}],
                },
            )
            if resp.status_code != 200:
                raise HTTPException(502, f"Anthropic API error: {resp.status_code}")
            data = resp.json()
            return data.get("content", [{}])[0].get("text", "Нет ответа")
        else:
            # OpenAI-compatible: Kimi, OpenAI, DeepSeek, etc.
            body = {
                "model": AI_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                "max_tokens": 2048,
            }
            # kimi-k2.5 only allows temperature=1
            if "k2" not in AI_MODEL:
                body["temperature"] = 0.3

            resp = await client.post(
                f"{AI_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {AI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            if resp.status_code != 200:
                raise HTTPException(502, f"AI API error ({AI_PROVIDER}): {resp.status_code} {resp.text[:200]}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]


@router.post("/ask", response_model=AskResponse)
async def ask_analytics(req: AskRequest, db: AsyncSession = Depends(get_db)):
    """Задать вопрос AI о данных проекта"""
    object_id = req.object_id
    if not object_id:
        r = await db.execute(text("SELECT id FROM objects WHERE status='active' LIMIT 1"))
        row = r.fetchone()
        if not row:
            raise HTTPException(404, "No active objects")
        object_id = row[0]

    context = await get_project_context(db, object_id)

    # Добавляем роль-контекст в system prompt
    role_ctx = ""
    if req.role and req.role in ROLE_HINTS:
        role_ctx = f"\nПользователь — {req.role}. Адаптируй ответ под его уровень."

    system = SYSTEM_PROMPT + role_ctx
    user_msg = f"<context>\n{context}\n</context>\n\nВопрос: {req.question}"
    answer = await call_ai(system, user_msg)

    # Сохраняем в историю
    db.add(AIChatMessage(
        object_id=object_id, telegram_id=req.telegram_id,
        role="user", text=req.question, provider=AI_PROVIDER, model=AI_MODEL,
    ))
    db.add(AIChatMessage(
        object_id=object_id, telegram_id=req.telegram_id,
        role="assistant", text=answer, provider=AI_PROVIDER, model=AI_MODEL,
    ))
    await db.commit()

    return AskResponse(answer=answer, data_context={"object_id": object_id, "provider": AI_PROVIDER})


@router.get("/history/{object_id}")
async def get_chat_history(
    object_id: int,
    telegram_id: int | None = None,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Получить историю AI-чата по объекту"""
    query = (
        select(AIChatMessage)
        .where(AIChatMessage.object_id == object_id)
        .order_by(desc(AIChatMessage.created_at))
        .limit(limit)
    )
    if telegram_id:
        query = query.where(AIChatMessage.telegram_id == telegram_id)

    result = await db.execute(query)
    messages = result.scalars().all()

    return [
        {
            "id": m.id,
            "role": m.role,
            "text": m.text,
            "provider": m.provider,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in reversed(messages)
    ]


@router.get("/hints")
async def get_role_hints(role: str = "default"):
    """Получить подсказки для роли"""
    return {"role": role, "hints": ROLE_HINTS.get(role, ROLE_HINTS["default"])}


@router.get("/{object_id}/export/csv")
async def export_plan_fact_csv(object_id: int, db: AsyncSession = Depends(get_db)):
    """Экспорт план/факт в CSV (для Google Sheets импорта)"""
    from fastapi.responses import StreamingResponse
    import io, csv

    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        raise HTTPException(404, "Object not found")

    # Floor volumes with work types
    result = await db.execute(text("""
        SELECT fv.floor, fv.facade, wt.name as work_name, wt.unit,
            fv.plan_qty, fv.fact_qty,
            CASE WHEN fv.plan_qty > 0 THEN ROUND((fv.fact_qty / fv.plan_qty * 100)::numeric, 1) ELSE 0 END as pct,
            fv.status
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid
        ORDER BY fv.facade, fv.floor, wt.sequence_order
    """), {"oid": object_id})
    rows = result.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Этаж", "Фасад", "Вид работ", "Ед.изм.", "План", "Факт", "Выполнение %", "Статус"])
    for r in rows:
        writer.writerow([r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]])

    output.seek(0)
    filename = f"plan_fact_{object_id}.csv"
    return StreamingResponse(
        iter(["\ufeff" + output.getvalue()]),  # BOM for Excel UTF-8
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{object_id}/export/sheets-url")
async def get_sheets_import_url(object_id: int, db: AsyncSession = Depends(get_db)):
    """Получить URL для импорта в Google Sheets через IMPORTDATA"""
    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        raise HTTPException(404, "Object not found")

    # Формируем URL для IMPORTDATA
    from bot.config import get_settings
    s = get_settings()
    base = s.webapp_url.rstrip("/") if s.webapp_url else "http://localhost:8000"
    csv_url = f"{base}/api/analytics/{object_id}/export/csv"

    return {
        "csv_url": csv_url,
        "sheets_formula": f'=IMPORTDATA("{csv_url}")',
        "instructions": "Вставьте формулу в ячейку A1 нового Google Sheet. Данные обновляются автоматически.",
    }


@router.get("/{object_id}/summary")
async def project_summary(object_id: int, db: AsyncSession = Depends(get_db)):
    """Сводка по проекту без AI — чистые данные"""
    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        raise HTTPException(404, "Object not found")

    total = await db.execute(text("""
        SELECT COALESCE(SUM(plan_qty),0), COALESCE(SUM(fact_qty),0)
        FROM floor_volumes WHERE object_id = :oid
    """), {"oid": object_id})
    t = total.fetchone()
    total_plan, total_fact = float(t[0]), float(t[1])

    lagging = await db.execute(text("""
        SELECT fv.floor, fv.facade, fv.plan_qty, fv.fact_qty
        FROM floor_volumes fv
        JOIN work_types wt ON wt.id = fv.work_type_id
        WHERE fv.object_id = :oid AND wt.code = 'МОД'
            AND fv.fact_qty < fv.plan_qty AND fv.plan_qty > 0
        ORDER BY (fv.fact_qty / fv.plan_qty) ASC LIMIT 10
    """), {"oid": object_id})

    return {
        "object": {"id": obj.id, "name": obj.name,
                    "status": obj.status.value if hasattr(obj.status, 'value') else str(obj.status)},
        "total_plan": total_plan,
        "total_fact": total_fact,
        "total_pct": round(total_fact / total_plan * 100, 1) if total_plan > 0 else 0,
        "lagging_floors": [
            {"floor": r[0], "facade": r[1], "plan": float(r[2]), "fact": float(r[3]),
             "pct": round(float(r[3]) / float(r[2]) * 100, 1) if float(r[2]) > 0 else 0}
            for r in lagging
        ],
    }
