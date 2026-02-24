import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, Date, Boolean,
    ForeignKey, Enum, Float, JSON, UniqueConstraint, Index, func
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


# ─── ENUMS ───────────────────────────────────────────────

class ObjectStatus(str, enum.Enum):
    DRAFT = "draft"
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETING = "completing"
    CLOSED = "closed"


class TaskStatus(str, enum.Enum):
    NEW = "new"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    BLOCKED = "blocked"
    DONE = "done"
    OVERDUE = "overdue"


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"          # Руководитель проекта
    DESIGN_HEAD = "design_head"                  # Рук. проектного отдела
    DESIGNER_OPR = "designer_opr"                # Конструктор ОПР
    DESIGNER_KM = "designer_km"                  # Конструктор КМ
    DESIGNER_KMD = "designer_kmd"                # Конструктор КМД
    SUPPLY = "supply"                            # Отдел снабжения
    PRODUCTION = "production"                    # Производственный отдел
    CONSTRUCTION_ITR = "construction_itr"         # ИТР / Прораб
    SAFETY = "safety"                            # Охрана труда
    PTO = "pto"                                  # Отдел ПТО
    CONTRACT = "contract"                        # Договорной отдел
    VIEWER = "viewer"


class Department(str, enum.Enum):
    CONTRACT = "contract"
    TECHNICAL = "technical"
    DESIGN_OPR = "design_opr"
    DESIGN_KM = "design_km"
    DESIGN_KMD = "design_kmd"
    SUPPLY = "supply"
    PRODUCTION = "production"
    SAFETY = "safety"
    CONSTRUCTION = "construction"
    PTO = "pto"


class GPRStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_SIGNATURES = "pending_signatures"
    ACTIVE = "active"
    REVISED = "revised"
    ARCHIVED = "archived"


class SupplyStatus(str, enum.Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    ORDERED = "ordered"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    DELAYED = "delayed"


class ConstructionStageStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class NotificationType(str, enum.Enum):
    TASK_ASSIGNED = "task_assigned"
    TASK_OVERDUE = "task_overdue"
    GPR_SIGN_REQUEST = "gpr_sign_request"
    GPR_SIGNED = "gpr_signed"
    SUPPLY_DELAYED = "supply_delayed"
    SUPPLY_SHIPPED = "supply_shipped"
    STAGE_COMPLETED = "stage_completed"
    ESCALATION = "escalation"
    DEFECT_REPORTED = "defect_reported"
    GENERAL = "general"


# ─── MODELS ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    username = Column(String(255))
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50))
    role = Column(Enum(UserRole), nullable=False, default=UserRole.VIEWER)
    department = Column(Enum(Department))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    object_roles = relationship("ObjectRole", back_populates="user")
    assigned_tasks = relationship("Task", foreign_keys="Task.assignee_id", back_populates="assignee")
    notifications = relationship("Notification", back_populates="user")


class ConstructionObject(Base):
    __tablename__ = "objects"

    id = Column(Integer, primary_key=True)
    name = Column(String(500), nullable=False)
    city = Column(String(255))
    address = Column(Text)
    contract_date = Column(Date)
    deadline_date = Column(Date)
    budget = Column(Float)
    status = Column(Enum(ObjectStatus), default=ObjectStatus.DRAFT, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    gpr = relationship("GPR", back_populates="object", uselist=False)
    roles = relationship("ObjectRole", back_populates="object")
    tasks = relationship("Task", back_populates="object")
    supply_orders = relationship("SupplyOrder", back_populates="object")
    construction_stages = relationship("ConstructionStage", back_populates="object")
    documents = relationship("Document", back_populates="object")


class ObjectRole(Base):
    __tablename__ = "object_roles"
    __table_args__ = (
        UniqueConstraint("object_id", "user_id", "role", name="uq_object_user_role"),
    )

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    assigned_at = Column(DateTime, default=func.now())

    object = relationship("ConstructionObject", back_populates="roles")
    user = relationship("User", back_populates="object_roles")


class GPR(Base):
    __tablename__ = "gprs"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), unique=True, nullable=False)
    version = Column(Integer, default=1)
    status = Column(Enum(GPRStatus), default=GPRStatus.DRAFT)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    object = relationship("ConstructionObject", back_populates="gpr")
    items = relationship("GPRItem", back_populates="gpr", order_by="GPRItem.sort_order")
    signatures = relationship("GPRSignature", back_populates="gpr")


