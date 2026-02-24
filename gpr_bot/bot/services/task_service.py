from datetime import date, datetime
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from bot.db.models import Task, TaskStatus, TaskComment, Department, User, UserRole


VALID_TRANSITIONS = {
    TaskStatus.NEW: {TaskStatus.ASSIGNED},
    TaskStatus.ASSIGNED: {TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED},
    TaskStatus.IN_PROGRESS: {TaskStatus.REVIEW, TaskStatus.BLOCKED, TaskStatus.OVERDUE},
    TaskStatus.REVIEW: {TaskStatus.DONE, TaskStatus.IN_PROGRESS},
    TaskStatus.BLOCKED: {TaskStatus.IN_PROGRESS},
    TaskStatus.OVERDUE: {TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.DONE, TaskStatus.BLOCKED},
    TaskStatus.DONE: set(),
}


async def create_task(
    session: AsyncSession,
    object_id: int,
    title: str,
    department: Department,
    created_by_id: int,
    description: str = "",
    assignee_id: int | None = None,
    deadline: date | None = None,
    gpr_item_id: int | None = None,
    priority: int = 0,
) -> Task:
    status = TaskStatus.ASSIGNED if assignee_id else TaskStatus.NEW
    task = Task(
        object_id=object_id, title=title, description=description,
        department=department, assignee_id=assignee_id,
        created_by_id=created_by_id, status=status,
        deadline=deadline, gpr_item_id=gpr_item_id, priority=priority,
    )
    session.add(task)
    await session.flush()
    return task


async def get_user_tasks(
    session: AsyncSession, user: User, status_filter: list[TaskStatus] | None = None
) -> list[Task]:
    query = select(Task).options(selectinload(Task.assignee))

    if user.role in (UserRole.ADMIN, UserRole.PROJECT_MANAGER):
        pass  # see all
    elif user.role == UserRole.DESIGN_HEAD:
        query = query.where(Task.department.in_([
            Department.DESIGN_OPR, Department.DESIGN_KM, Department.DESIGN_KMD
        ]))
    else:
        query = query.where(Task.assignee_id == user.id)

    if status_filter:
        query = query.where(Task.status.in_(status_filter))
    else:
        query = query.where(Task.status != TaskStatus.DONE)

    query = query.order_by(
        Task.status == TaskStatus.OVERDUE,  # overdue first
        Task.priority.desc(),
        Task.deadline.asc().nullslast(),
    )
    result = await session.execute(query)
    return result.scalars().all()


async def get_task_by_id(session: AsyncSession, task_id: int) -> Task | None:
    result = await session.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.created_by),
            selectinload(Task.comments).selectinload(TaskComment.user),
            selectinload(Task.object),
        )
        .where(Task.id == task_id)
    )
    return result.scalar_one_or_none()


async def transition_task(
    session: AsyncSession, task_id: int, new_status: TaskStatus, reason: str = ""
) -> Task | None:
    task = await get_task_by_id(session, task_id)
    if not task:
        return None

    if new_status not in VALID_TRANSITIONS.get(task.status, set()):
        return None

    task.status = new_status
    if new_status == TaskStatus.DONE:
        task.completed_at = datetime.utcnow()
    if new_status == TaskStatus.BLOCKED:
        task.blocked_reason = reason

    await session.flush()
    return task


async def reassign_task(session: AsyncSession, task_id: int, new_assignee_id: int) -> Task | None:
    task = await get_task_by_id(session, task_id)
    if not task:
        return None
    task.assignee_id = new_assignee_id
    if task.status == TaskStatus.NEW:
        task.status = TaskStatus.ASSIGNED
    await session.flush()
    return task


async def reschedule_task(session: AsyncSession, task_id: int, new_deadline: date) -> Task | None:
    task = await get_task_by_id(session, task_id)
    if not task:
        return None
    task.deadline = new_deadline
    if task.status == TaskStatus.OVERDUE:
        task.status = TaskStatus.IN_PROGRESS
    await session.flush()
    return task


async def add_comment(session: AsyncSession, task_id: int, user_id: int, text: str) -> TaskComment:
    comment = TaskComment(task_id=task_id, user_id=user_id, text=text)
    session.add(comment)
    await session.flush()
    return comment


async def get_overdue_tasks(session: AsyncSession) -> list[Task]:
    today = date.today()
    result = await session.execute(
        select(Task)
        .options(selectinload(Task.assignee), selectinload(Task.object))
        .where(
            Task.deadline < today,
            Task.status.notin_([TaskStatus.DONE, TaskStatus.OVERDUE]),
        )
    )
    return result.scalars().all()


async def get_object_tasks(session: AsyncSession, object_id: int, department: Department | None = None) -> list[Task]:
    query = (
        select(Task).options(selectinload(Task.assignee))
        .where(Task.object_id == object_id)
        .order_by(Task.deadline.asc().nullslast())
    )
    if department:
        query = query.where(Task.department == department)
    result = await session.execute(query)
    return result.scalars().all()
