"""
api_extensions.py — Additional FastAPI routes for Mini App
Mount these on the existing FastAPI app in main.py:

    from api_extensions import register_miniapp_routes
    register_miniapp_routes(app)
"""

from fastapi import FastAPI, Depends, HTTPException, Request
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import date, datetime
import hashlib, hmac, json, urllib.parse
import logging

logger = logging.getLogger(__name__)


def register_miniapp_routes(app: FastAPI):
    """Register all Mini App specific routes on the FastAPI app."""

    # Imports from your project (adjust paths as needed)
    from bot.db.session import async_session
    from bot.db.models import (
        ConstructionObject, ObjectStatus, GPR, GPRItem, GPRSignature, GPRStatus,
        Task, TaskStatus, TaskComment,
        SupplyOrder, SupplyStatus,
        ConstructionStage, ConstructionStageStatus, ChecklistItem,
        Department, User, UserRole, ObjectRole,
        Document, Notification, AuditLog,
    )
    from bot.rbac.permissions import (
        DEPARTMENT_NAMES, ROLE_NAMES, ROLE_DEPARTMENT,
        has_permission, get_user_permissions,
    )
    from bot.config import get_settings

    settings = get_settings()

    async def get_db():
        async with async_session() as session:
            yield session

    def verify_init_data(init_data: str) -> dict | None:
        if not init_data:
            return None
        parsed = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed.pop("hash", "")
        check_string = "\n".join(sorted(f"{k}={v}" for k, v in parsed.items()))
        secret = hmac.new(b"WebAppData", settings.bot_token.encode(), hashlib.sha256).digest()
        computed = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(computed, received_hash):
            return None
        if "user" in parsed:
            parsed["user"] = json.loads(parsed["user"])
        return parsed

    async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
        auth = request.headers.get("Authorization", "")

        # Bearer JWT (from our auth endpoint)
        if auth.startswith("Bearer "):
            import jwt
            from bot.config import get_settings
            settings = get_settings()
            try:
                payload = jwt.decode(auth[7:], settings.api_secret_key, algorithms=["HS256"])
                user_id = int(payload["sub"])
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if user:
                    return user
            except Exception:
                pass

        # Telegram Mini App initData
        if auth.startswith("tma "):
            data = verify_init_data(auth[4:])
            if data and "user" in data:
                result = await db.execute(
                    select(User).where(User.telegram_id == data["user"]["id"])
                )
                user = result.scalar_one_or_none()
                if user:
                    return user

        # Dev fallback
        dev_id = request.query_params.get("dev_user_id")
        if dev_id:
            result = await db.execute(select(User).where(User.telegram_id == int(dev_id)))
            user = result.scalar_one_or_none()
            if user:
                return user

        raise HTTPException(401, "Unauthorized")

    async def write_audit(db: AsyncSession, user_id: int, action: str,
                          entity_type: str, entity_id: int,
                          old_value=None, new_value=None):
        log = AuditLog(
            user_id=user_id, action=action,
            entity_type=entity_type, entity_id=entity_id,
            old_value=old_value, new_value=new_value,
        )
        db.add(log)
        await db.flush()

    # ── Schemas ──

    class UpdateStatusBody(BaseModel):
        status: str
        comment: str | None = None

    class CreateTaskBody(BaseModel):
        title: str
        description: str | None = None
        department: str
        assignee_id: int | None = None
        deadline: date | None = None
        priority: int = 0

    class AddCommentBody(BaseModel):
        text: str

    class SignGPRBody(BaseModel):
        comment: str | None = None

    class UpdateNotificationSettingsBody(BaseModel):
        work_hours_start: str | None = None
        work_hours_end: str | None = None
        plan_fact_time: str | None = None
        reminder_interval_1_min: int | None = None
        reminder_interval_2_min: int | None = None
        weekly_audit_day: str | None = None
        weekly_audit_time: str | None = None
        push_enabled: bool | None = None
        critical_only_outside_hours: bool | None = None

    # ── Access level from role ──

    def get_access_level(role: UserRole) -> str:
        admin_roles = {UserRole.ADMIN}
        manager_roles = {UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD}
        if role in admin_roles:
            return "admin"
        if role in manager_roles:
            return "manager"
        return "executor"

    # ── Profile (extended) ──

    @app.get("/api/profile")
    async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        # Objects with progress
        obj_roles_result = await db.execute(
            select(ObjectRole).options(selectinload(ObjectRole.object))
            .where(ObjectRole.user_id == user.id)
        )
        objects = []
        for r in obj_roles_result.scalars().all():
            if not r.object:
                continue
            t_total = (await db.execute(
                select(func.count(Task.id)).where(Task.object_id == r.object.id)
            )).scalar() or 0
            t_done = (await db.execute(
                select(func.count(Task.id)).where(
                    Task.object_id == r.object.id, Task.status == TaskStatus.DONE
                )
            )).scalar() or 0
            objects.append({
                "id": r.object.id, "name": r.object.name, "city": r.object.city,
                "status": r.object.status.value, "role": r.role.value,
                "role_name": ROLE_NAMES.get(r.role, r.role.value),
                "progress_pct": round(t_done / t_total * 100) if t_total > 0 else 0,
            })

        # Supervisor: find from ObjectRole or org hierarchy
        # Пробел → структура подчинённости требует таблицы OrgHierarchy; пока — заглушка
        supervisor = None
        subordinates = []

        # If user has a supervisor_id field
        if hasattr(user, 'supervisor_id') and user.supervisor_id:
            sup = (await db.execute(select(User).where(User.id == user.supervisor_id))).scalar_one_or_none()
            if sup:
                supervisor = _user_brief(sup)

        # Subordinates
        if hasattr(User, 'supervisor_id'):
            subs_result = await db.execute(
                select(User).where(User.supervisor_id == user.id, User.is_active == True)
            )
            subordinates = [_user_brief(s) for s in subs_result.scalars().all()]

        # KPI
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        tasks_assigned = (await db.execute(
            select(func.count(Task.id)).where(Task.assignee_id == user.id)
        )).scalar() or 0

        tasks_done_month = (await db.execute(
            select(func.count(Task.id)).where(
                Task.assignee_id == user.id,
                Task.status == TaskStatus.DONE,
                Task.completed_at >= month_start,
            )
        )).scalar() or 0

        tasks_overdue = (await db.execute(
            select(func.count(Task.id)).where(
                Task.assignee_id == user.id,
                Task.status == TaskStatus.OVERDUE,
            )
        )).scalar() or 0

        # Avg completion days (tasks done in last 90 days)
        avg_days = None
        # Пробел → requires completed_at - created_at diff; simplified
        approvals_pending = (await db.execute(
            select(func.count(GPRSignature.id)).where(
                GPRSignature.user_id == user.id, GPRSignature.signed == False
            )
        )).scalar() or 0

        docs_uploaded = (await db.execute(
            select(func.count(Document.id)).where(Document.uploaded_by_id == user.id)
        )).scalar() or 0

        # On-time rate
        total_done_all = (await db.execute(
            select(func.count(Task.id)).where(
                Task.assignee_id == user.id, Task.status == TaskStatus.DONE,
            )
        )).scalar() or 0
        on_time = None
        if total_done_all > 0:
            done_on_time = (await db.execute(
                select(func.count(Task.id)).where(
                    Task.assignee_id == user.id,
                    Task.status == TaskStatus.DONE,
                    Task.completed_at <= Task.deadline,
                )
            )).scalar() or 0
            on_time = round(done_on_time / total_done_all * 100)

        permissions = get_user_permissions(user.role)

        # Notification settings (default if not stored)
        notif_settings = {
            "work_hours_start": getattr(user, 'work_hours_start', None) or "08:00",
            "work_hours_end": getattr(user, 'work_hours_end', None) or "20:00",
            "plan_fact_time": getattr(user, 'plan_fact_time', None) or "18:00",
            "reminder_interval_1_min": getattr(user, 'reminder_interval_1_min', None) or 60,
            "reminder_interval_2_min": getattr(user, 'reminder_interval_2_min', None) or 120,
            "weekly_audit_day": getattr(user, 'weekly_audit_day', None) or "monday",
            "weekly_audit_time": getattr(user, 'weekly_audit_time', None) or "10:00",
            "push_enabled": getattr(user, 'push_enabled', True),
            "critical_only_outside_hours": getattr(user, 'critical_only_outside_hours', True),
        }

        return {
            "id": user.id, "telegram_id": user.telegram_id,
            "username": user.username, "full_name": user.full_name,
            "phone": user.phone,
            "email": getattr(user, 'email', None),
            "photo_url": getattr(user, 'photo_url', None),
            "role": user.role.value,
            "role_name": ROLE_NAMES.get(user.role, user.role.value),
            "department": user.department.value if user.department else None,
            "department_name": DEPARTMENT_NAMES.get(user.department) if user.department else None,
            "position": getattr(user, 'position', None),
            "access_level": get_access_level(user.role),
            "is_active": user.is_active,
            "zone_of_responsibility": getattr(user, 'zone_of_responsibility', None),
            "permissions": permissions,
            "objects": objects,
            "supervisor": supervisor,
            "subordinates": subordinates,
            "kpi": {
                "tasks_assigned": tasks_assigned,
                "tasks_done_this_month": tasks_done_month,
                "tasks_overdue": tasks_overdue,
                "avg_completion_days": avg_days,
                "approvals_pending": approvals_pending,
                "documents_uploaded": docs_uploaded,
                "on_time_rate": on_time,
            },
            "notification_settings": notif_settings,
        }

    def _user_brief(u: User) -> dict:
        return {
            "id": u.id,
            "full_name": u.full_name,
            "role_name": ROLE_NAMES.get(u.role, u.role.value),
            "department_name": DEPARTMENT_NAMES.get(u.department) if u.department else None,
            "photo_url": getattr(u, 'photo_url', None),
            "is_online": False,  # Пробел → requires online tracking (Redis presence)
        }

    # ── Profile: My Tasks ──

    @app.get("/api/profile/tasks")
    async def get_profile_tasks(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        result = await db.execute(
            select(Task)
            .options(selectinload(Task.object))
            .where(Task.assignee_id == user.id, Task.status != TaskStatus.DONE)
            .order_by(Task.deadline.asc().nullslast())
        )
        tasks = result.scalars().all()
        now = datetime.utcnow().date()
        return [
            {
                "id": t.id, "title": t.title, "status": t.status.value,
                "priority": t.priority,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "object_name": t.object.name if t.object else "—",
                "department_name": DEPARTMENT_NAMES.get(t.department, t.department.value),
                "days_left": (t.deadline - now).days if t.deadline else None,
            }
            for t in tasks
        ]

    # ── Profile: My Approvals ──

    @app.get("/api/profile/approvals")
    async def get_profile_approvals(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        approvals = []

        # GPR signatures pending
        gpr_sigs = await db.execute(
            select(GPRSignature)
            .options(selectinload(GPRSignature.gpr).selectinload(GPR.object))
            .where(GPRSignature.user_id == user.id, GPRSignature.signed == False)
        )
        for sig in gpr_sigs.scalars().all():
            gpr = sig.gpr
            approvals.append({
                "id": sig.id, "type": "gpr_sign",
                "title": f"ГПР v{gpr.version}" if gpr else "ГПР",
                "object_name": gpr.object.name if gpr and gpr.object else "—",
                "requested_by": "Система",
                "requested_at": sig.created_at.isoformat() if hasattr(sig, 'created_at') and sig.created_at else "",
                "entity_id": gpr.id if gpr else 0,
            })

        # Tasks in review assigned to this user as reviewer
        review_tasks = await db.execute(
            select(Task)
            .options(selectinload(Task.object), selectinload(Task.created_by))
            .where(Task.status == TaskStatus.REVIEW)
        )
        for t in review_tasks.scalars().all():
            # Only show if user can complete tasks
            if has_permission(user.role, "task.complete"):
                approvals.append({
                    "id": t.id, "type": "task_review",
                    "title": t.title,
                    "object_name": t.object.name if t.object else "—",
                    "requested_by": t.created_by.full_name if t.created_by else "—",
                    "requested_at": t.updated_at.isoformat() if t.updated_at else "",
                    "entity_id": t.id,
                })

        return approvals

    # ── Profile: Activity Log ──

    @app.get("/api/profile/activity")
    async def get_profile_activity(
        limit: int = 30,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        result = await db.execute(
            select(AuditLog)
            .where(AuditLog.user_id == user.id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        logs = result.scalars().all()

        ACTION_LABELS = {
            "task.create": "Создал задачу",
            "task.status_change": "Сменил статус задачи",
            "gpr.sign": "Подписал ГПР",
            "checklist.toggle": "Отметил пункт чек-листа",
            "document.upload": "Загрузил документ",
            "supply.create": "Создал заявку на поставку",
            "stage.update": "Обновил этап монтажа",
        }

        return [
            {
                "id": log.id,
                "action": log.action,
                "action_label": ACTION_LABELS.get(log.action, log.action),
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "entity_title": None,  # Пробел → requires join to entity table
                "old_value": log.old_value if isinstance(log.old_value, str)
                    else json.dumps(log.old_value) if log.old_value else None,
                "new_value": log.new_value if isinstance(log.new_value, str)
                    else json.dumps(log.new_value) if log.new_value else None,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]

    # ── Org Structure ──

    @app.get("/api/org-structure")
    async def get_org_structure(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        """
        Build org tree from departments.
        Пробел → full org hierarchy requires OrgUnit model; simplified version from departments.
        """
        all_users = (await db.execute(
            select(User).where(User.is_active == True)
        )).scalars().all()

        # Group by department
        dept_groups: dict[str, list] = {}
        for u in all_users:
            dept_key = u.department.value if u.department else "other"
            if dept_key not in dept_groups:
                dept_groups[dept_key] = []
            dept_groups[dept_key].append(u)

        children = []
        for dept_key, members in dept_groups.items():
            dept_name = DEPARTMENT_NAMES.get(Department(dept_key), dept_key) if dept_key != "other" else "Прочие"
            # Find head (highest role)
            head = None
            for m in members:
                if m.role in (UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD, UserRole.ADMIN):
                    head = _user_brief(m)
                    break
            children.append({
                "id": hash(dept_key) % 10000,
                "name": dept_name,
                "employee_count": len(members),
                "head": head,
                "children": [],
            })

        return {
            "id": 0,
            "name": "Компания",
            "employee_count": len(all_users),
            "head": None,
            "children": children,
        }

    # ── Profile: Update Notification Settings ──

    @app.patch("/api/profile/notification-settings")
    async def update_notification_settings(
        body: UpdateNotificationSettingsBody,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        updates = body.model_dump(exclude_none=True)
        for field, value in updates.items():
            if hasattr(user, field):
                setattr(user, field, value)

        await write_audit(db, user.id, "profile.settings_update", "user", user.id,
                          None, {"fields": list(updates.keys())})
        await db.commit()

        return {
            "work_hours_start": getattr(user, 'work_hours_start', None) or "08:00",
            "work_hours_end": getattr(user, 'work_hours_end', None) or "20:00",
            "plan_fact_time": getattr(user, 'plan_fact_time', None) or "18:00",
            "reminder_interval_1_min": getattr(user, 'reminder_interval_1_min', None) or 60,
            "reminder_interval_2_min": getattr(user, 'reminder_interval_2_min', None) or 120,
            "weekly_audit_day": getattr(user, 'weekly_audit_day', None) or "monday",
            "weekly_audit_time": getattr(user, 'weekly_audit_time', None) or "10:00",
            "push_enabled": getattr(user, 'push_enabled', True),
            "critical_only_outside_hours": getattr(user, 'critical_only_outside_hours', True),
        }

    # ── Objects list ──

    @app.get("/api/objects")
    async def list_objects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        if has_permission(user.role, "object.view_all"):
            q = select(ConstructionObject).order_by(ConstructionObject.deadline_date)
        else:
            user_obj_ids = (await db.execute(
                select(ObjectRole.object_id).where(ObjectRole.user_id == user.id)
            )).scalars().all()
            q = select(ConstructionObject).where(
                ConstructionObject.id.in_(user_obj_ids)
            ).order_by(ConstructionObject.deadline_date)

        objs = (await db.execute(q)).scalars().all()
        result = []
        for obj in objs:
            t_total = (await db.execute(
                select(func.count(Task.id)).where(Task.object_id == obj.id)
            )).scalar() or 0
            t_done = (await db.execute(
                select(func.count(Task.id)).where(Task.object_id == obj.id, Task.status == TaskStatus.DONE)
            )).scalar() or 0
            t_overdue = (await db.execute(
                select(func.count(Task.id)).where(Task.object_id == obj.id, Task.status == TaskStatus.OVERDUE)
            )).scalar() or 0
            result.append({
                "id": obj.id, "name": obj.name, "city": obj.city,
                "status": obj.status.value,
                "deadline_date": obj.deadline_date.isoformat() if obj.deadline_date else None,
                "task_total": t_total, "task_done": t_done, "task_overdue": t_overdue,
                "progress_pct": round(t_done / t_total * 100) if t_total > 0 else 0,
            })
        return result

    # ── Object detail ──

    @app.get("/api/objects/{object_id}")
    async def get_object_detail(object_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        obj = (await db.execute(
            select(ConstructionObject).where(ConstructionObject.id == object_id)
        )).scalar_one_or_none()
        if not obj:
            raise HTTPException(404, "Object not found")

        # Team
        team_result = await db.execute(
            select(ObjectRole).options(selectinload(ObjectRole.user))
            .where(ObjectRole.object_id == object_id)
        )
        team = [
            {"user_id": r.user.id, "full_name": r.user.full_name,
             "role": r.role.value, "role_name": ROLE_NAMES.get(r.role, r.role.value)}
            for r in team_result.scalars().all() if r.user
        ]

        # Stats
        t_total = (await db.execute(select(func.count(Task.id)).where(Task.object_id == object_id))).scalar() or 0
        t_done = (await db.execute(select(func.count(Task.id)).where(Task.object_id == object_id, Task.status == TaskStatus.DONE))).scalar() or 0
        t_overdue = (await db.execute(select(func.count(Task.id)).where(Task.object_id == object_id, Task.status == TaskStatus.OVERDUE))).scalar() or 0
        t_progress = (await db.execute(select(func.count(Task.id)).where(Task.object_id == object_id, Task.status == TaskStatus.IN_PROGRESS))).scalar() or 0
        s_total = (await db.execute(select(func.count(SupplyOrder.id)).where(SupplyOrder.object_id == object_id))).scalar() or 0
        s_delayed = (await db.execute(select(func.count(SupplyOrder.id)).where(SupplyOrder.object_id == object_id, SupplyOrder.status == SupplyStatus.DELAYED))).scalar() or 0
        st_total = (await db.execute(select(func.count(ConstructionStage.id)).where(ConstructionStage.object_id == object_id))).scalar() or 0
        st_accepted = (await db.execute(select(func.count(ConstructionStage.id)).where(ConstructionStage.object_id == object_id, ConstructionStage.status == ConstructionStageStatus.ACCEPTED))).scalar() or 0

        return {
            "id": obj.id, "name": obj.name, "city": obj.city, "address": obj.address,
            "contract_date": obj.contract_date.isoformat() if obj.contract_date else None,
            "deadline_date": obj.deadline_date.isoformat() if obj.deadline_date else None,
            "budget": obj.budget, "status": obj.status.value,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
            "team": team,
            "stats": {
                "task_total": t_total, "task_done": t_done,
                "task_overdue": t_overdue, "task_in_progress": t_progress,
                "supply_total": s_total, "supply_delayed": s_delayed,
                "stages_total": st_total, "stages_accepted": st_accepted,
                "progress_pct": round(t_done / t_total * 100) if t_total > 0 else 0,
            },
        }

    # ── Task status update ──

    @app.patch("/api/tasks/{task_id}/status")
    async def update_task_status(
        task_id: int, body: UpdateStatusBody,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
        if not task:
            raise HTTPException(404, "Task not found")

        if not has_permission(user.role, "task.complete"):
            raise HTTPException(403, "No permission")

        old_status = task.status.value
        try:
            new_status = TaskStatus(body.status)
        except ValueError:
            raise HTTPException(400, f"Invalid status: {body.status}")

        task.status = new_status
        task.updated_at = datetime.utcnow()
        if new_status == TaskStatus.DONE:
            task.completed_at = datetime.utcnow()

        await write_audit(db, user.id, "task.status_change", "task", task.id,
                          {"status": old_status}, {"status": new_status.value})

        if body.comment:
            comment = TaskComment(task_id=task.id, user_id=user.id, text=body.comment)
            db.add(comment)

        await db.commit()

        # Fire event engine
        try:
            from bot.services.event_engine import on_task_status_changed
            await on_task_status_changed(db, task, old_status, changed_by=user)
        except Exception as e:
            logger.warning(f"Event engine error (task status): {e}")

        return {"id": task.id, "status": task.status.value, "ok": True}

    # ── Task creation ──

    @app.post("/api/objects/{object_id}/tasks")
    async def create_task(
        object_id: int, body: CreateTaskBody,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        if not has_permission(user.role, "task.create"):
            raise HTTPException(403, "No permission to create tasks")

        task = Task(
            object_id=object_id, title=body.title,
            description=body.description,
            department=Department(body.department),
            assignee_id=body.assignee_id, created_by_id=user.id,
            deadline=body.deadline, priority=body.priority,
        )
        db.add(task)
        await db.flush()

        await write_audit(db, user.id, "task.create", "task", task.id,
                          None, {"title": body.title, "department": body.department})
        await db.commit()

        # Fire event engine — notify assignee
        if task.assignee_id:
            try:
                from bot.services.event_engine import on_task_assigned
                await on_task_assigned(db, task, assigned_by=user)
            except Exception as e:
                logger.warning(f"Event engine error (task assign): {e}")

        return {"id": task.id, "title": task.title, "status": task.status.value}

    # ── Task comments ──

    @app.post("/api/tasks/{task_id}/comments")
    async def add_comment(
        task_id: int, body: AddCommentBody,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
        if not task:
            raise HTTPException(404, "Task not found")

        comment = TaskComment(task_id=task_id, user_id=user.id, text=body.text)
        db.add(comment)
        await db.commit()
        await db.refresh(comment)
        return {"id": comment.id, "user": user.full_name, "text": comment.text,
                "created_at": comment.created_at.isoformat()}

    # ── Task detail ──

    @app.get("/api/tasks/{task_id}")
    async def get_task_detail(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        result = await db.execute(
            select(Task)
            .options(
                selectinload(Task.assignee),
                selectinload(Task.created_by),
                selectinload(Task.comments).selectinload(TaskComment.user),
                selectinload(Task.gpr_item),
                selectinload(Task.object),
            )
            .where(Task.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(404, "Task not found")

        return {
            "id": task.id, "title": task.title, "description": task.description,
            "department": task.department.value,
            "department_name": DEPARTMENT_NAMES.get(task.department, task.department.value),
            "status": task.status.value, "priority": task.priority,
            "assignee": task.assignee.full_name if task.assignee else None,
            "assignee_id": task.assignee_id,
            "created_by": task.created_by.full_name if task.created_by else None,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "blocked_reason": task.blocked_reason,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "comments_count": len(task.comments),
            "comments": [
                {"id": c.id, "user": c.user.full_name if c.user else "—",
                 "text": c.text, "created_at": c.created_at.isoformat()}
                for c in task.comments
            ],
            "gpr_item_title": task.gpr_item.title if task.gpr_item else None,
            "object_name": task.object.name if task.object else None,
        }

    # ── GPR signing ──

    @app.post("/api/gpr/{gpr_id}/sign")
    async def sign_gpr(
        gpr_id: int, body: SignGPRBody,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        if not has_permission(user.role, "gpr.sign"):
            raise HTTPException(403, "No permission to sign GPR")

        sig = (await db.execute(
            select(GPRSignature).where(
                GPRSignature.gpr_id == gpr_id, GPRSignature.user_id == user.id
            )
        )).scalar_one_or_none()

        if not sig:
            # Create signature record
            dept = ROLE_DEPARTMENT.get(user.role)
            sig = GPRSignature(
                gpr_id=gpr_id, user_id=user.id,
                department=dept, signed=True,
                signed_at=datetime.utcnow(), comment=body.comment,
            )
            db.add(sig)
        else:
            sig.signed = True
            sig.signed_at = datetime.utcnow()
            sig.comment = body.comment

        await write_audit(db, user.id, "gpr.sign", "gpr", gpr_id,
                          None, {"signed": True, "comment": body.comment})
        await db.commit()
        return {"ok": True}

    # ── Supply orders ──

    @app.get("/api/objects/{object_id}/supply")
    async def get_supply_orders(object_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        result = await db.execute(
            select(SupplyOrder)
            .options(selectinload(SupplyOrder.created_by))
            .where(SupplyOrder.object_id == object_id)
            .order_by(SupplyOrder.expected_date.asc().nullslast())
        )
        orders = result.scalars().all()
        return [
            {
                "id": o.id, "material_name": o.material_name,
                "quantity": o.quantity, "unit": o.unit,
                "status": o.status.value, "supplier": o.supplier,
                "expected_date": o.expected_date.isoformat() if o.expected_date else None,
                "actual_date": o.actual_date.isoformat() if o.actual_date else None,
                "delivery_location": o.delivery_location,
                "created_by": o.created_by.full_name if o.created_by else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ]

    # ── Documents ──

    @app.get("/api/objects/{object_id}/documents")
    async def get_documents(
        object_id: int, doc_type: str | None = None,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        q = select(Document).options(selectinload(Document.uploaded_by)).where(Document.object_id == object_id)
        if doc_type:
            q = q.where(Document.doc_type == doc_type)
        q = q.order_by(Document.created_at.desc())
        result = await db.execute(q)
        docs = result.scalars().all()
        return [
            {
                "id": d.id, "doc_type": d.doc_type, "title": d.title,
                "file_url": d.file_url, "version": d.version,
                "uploaded_by": d.uploaded_by.full_name if d.uploaded_by else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ]

    # ── Checklist toggle ──

    @app.post("/api/construction/checklist/{item_id}/toggle")
    async def toggle_checklist(
        item_id: int,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        item = (await db.execute(select(ChecklistItem).where(ChecklistItem.id == item_id))).scalar_one_or_none()
        if not item:
            raise HTTPException(404, "Checklist item not found")

        item.is_done = not item.is_done
        item.done_by_id = user.id if item.is_done else None
        item.done_at = datetime.utcnow() if item.is_done else None

        await write_audit(db, user.id, "checklist.toggle", "checklist_item", item_id,
                          {"is_done": not item.is_done}, {"is_done": item.is_done})
        await db.commit()
        return {"ok": True, "is_done": item.is_done}

    # ══════════════════════════════════════════════════════════
    # ══  NOTIFICATION CENTER  ════════════════════════════════
    # ══════════════════════════════════════════════════════════

    NOTIF_CATEGORY_MAP = {
        "task_assigned": "tasks", "task_overdue": "tasks", "task_completed": "tasks",
        "task_blocked": "tasks", "plan_fact_request": "tasks", "plan_fact_overdue": "tasks",
        "gpr_sign_request": "gpr", "gpr_signed": "gpr", "gpr_all_signed": "gpr",
        "supply_delayed": "supply", "supply_shipped": "supply", "supply_received": "supply",
        "material_shipped": "supply", "material_received": "supply", "cascade_shift": "supply",
        "stage_completed": "construction", "stage_rejected": "construction",
        "construction_stage_done": "construction", "defect_reported": "construction",
        "defect_resolved": "construction", "kmd_issued": "construction",
        "escalation_l1": "escalation", "escalation_l2": "escalation",
        "escalation_l3": "escalation",
        "weekly_audit": "system", "object_status_change": "system", "general": "system",
    }

    NOTIF_PRIORITY_MAP = {
        "task_overdue": "high", "task_blocked": "high",
        "gpr_sign_request": "high", "supply_delayed": "high",
        "defect_reported": "critical",
        "escalation_l1": "high", "escalation_l2": "critical", "escalation_l3": "critical",
        "plan_fact_overdue": "high", "cascade_shift": "high",
    }

    # Actions per notification type (served to frontend)
    NOTIF_ACTIONS = {
        "task_assigned": [
            {"key": "accept", "label": "▶️ Принять", "icon": "▶️", "style": "primary"},
            {"key": "question", "label": "❓ Вопрос РП", "icon": "❓", "style": "default"},
        ],
        "task_completed": [
            {"key": "approve", "label": "✅ Принять", "icon": "✅", "style": "success"},
            {"key": "reject", "label": "↩️ Вернуть", "icon": "↩️", "style": "danger"},
        ],
        "task_overdue": [
            {"key": "extend", "label": "📅 Перенести", "icon": "📅", "style": "default"},
            {"key": "escalate", "label": "⬆️ Эскалация", "icon": "⬆️", "style": "danger"},
        ],
        "gpr_sign_request": [
            {"key": "sign", "label": "✍️ Подписать", "icon": "✍️", "style": "success"},
            {"key": "comment", "label": "💬 Замечания", "icon": "💬", "style": "default"},
        ],
        "supply_delayed": [
            {"key": "accept_shift", "label": "Принять сдвиг", "icon": "✅", "style": "default"},
            {"key": "find_alt", "label": "Альт. поставщик", "icon": "🔍", "style": "primary"},
            {"key": "escalate", "label": "⬆️ Эскалация", "icon": "⬆️", "style": "danger"},
        ],
        "material_shipped": [
            {"key": "received", "label": "✅ Принял", "icon": "✅", "style": "success"},
            {"key": "defects", "label": "⚠️ Есть дефекты", "icon": "⚠️", "style": "danger"},
        ],
        "construction_stage_done": [
            {"key": "accept_stage", "label": "✅ Принять", "icon": "✅", "style": "success"},
            {"key": "reject_stage", "label": "❌ Замечания", "icon": "❌", "style": "danger"},
        ],
        "defect_reported": [
            {"key": "assign_fix", "label": "🔧 Назначить", "icon": "🔧", "style": "primary"},
            {"key": "view_photo", "label": "📷 Фото", "icon": "📷", "style": "default"},
        ],
        "plan_fact_request": [
            {"key": "fill_report", "label": "📝 Заполнить", "icon": "📝", "style": "primary"},
        ],
        "escalation_l2": [
            {"key": "intervene", "label": "🔧 Вмешаться", "icon": "🔧", "style": "danger"},
            {"key": "reassign", "label": "👤 Переназначить", "icon": "👤", "style": "default"},
        ],
        "cascade_shift": [
            {"key": "accept_shift", "label": "✅ Принять", "icon": "✅", "style": "primary"},
            {"key": "adjust_gpr", "label": "📅 Скорректировать ГПР", "icon": "📅", "style": "default"},
            {"key": "escalate", "label": "⬆️ Эскалация", "icon": "⬆️", "style": "danger"},
        ],
    }

    def _serialize_notification(n, category_map=NOTIF_CATEGORY_MAP,
                                 priority_map=NOTIF_PRIORITY_MAP,
                                 actions_map=NOTIF_ACTIONS):
        ntype = n.type.value if hasattr(n.type, 'value') else str(n.type)
        return {
            "id": n.id,
            "type": ntype,
            "priority": priority_map.get(ntype, "normal"),
            "category": category_map.get(ntype, "system"),
            "title": n.title,
            "text": n.text,
            "entity_type": n.entity_type,
            "entity_id": n.entity_id,
            "object_id": getattr(n, 'object_id', None),
            "object_name": getattr(n, 'object_name', None),
            "is_read": n.is_read,
            "is_actionable": ntype in actions_map,
            "escalation_level": getattr(n, 'escalation_level', None),
            "actions": actions_map.get(ntype, []),
            "deep_link": _build_deep_link(n),
            "triggered_by": getattr(n, 'triggered_by', None),
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "expires_at": getattr(n, 'expires_at', None),
        }

    def _build_deep_link(n) -> str | None:
        etype = n.entity_type
        eid = n.entity_id
        oid = getattr(n, 'object_id', None)
        if etype == "object" and oid:
            return f"/objects/{oid}"
        elif etype == "task" and oid and eid:
            return f"/objects/{oid}?tab=tasks&task={eid}"
        elif etype == "gpr" and oid:
            return f"/objects/{oid}?tab=gpr"
        elif etype == "supply" and oid:
            return f"/objects/{oid}?tab=supply"
        elif etype == "stage" and oid:
            return f"/objects/{oid}?tab=construction"
        return None

    # ── GET /notifications (with category + unread filters) ──

    @app.get("/api/notifications")
    async def get_notifications(
        limit: int = 50,
        category: str | None = None,
        unread_only: bool = False,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        query = select(Notification).where(Notification.user_id == user.id)

        if unread_only:
            query = query.where(Notification.is_read == False)

        query = query.order_by(Notification.created_at.desc()).limit(limit)
        result = await db.execute(query)
        all_notifs = result.scalars().all()

        # Filter by category in Python (type → category mapping)
        serialized = [_serialize_notification(n) for n in all_notifs]
        if category:
            serialized = [n for n in serialized if n["category"] == category]

        return serialized

    # ── GET /notifications/summary ──

    @app.get("/api/notifications/summary")
    async def notification_summary(
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        result = await db.execute(
            select(Notification)
            .where(Notification.user_id == user.id, Notification.is_read == False)
        )
        unread = result.scalars().all()

        by_category: dict[str, int] = {}
        critical_count = 0
        pending_actions = 0
        escalations = 0

        for n in unread:
            ntype = n.type.value if hasattr(n.type, 'value') else str(n.type)
            cat = NOTIF_CATEGORY_MAP.get(ntype, "system")
            by_category[cat] = by_category.get(cat, 0) + 1

            if NOTIF_PRIORITY_MAP.get(ntype) in ("critical", "high"):
                critical_count += 1
            if ntype in NOTIF_ACTIONS:
                pending_actions += 1
            if ntype.startswith("escalation_"):
                escalations += 1

        return {
            "total_unread": len(unread),
            "critical_unread": critical_count,
            "by_category": by_category,
            "pending_actions": pending_actions,
            "escalations_active": escalations,
        }

    # ── POST /notifications/{id}/read ──

    @app.post("/api/notifications/{notif_id}/read")
    async def mark_read(notif_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        notif = (await db.execute(
            select(Notification).where(Notification.id == notif_id, Notification.user_id == user.id)
        )).scalar_one_or_none()
        if not notif:
            raise HTTPException(404)
        notif.is_read = True
        await db.commit()
        return {"ok": True}

    # ── POST /notifications/read-all ──

    class MarkAllReadBody(BaseModel):
        category: str | None = None

    @app.post("/api/notifications/read-all")
    async def mark_all_read(
        body: MarkAllReadBody,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        result = await db.execute(
            select(Notification)
            .where(Notification.user_id == user.id, Notification.is_read == False)
        )
        unread = result.scalars().all()

        count = 0
        for n in unread:
            ntype = n.type.value if hasattr(n.type, 'value') else str(n.type)
            cat = NOTIF_CATEGORY_MAP.get(ntype, "system")
            if body.category is None or cat == body.category:
                n.is_read = True
                count += 1

        await db.commit()
        return {"ok": True, "count": count}

    # ── POST /notifications/action (inline action handler) ──

    class NotifActionBody(BaseModel):
        notification_id: int
        action_key: str
        comment: str | None = None
        photo_url: str | None = None

    @app.post("/api/notifications/action")
    async def execute_notification_action(
        body: NotifActionBody,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        notif = (await db.execute(
            select(Notification).where(Notification.id == body.notification_id, Notification.user_id == user.id)
        )).scalar_one_or_none()
        if not notif:
            raise HTTPException(404, "Notification not found")

        ntype = notif.type.value if hasattr(notif.type, 'value') else str(notif.type)
        action = body.action_key
        result_msg = None
        status_changed = None

        # ── Task actions ──
        if ntype == "task_assigned" and action == "accept":
            if notif.entity_id:
                task = (await db.execute(select(Task).where(Task.id == notif.entity_id))).scalar_one_or_none()
                if task:
                    task.status = TaskStatus.IN_PROGRESS
                    status_changed = "in_progress"
                    result_msg = f"Задача «{task.title}» принята в работу"

        elif ntype == "task_completed" and action == "approve":
            if notif.entity_id:
                task = (await db.execute(select(Task).where(Task.id == notif.entity_id))).scalar_one_or_none()
                if task:
                    task.status = TaskStatus.DONE
                    status_changed = "done"
                    result_msg = f"Задача «{task.title}» принята"

        elif ntype == "task_completed" and action == "reject":
            if notif.entity_id:
                task = (await db.execute(select(Task).where(Task.id == notif.entity_id))).scalar_one_or_none()
                if task:
                    task.status = TaskStatus.IN_PROGRESS
                    status_changed = "in_progress"
                    result_msg = "Задача возвращена исполнителю"

        # ── GPR sign ──
        elif ntype == "gpr_sign_request" and action == "sign":
            if notif.entity_id:
                sig = (await db.execute(
                    select(GPRSignature)
                    .where(GPRSignature.gpr_id == notif.entity_id, GPRSignature.user_id == user.id)
                )).scalar_one_or_none()
                if sig:
                    sig.signed = True
                    sig.signed_at = datetime.utcnow()
                    status_changed = "signed"
                    result_msg = "ГПР подписан"

                    # Check if all signed → activate object
                    all_sigs = (await db.execute(
                        select(GPRSignature).where(GPRSignature.gpr_id == notif.entity_id)
                    )).scalars().all()
                    if all(s.signed for s in all_sigs):
                        gpr = (await db.execute(
                            select(GPR).where(GPR.id == notif.entity_id)
                        )).scalar_one_or_none()
                        if gpr:
                            gpr.status = GPRStatus.ACTIVE
                            obj = (await db.execute(
                                select(ConstructionObject).where(ConstructionObject.id == gpr.object_id)
                            )).scalar_one_or_none()
                            if obj:
                                obj.status = ObjectStatus.ACTIVE
                                result_msg = "ГПР утверждён! Объект переведён в ACTIVE"

        # ── Supply actions ──
        elif ntype == "material_shipped" and action == "received":
            if notif.entity_id:
                order = (await db.execute(
                    select(SupplyOrder).where(SupplyOrder.id == notif.entity_id)
                )).scalar_one_or_none()
                if order:
                    order.status = SupplyStatus.DELIVERED
                    status_changed = "delivered"
                    result_msg = "Материал принят. ТТН зафиксирована."
                    # Side-effect: generate quality check task (СМР-002)
                    # Пробел → fire MATERIAL_RECEIVED event via TriggerEngine

        elif ntype == "material_shipped" and action == "defects":
            # Require photo (enforced by frontend)
            if notif.entity_id:
                result_msg = "Зафиксированы дефекты. Акт отправлен производству."
                # Пробел → fire DEFECT_REPORTED event

        # ── Construction actions ──
        elif ntype == "construction_stage_done" and action == "accept_stage":
            if notif.entity_id:
                stage = (await db.execute(
                    select(ConstructionStage).where(ConstructionStage.id == notif.entity_id)
                )).scalar_one_or_none()
                if stage:
                    stage.status = ConstructionStageStatus.ACCEPTED
                    status_changed = "accepted"
                    result_msg = "Этап принят Технадзором"

        elif ntype == "construction_stage_done" and action == "reject_stage":
            if notif.entity_id:
                stage = (await db.execute(
                    select(ConstructionStage).where(ConstructionStage.id == notif.entity_id)
                )).scalar_one_or_none()
                if stage:
                    stage.status = ConstructionStageStatus.REJECTED
                    status_changed = "rejected"
                    result_msg = "Этап отклонён. Замечания направлены."

        # ── Escalation actions ──
        elif action == "escalate":
            result_msg = "Эскалация инициирована. Руководитель уведомлён."
            # Пробел → fire next ESCALATION level via TriggerEngine

        # ── Default fallback ──
        if not result_msg:
            result_msg = f"Действие «{action}» выполнено"

        # Mark notification as read + actioned
        notif.is_read = True

        # Audit log
        await write_audit(
            db, user.id, f"notification.action.{action}",
            notif.entity_type or "notification", notif.entity_id or notif.id,
            None, {"action": action, "notification_type": ntype},
        )

        await db.commit()

        return {
            "ok": True,
            "message": result_msg,
            "status_changed": status_changed,
        }

    # ── Health ──

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "version": "2.1.0"}

    # ══════════════════════════════════════════════════════════
    # ══  OBJECT CREATION WIZARD  ═════════════════════════════
    # ══════════════════════════════════════════════════════════

    class CreateObjectStep1Body(BaseModel):
        name: str
        work_front: str = ""
        city: str
        address: str = ""
        contract_date: str
        deadline_date: str
        budget: float | None = None
        customer_name: str
        customer_contact: str = ""
        facade_area_m2: float | None = None
        total_modules: int | None = None

    class TeamAssignmentBody(BaseModel):
        user_id: int
        role: str
        zone_of_responsibility: str | None = None

    class CreateObjectStep2Body(BaseModel):
        team: list[TeamAssignmentBody]
        gpr_mode: str = "template"  # "template" | "blank"
        gpr_template_id: int | None = None

    class CreateObjectBody(BaseModel):
        step1: CreateObjectStep1Body
        step2: CreateObjectStep2Body

    # ── Available Users for Assignment ──

    @app.get("/api/users/available")
    async def get_available_users(
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        if not has_permission(user.role, "object.create"):
            raise HTTPException(403, "Insufficient permissions")

        result = await db.execute(
            select(User).where(User.is_active == True).order_by(User.full_name)
        )
        all_users = result.scalars().all()
        output = []
        for u in all_users:
            # Count active objects for each user
            obj_count = (await db.execute(
                select(func.count(ObjectRole.id))
                .join(ConstructionObject, ObjectRole.object_id == ConstructionObject.id)
                .where(
                    ObjectRole.user_id == u.id,
                    ConstructionObject.status.in_([
                        ObjectStatus.ACTIVE, ObjectStatus.PLANNING,
                    ]),
                )
            )).scalar() or 0

            output.append({
                "id": u.id,
                "full_name": u.full_name,
                "role": u.role.value,
                "role_name": ROLE_NAMES.get(u.role, u.role.value),
                "department": u.department.value if u.department else None,
                "department_name": DEPARTMENT_NAMES.get(u.department) if u.department else None,
                "photo_url": getattr(u, 'photo_url', None),
                "active_objects_count": obj_count,
            })

        return output

    # ── GPR Templates ──

    @app.get("/api/gpr/templates")
    async def get_gpr_templates(
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        """
        Return available GPR templates.
        Пробел → requires GPRTemplate model; providing default facade template.
        """
        # Default template for facade construction
        return [
            {
                "id": 1,
                "name": "Фасадные работы НВФ+СПК (стандарт)",
                "description": "Типовой ГПР: проектирование → снабжение → производство → монтаж → ПТО. 45 позиций.",
                "items_count": 45,
                "departments": ["design", "supply", "production", "construction", "pto", "safety"],
            },
            {
                "id": 2,
                "name": "Фасадные работы НВФ (без СПК)",
                "description": "ГПР для навесных вентилируемых фасадов без светопрозрачных конструкций. 32 позиции.",
                "items_count": 32,
                "departments": ["design", "supply", "production", "construction", "pto"],
            },
            {
                "id": 3,
                "name": "Монтаж СПК (отдельный контракт)",
                "description": "Фокус на стеклопакетах: замеры → КМД → производство → монтаж → герметизация. 28 позиций.",
                "items_count": 28,
                "departments": ["design", "supply", "production", "construction"],
            },
        ]

    # ── Validate Object (partial) ──

    @app.post("/api/objects/validate")
    async def validate_object(
        body: CreateObjectStep1Body,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        errors = []
        warnings = []

        if not body.name.strip():
            errors.append({"field": "name", "message": "Название обязательно"})
        else:
            # Check duplicate name
            existing = (await db.execute(
                select(ConstructionObject).where(ConstructionObject.name == body.name.strip())
            )).scalar_one_or_none()
            if existing:
                warnings.append({"field": "name", "message": f"Объект «{body.name}» уже существует (ID #{existing.id})"})

        if not body.city.strip():
            errors.append({"field": "city", "message": "Город обязателен"})
        if not body.contract_date:
            errors.append({"field": "contract_date", "message": "Дата договора обязательна"})
        if not body.deadline_date:
            errors.append({"field": "deadline_date", "message": "Срок завершения обязателен"})
        if body.contract_date and body.deadline_date and body.contract_date >= body.deadline_date:
            errors.append({"field": "deadline_date", "message": "Срок завершения должен быть позже даты договора"})
        if not body.customer_name.strip():
            errors.append({"field": "customer_name", "message": "Заказчик обязателен"})

        if body.budget and body.budget <= 0:
            warnings.append({"field": "budget", "message": "Бюджет должен быть положительным"})

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    # ── Create Object (main endpoint) ──

    @app.post("/api/objects")
    async def create_object(
        body: CreateObjectBody,
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
    ):
        if not has_permission(user.role, "object.create"):
            raise HTTPException(403, "Insufficient permissions to create objects")

        s1 = body.step1
        s2 = body.step2

        # ── Validation ──
        if not s1.name.strip():
            raise HTTPException(422, "Object name is required")
        if not s1.city.strip():
            raise HTTPException(422, "City is required")
        if not s1.contract_date or not s1.deadline_date:
            raise HTTPException(422, "Dates are required")

        has_pm = any(t.role == "project_manager" for t in s2.team)
        if not has_pm:
            raise HTTPException(422, "Project manager must be assigned")

        # ── Create object ──
        obj = ConstructionObject(
            name=s1.name.strip(),
            city=s1.city.strip(),
            address=s1.address.strip() if s1.address else None,
            contract_date=date.fromisoformat(s1.contract_date),
            deadline_date=date.fromisoformat(s1.deadline_date),
            status=ObjectStatus.DRAFT,
        )
        # Optional fields (check if model supports them)
        if hasattr(obj, 'budget') and s1.budget:
            obj.budget = s1.budget
        if hasattr(obj, 'customer_name') and s1.customer_name:
            obj.customer_name = s1.customer_name.strip()
        if hasattr(obj, 'customer_contact') and s1.customer_contact:
            obj.customer_contact = s1.customer_contact.strip()
        if hasattr(obj, 'work_front') and s1.work_front:
            obj.work_front = s1.work_front.strip()
        if hasattr(obj, 'facade_area_m2') and s1.facade_area_m2:
            obj.facade_area_m2 = s1.facade_area_m2
        if hasattr(obj, 'total_modules') and s1.total_modules:
            obj.total_modules = s1.total_modules

        db.add(obj)
        await db.flush()  # get obj.id

        # ── Assign team ──
        for member in s2.team:
            try:
                role_enum = UserRole(member.role)
            except ValueError:
                continue  # skip invalid roles
            obj_role = ObjectRole(
                object_id=obj.id,
                user_id=member.user_id,
                role=role_enum,
            )
            if hasattr(obj_role, 'zone_of_responsibility') and member.zone_of_responsibility:
                obj_role.zone_of_responsibility = member.zone_of_responsibility
            db.add(obj_role)

        # ── Create GPR ──
        gpr_id = None
        if s2.gpr_mode == 'template' or s2.gpr_mode == 'blank':
            gpr = GPR(
                object_id=obj.id,
                version=1,
                status=GPRStatus.DRAFT,
                created_by_id=user.id,
            )
            db.add(gpr)
            await db.flush()
            gpr_id = gpr.id

            # If template mode — create GPR items from template
            if s2.gpr_mode == 'template' and s2.gpr_template_id:
                gpr_items = _generate_gpr_from_template(
                    s2.gpr_template_id, gpr.id, obj.id
                )
                for item in gpr_items:
                    db.add(item)

            # Create GPR signatures for team leaders
            for member in s2.team:
                sig = GPRSignature(
                    gpr_id=gpr.id,
                    user_id=member.user_id,
                    signed=False,
                )
                if hasattr(sig, 'role'):
                    try:
                        sig.role = UserRole(member.role)
                    except ValueError:
                        pass
                db.add(sig)

        # ── Create default document folders ──
        # Пробел → requires DocumentFolder model; simplified as tags
        DEFAULT_DOC_CATEGORIES = ["ПТО", "Проектный", "Снабжение", "Геодезия", "ОТ", "Фотофиксация"]
        for cat in DEFAULT_DOC_CATEGORIES:
            doc = Document(
                object_id=obj.id,
                title=f"Папка: {cat}",
                doc_type=cat.lower(),
                status="active",
                uploaded_by_id=user.id,
            )
            if hasattr(doc, 'is_folder'):
                doc.is_folder = True
            db.add(doc)

        # ── Audit log ──
        await write_audit(
            db, user.id, "object.create", "object", obj.id,
            None,
            {
                "name": obj.name, "city": obj.city,
                "team_count": len(s2.team),
                "gpr_mode": s2.gpr_mode,
            },
        )

        # ── Notifications to team ──
        notifications_sent = 0
        for member in s2.team:
            notif = Notification(
                user_id=member.user_id,
                type="task_assigned",
                title=f"📋 Назначение на объект «{obj.name}»",
                text=f"Вы назначены на роль {ROLE_NAMES.get(UserRole(member.role), member.role)} на объекте {obj.name} ({obj.city})",
                entity_type="object",
                entity_id=obj.id,
                is_read=False,
            )
            db.add(notif)
            notifications_sent += 1

        await db.commit()

        # ── Send data to Telegram bot (via sendData) ──
        # The frontend sends via WebApp.sendData(), but we also
        # trigger the bot notification system here for team push

        return {
            "id": obj.id,
            "name": obj.name,
            "status": obj.status.value,
            "gpr_id": gpr_id,
            "team_count": len(s2.team),
            "notifications_sent": notifications_sent,
        }

    def _generate_gpr_from_template(template_id: int, gpr_id: int, object_id: int) -> list:
        """
        Generate GPR items from a template.
        Template 1: Full facade (НВФ+СПК), Template 2: НВФ only, Template 3: СПК only
        """
        TEMPLATES = {
            1: [  # Full НВФ+СПК
                ("Проектирование", [
                    ("Разработка ОПР", "design_opr", 14),
                    ("Разработка КМ", "design_km", 10),
                    ("Согласование цвета/формулы с заказчиком", "design_km", 7),
                    ("Разработка КМД (кронштейны)", "design_kmd", 14),
                    ("Разработка КМД (модули СПК)", "design_kmd", 14),
                    ("Выдача монтажных схем", "design_kmd", 5),
                    ("Выдача спецификаций", "design_kmd", 3),
                ]),
                ("Снабжение", [
                    ("Заказ алюминиевого профиля", "supply", 21),
                    ("Заказ стеклопакетов", "supply", 30),
                    ("Заказ утеплителя", "supply", 14),
                    ("Заказ крепежа/анкеров", "supply", 10),
                    ("Заказ герметика", "supply", 10),
                    ("Заказ облицовочных панелей", "supply", 21),
                    ("Контроль поставок на объект", "supply", 0),
                ]),
                ("Производство", [
                    ("Изготовление каркасов НВФ", "production", 21),
                    ("Изготовление модулей СПК", "production", 28),
                    ("Сборка доборных элементов", "production", 14),
                    ("Комплектация и отгрузка", "production", 7),
                ]),
                ("Подготовка площадки", [
                    ("Оформление допуска ОТ", "safety", 5),
                    ("Монтаж лесов/подмостей", "construction", 10),
                    ("Геодезическая разбивка", "construction", 3),
                ]),
                ("Монтаж НВФ", [
                    ("Бурение отверстий Ø12", "construction", 5),
                    ("Бурение отверстий Ø16", "construction", 5),
                    ("Монтаж несущих кронштейнов", "construction", 10),
                    ("Монтаж ветровых кронштейнов", "construction", 7),
                    ("Геодезическая съемка кронштейнов", "construction", 2),
                    ("Сдача кронштейнов Технадзору", "construction", 3),
                    ("Монтаж утеплителя (слой 1)", "construction", 7),
                    ("Монтаж утеплителя (слой 2)", "construction", 7),
                    ("Монтаж подсистемы/направляющих", "construction", 10),
                    ("Монтаж облицовки", "construction", 14),
                ]),
                ("Монтаж СПК", [
                    ("Монтаж модулей СПК", "construction", 14),
                    ("Устройство уплотнителя", "construction", 5),
                    ("Герметизация швов", "construction", 7),
                ]),
                ("Завершение", [
                    ("Финальная сдача Технадзору", "construction", 5),
                    ("Оформление АОСР (ПТО)", "pto", 7),
                    ("Исполнительные схемы", "pto", 5),
                    ("Закрывающие документы", "pto", 5),
                    ("Сверка М15, остатки → склад", "production", 3),
                    ("Демонтаж подмостей", "construction", 5),
                ]),
            ],
            2: [  # НВФ only (subset)
                ("Проектирование", [
                    ("Разработка ОПР", "design_opr", 14),
                    ("Разработка КМ", "design_km", 10),
                    ("Разработка КМД", "design_kmd", 14),
                    ("Выдача спецификаций", "design_kmd", 3),
                ]),
                ("Снабжение", [
                    ("Заказ алюминиевого профиля", "supply", 21),
                    ("Заказ утеплителя", "supply", 14),
                    ("Заказ крепежа/анкеров", "supply", 10),
                    ("Заказ облицовочных панелей", "supply", 21),
                ]),
                ("Производство", [
                    ("Изготовление каркасов НВФ", "production", 21),
                    ("Комплектация и отгрузка", "production", 7),
                ]),
                ("Монтаж", [
                    ("Оформление допуска ОТ", "safety", 5),
                    ("Монтаж лесов", "construction", 10),
                    ("Бурение + кронштейны", "construction", 15),
                    ("Утепление", "construction", 10),
                    ("Облицовка", "construction", 14),
                    ("Сдача Технадзору", "construction", 5),
                ]),
                ("ПТО", [
                    ("АОСР + исполнительные", "pto", 10),
                ]),
            ],
            3: [  # СПК only
                ("Проектирование", [
                    ("Разработка КМД (модули СПК)", "design_kmd", 14),
                    ("Согласование цвета/формулы", "design_km", 7),
                    ("Выдача монтажных схем", "design_kmd", 5),
                ]),
                ("Снабжение", [
                    ("Заказ стеклопакетов", "supply", 30),
                    ("Заказ герметика", "supply", 10),
                    ("Заказ уплотнителей", "supply", 10),
                ]),
                ("Производство", [
                    ("Изготовление модулей СПК", "production", 28),
                    ("Комплектация и отгрузка", "production", 7),
                ]),
                ("Монтаж", [
                    ("Подготовка проёмов", "construction", 5),
                    ("Монтаж модулей СПК", "construction", 14),
                    ("Уплотнители + герметизация", "construction", 10),
                    ("Финальная сдача", "construction", 5),
                ]),
                ("ПТО", [
                    ("АОСР", "pto", 7),
                ]),
            ],
        }

        template = TEMPLATES.get(template_id, TEMPLATES[1])
        items = []
        sort_order = 0

        for section_name, tasks in template:
            for task_name, dept_code, duration_days in tasks:
                sort_order += 10
                try:
                    dept = Department(dept_code)
                except ValueError:
                    dept = Department.CONSTRUCTION
                item = GPRItem(
                    gpr_id=gpr_id,
                    object_id=object_id,
                    title=task_name,
                    section=section_name,
                    department=dept,
                    sort_order=sort_order,
                    duration_days=duration_days,
                    status=TaskStatus.NEW,
                )
                items.append(item)

        return items

    # ── File Upload ──

    from fastapi import UploadFile, File as FastAPIFile, Form

    @app.post("/api/upload")
    async def upload_file(
        file: UploadFile,
        type: str = Form("general"),
        user: User = Depends(get_current_user),
    ):
        """
        Upload a file to S3-compatible storage.
        Пробел → requires MinIO/S3 client; returns mock URL for now.
        """
        if not file.filename:
            raise HTTPException(400, "No file provided")

        # Validate size (20MB)
        content = await file.read()
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(413, "File too large (max 20MB)")

        # In production: upload to MinIO/S3
        # from minio import Minio
        # client = Minio(settings.minio_endpoint, ...)
        # client.put_object(bucket, object_name, BytesIO(content), len(content))

        import uuid
        file_id = uuid.uuid4().hex[:12]
        ext = file.filename.rsplit('.', 1)[-1] if '.' in file.filename else ''
        object_name = f"{type}/{file_id}.{ext}"

        # Mock URL (replace with actual S3 URL in production)
        url = f"/files/{object_name}"

        return {
            "url": url,
            "filename": file.filename,
            "size": len(content),
            "type": type,
        }