class GPRItem(Base):
    __tablename__ = "gpr_items"

    id = Column(Integer, primary_key=True)
    gpr_id = Column(Integer, ForeignKey("gprs.id", ondelete="CASCADE"), nullable=False)
    department = Column(Enum(Department), nullable=False)
    title = Column(String(500), nullable=False)
    unit = Column(String(50))
    responsible = Column(String(255))
    start_date = Column(Date)
    end_date = Column(Date)
    duration_days = Column(Integer)
    notes = Column(Text)
    sort_order = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("gpr_items.id"))

    gpr = relationship("GPR", back_populates="items")
    task = relationship("Task", back_populates="gpr_item", uselist=False)


class GPRSignature(Base):
    __tablename__ = "gpr_signatures"
    __table_args__ = (
        UniqueConstraint("gpr_id", "user_id", name="uq_gpr_user_signature"),
    )

    id = Column(Integer, primary_key=True)
    gpr_id = Column(Integer, ForeignKey("gprs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department = Column(Enum(Department))
    signed = Column(Boolean, default=False)
    signed_at = Column(DateTime)
    comment = Column(Text)

    gpr = relationship("GPR", back_populates="signatures")
    user = relationship("User")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    gpr_item_id = Column(Integer, ForeignKey("gpr_items.id"), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    department = Column(Enum(Department), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.NEW, nullable=False)
    priority = Column(Integer, default=0)  # 0=normal, 1=high, 2=critical
    deadline = Column(Date)
    completed_at = Column(DateTime)
    blocked_reason = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    object = relationship("ConstructionObject", back_populates="tasks")
    gpr_item = relationship("GPRItem", back_populates="task")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_tasks")
    created_by = relationship("User", foreign_keys=[created_by_id])
    comments = relationship("TaskComment", back_populates="task", order_by="TaskComment.created_at")

    __table_args__ = (
        Index("ix_tasks_status_deadline", "status", "deadline"),
        Index("ix_tasks_assignee_status", "assignee_id", "status"),
    )


class TaskComment(Base):
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())

    task = relationship("Task", back_populates="comments")
    user = relationship("User")


class SupplyOrder(Base):
    __tablename__ = "supply_orders"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    material_name = Column(String(500), nullable=False)
    quantity = Column(Float)
    unit = Column(String(50))
    status = Column(Enum(SupplyStatus), default=SupplyStatus.REQUESTED)
    supplier = Column(String(255))
    expected_date = Column(Date)
    actual_date = Column(Date)
    delivery_location = Column(String(255))  # объект / производство
    created_by_id = Column(Integer, ForeignKey("users.id"))
    approved_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    object = relationship("ConstructionObject", back_populates="supply_orders")
    created_by = relationship("User", foreign_keys=[created_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class ConstructionStage(Base):
    __tablename__ = "construction_stages"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    sort_order = Column(Integer, default=0)
    status = Column(Enum(ConstructionStageStatus), default=ConstructionStageStatus.PENDING)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    accepted_by_id = Column(Integer, ForeignKey("users.id"))

    object = relationship("ConstructionObject", back_populates="construction_stages")
    accepted_by = relationship("User")
    checklist = relationship("ChecklistItem", back_populates="stage", order_by="ChecklistItem.sort_order")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True)
    stage_id = Column(Integer, ForeignKey("construction_stages.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    is_done = Column(Boolean, default=False)
    done_by_id = Column(Integer, ForeignKey("users.id"))
    done_at = Column(DateTime)
    photo_url = Column(String(1000))
    sort_order = Column(Integer, default=0)

    stage = relationship("ConstructionStage", back_populates="checklist")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    doc_type = Column(String(50), nullable=False)  # tz, aosr, kmd, m15, ttn, etc.
    title = Column(String(500), nullable=False)
    file_url = Column(String(1000))
    version = Column(Integer, default=1)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

    object = relationship("ConstructionObject", back_populates="documents")
    uploaded_by = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(500), nullable=False)
    text = Column(Text)
    entity_type = Column(String(50))  # task, object, gpr, supply
    entity_id = Column(Integer)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer)
    old_value = Column(JSON)
    new_value = Column(JSON)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("ix_audit_entity", "entity_type", "entity_id"),
        Index("ix_audit_user_date", "user_id", "created_at"),
    )
