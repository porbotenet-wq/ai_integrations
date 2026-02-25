import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, Date, Boolean,
    ForeignKey, Enum, Float, JSON, UniqueConstraint, Index, func
)
from sqlalchemy.dialects.postgresql import JSONB
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
    PROJECT_MANAGER = "project_manager"
    DESIGN_HEAD = "design_head"
    DESIGNER_OPR = "designer_opr"
    DESIGNER_KM = "designer_km"
    DESIGNER_KMD = "designer_kmd"
    SUPPLY = "supply"
    PRODUCTION = "production"
    CONSTRUCTION_ITR = "construction_itr"
    SAFETY = "safety"
    PTO = "pto"
    CONTRACT = "contract"
    VIEWER = "viewer"
    # New roles from Excel (Лист 3)
    DIRECTOR = "director"
    CURATOR = "curator"
    GEODESIST = "geodesist"
    INSTALLER = "installer"


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


class ElementStatusEnum(str, enum.Enum):
    DESIGN = "design"
    PRODUCTION_QUEUE = "production_queue"
    IN_PRODUCTION = "in_production"
    QUALITY_CHECK = "quality_check"
    WAREHOUSE = "warehouse"
    SHIPPED = "shipped"
    INSTALLED = "installed"


class BOMStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    IN_PRODUCTION = "in_production"
    COMPLETED = "completed"


# ─── CORE MODELS ─────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    username = Column(String(255))
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50))
    role = Column(Enum(UserRole, name="user_role", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=UserRole.VIEWER)
    department = Column(Enum(Department, name="department", create_type=False, values_callable=lambda x: [e.value for e in x]))
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
    facade_type = Column(String(50), default="СПК")
    total_volume = Column(String(100))
    contract_date = Column(Date)
    deadline_date = Column(Date)
    budget = Column(Float)
    status = Column(Enum(ObjectStatus, name="object_status", create_type=False, values_callable=lambda x: [e.value for e in x]), default=ObjectStatus.DRAFT, nullable=False)
    responsible_pm_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    gpr = relationship("GPR", back_populates="object", uselist=False)
    roles = relationship("ObjectRole", back_populates="object")
    tasks = relationship("Task", back_populates="object")
    supply_orders = relationship("SupplyOrder", back_populates="object")
    construction_stages = relationship("ConstructionStage", back_populates="object")
    documents = relationship("Document", back_populates="object")
    zones = relationship("Zone", back_populates="object")
    shipments = relationship("Shipment", back_populates="object")


class ObjectRole(Base):
    __tablename__ = "object_roles"
    __table_args__ = (
        UniqueConstraint("object_id", "user_id", "role", name="uq_object_user_role"),
    )

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(UserRole, name="user_role", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    assigned_at = Column(DateTime, default=func.now())

    object = relationship("ConstructionObject", back_populates="roles")
    user = relationship("User", back_populates="object_roles")


class GPR(Base):
    __tablename__ = "gprs"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), unique=True, nullable=False)
    version = Column(Integer, default=1)
    status = Column(Enum(GPRStatus, name="gpr_status", create_type=False, values_callable=lambda x: [e.value for e in x]), default=GPRStatus.DRAFT)
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
    department = Column(Enum(Department, name="department", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    title = Column(String(500), nullable=False)
    unit = Column(String(50))
    volume = Column(Float)
    responsible = Column(String(255))
    start_date = Column(Date)
    end_date = Column(Date)
    duration_days = Column(Integer)
    notes = Column(Text)
    sort_order = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("gpr_items.id"))

    gpr = relationship("GPR", back_populates="items")
    task = relationship("Task", back_populates="gpr_item", uselist=False)
    daily_plan_facts = relationship("DailyPlanFact", back_populates="gpr_item")


class GPRSignature(Base):
    __tablename__ = "gpr_signatures"
    __table_args__ = (
        UniqueConstraint("gpr_id", "user_id", name="uq_gpr_user_signature"),
    )

    id = Column(Integer, primary_key=True)
    gpr_id = Column(Integer, ForeignKey("gprs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department = Column(Enum(Department, name="department", create_type=False, values_callable=lambda x: [e.value for e in x]))
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
    department = Column(Enum(Department, name="department", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(TaskStatus, name="task_status", create_type=False, values_callable=lambda x: [e.value for e in x]), default=TaskStatus.NEW, nullable=False)
    priority = Column(Integer, default=0)
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
    status = Column(Enum(SupplyStatus, name="supply_status", create_type=False, values_callable=lambda x: [e.value for e in x]), default=SupplyStatus.REQUESTED)
    supplier = Column(String(255))
    expected_date = Column(Date)
    actual_date = Column(Date)
    delivery_location = Column(String(255))
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
    status = Column(Enum(ConstructionStageStatus, name="construction_stage_status", create_type=False, values_callable=lambda x: [e.value for e in x]), default=ConstructionStageStatus.PENDING)
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
    doc_type = Column(String(50), nullable=False)
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
    type = Column(Enum(NotificationType, name="notification_type", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    title = Column(String(500), nullable=False)
    text = Column(Text)
    entity_type = Column(String(50))
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
    old_value = Column(JSONB)
    new_value = Column(JSONB)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("ix_audit_entity", "entity_type", "entity_id"),
        Index("ix_audit_user_date", "user_id", "created_at"),
    )


# ─── EXCEL MODELS (Листы 5-12) ──────────────────────────

class Zone(Base):
    """Лист 5: Зоны/Этапы объекта"""
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(500), nullable=False)
    floor_axis = Column(String(255))
    system_type = Column(String(100))
    volume = Column(Float)
    priority = Column(Integer, default=0)
    production_start_date = Column(Date)
    delivery_date = Column(Date)
    created_at = Column(DateTime, default=func.now())

    object = relationship("ConstructionObject", back_populates="zones")
    bom_items = relationship("BOMItem", back_populates="zone")
    shipments = relationship("Shipment", back_populates="zone")


class BOMItem(Base):
    """Лист 6: Спецификация (Bill of Materials)"""
    __tablename__ = "bom_items"

    id = Column(Integer, primary_key=True)
    zone_id = Column(Integer, ForeignKey("zones.id", ondelete="CASCADE"), nullable=False)
    mark = Column(String(255), nullable=False)
    item_type = Column(String(255))
    material = Column(String(255))
    quantity = Column(Float)
    weight = Column(Float)
    labor_norm = Column(Float)
    status = Column(Enum(BOMStatus, name="bom_status", create_type=False, values_callable=lambda x: [e.value for e in x]), default=BOMStatus.DRAFT)
    created_at = Column(DateTime, default=func.now())

    zone = relationship("Zone", back_populates="bom_items")
    element_status = relationship("ElementStatus", back_populates="bom_item", uselist=False)
    warehouse = relationship("Warehouse", back_populates="bom_item", uselist=False)
    production_plans = relationship("ProductionPlan", back_populates="bom_item")


class Material(Base):
    """Лист 7: Материалы"""
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True)
    code = Column(String(100), unique=True, nullable=False)
    name = Column(String(500), nullable=False)
    type = Column(String(100))
    unit = Column(String(50))
    object_demand = Column(Float, default=0)
    purchased = Column(Float, default=0)
    in_stock = Column(Float, default=0)
    in_production = Column(Float, default=0)
    deficit = Column(Float, default=0)
    updated_at = Column(DateTime, default=func.now())


class ProductionPlan(Base):
    """Лист 8: План производства"""
    __tablename__ = "production_plan"

    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    workshop = Column(String(100))
    line = Column(String(100))
    bom_item_id = Column(Integer, ForeignKey("bom_items.id"))
    gpr_item_id = Column(Integer, ForeignKey("gpr_items.id"))
    plan_qty = Column(Float, default=0)
    fact_qty = Column(Float, default=0)
    deviation = Column(Float, default=0)
    completion_pct = Column(Float, default=0)
    master_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

    bom_item = relationship("BOMItem", back_populates="production_plans")
    gpr_item = relationship("GPRItem")
    master = relationship("User")


class ElementStatus(Base):
    """Лист 9: Статус элементов"""
    __tablename__ = "element_status"

    id = Column(Integer, primary_key=True)
    bom_item_id = Column(Integer, ForeignKey("bom_items.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(ElementStatusEnum, name="element_status_enum", create_type=False, values_callable=lambda x: [e.value for e in x]), default=ElementStatusEnum.DESIGN)
    stage_date = Column(DateTime, default=func.now())
    time_norm = Column(Float)
    time_fact = Column(Float)
    defect_count = Column(Integer, default=0)
    comment = Column(Text)
    plan_daily = Column(Float, default=0)
    fact_daily = Column(Float, default=0)
    deviation = Column(Float, default=0)
    completion_pct = Column(Float, default=0)

    bom_item = relationship("BOMItem", back_populates="element_status")


class Warehouse(Base):
    """Лист 10: Склад готовой продукции"""
    __tablename__ = "warehouse"

    id = Column(Integer, primary_key=True)
    bom_item_id = Column(Integer, ForeignKey("bom_items.id", ondelete="CASCADE"), nullable=False)
    produced_qty = Column(Float, default=0)
    shipped_qty = Column(Float, default=0)
    remaining = Column(Float, default=0)
    ready_date = Column(Date)
    ready_to_ship = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=func.now())

    bom_item = relationship("BOMItem", back_populates="warehouse")


class Shipment(Base):
    """Лист 11: Отгрузка"""
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True)
    batch_number = Column(String(100))
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    zone_id = Column(Integer, ForeignKey("zones.id"))
    ship_date = Column(Date)
    items_list = Column(Text)
    quantity = Column(Float)
    vehicle = Column(String(255))
    responsible_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

    object = relationship("ConstructionObject", back_populates="shipments")
    zone = relationship("Zone", back_populates="shipments")
    responsible = relationship("User")


class DailyPlanFact(Base):
    """Лист 12: План/Факт работ (ежедневный)"""
    __tablename__ = "daily_plan_fact"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id"))
    gpr_item_id = Column(Integer, ForeignKey("gpr_items.id", ondelete="CASCADE"), nullable=True)
    date = Column(Date, nullable=False)
    work_name = Column(String(500))
    fact_volume = Column(Float, default=0)
    unit = Column(String(50))
    notes = Column(Text)
    plan_daily = Column(Float, default=0)
    deviation = Column(Float, default=0)
    completion_pct = Column(Float, default=0)
    executor_id = Column(Integer, ForeignKey("users.id"))
    work_type_id = Column(Integer, ForeignKey("work_types.id"))
    work_code = Column(String(50))
    sequence_order = Column(Integer, default=0)
    crew_id = Column(Integer, ForeignKey("crews.id"))
    crew_code = Column(String(50))
    workers_count = Column(Integer)
    productivity = Column(Float)
    inspection_status = Column(String(50), default="Нет")
    inspection_date = Column(Date)
    cumulative_plan = Column(Float)
    cumulative_fact = Column(Float)
    cumulative_pct = Column(Float)
    day_number = Column(Integer)
    week_number = Column(String(20))
    floor = Column(Integer)
    facade = Column(String(100))
    created_at = Column(DateTime, default=func.now())

    gpr_item = relationship("GPRItem", back_populates="daily_plan_facts")
    executor = relationship("User")
    work_type = relationship("WorkType")
    crew = relationship("Crew")


# ─── PRODUCTION MODELS (Excel СПК Блок Б) ───────────────

class Crew(Base):
    """Бригады"""
    __tablename__ = "crews"

    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    foreman = Column(String(255))
    phone = Column(String(50))
    specialization = Column(Text)
    max_workers = Column(Integer, default=0)
    status = Column(String(20), default="active")
    object_id = Column(Integer, ForeignKey("objects.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    object = relationship("ConstructionObject")


class WorkType(Base):
    """Виды работ"""
    __tablename__ = "work_types"

    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    unit = Column(String(50), default="шт")
    category = Column(String(100))
    sequence_order = Column(Integer, default=0)
    requires_inspection = Column(Boolean, default=False)
    default_crew_id = Column(Integer, ForeignKey("crews.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    default_crew = relationship("Crew")


class FloorVolume(Base):
    """Объёмы по этажам/фасадам"""
    __tablename__ = "floor_volumes"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id"), nullable=False)
    floor = Column(Integer, nullable=False)
    facade = Column(String(100), nullable=False)
    work_type_id = Column(Integer, ForeignKey("work_types.id"), nullable=False)
    plan_qty = Column(Float, default=0)
    fact_qty = Column(Float, default=0)
    inspection_brackets = Column(String(50), default="Не сдано")
    inspection_floor = Column(String(50), default="Не сдано")
    status = Column(String(20), default="not_started")
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    object = relationship("ConstructionObject")
    work_type = relationship("WorkType")


class GPRWeekly(Base):
    """ГПР понедельная разбивка"""
    __tablename__ = "gpr_weekly"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id"), nullable=False)
    work_type_id = Column(Integer, ForeignKey("work_types.id"), nullable=False)
    week_code = Column(String(20), nullable=False)
    week_start = Column(Date)
    plan_qty = Column(Float, default=0)
    fact_qty = Column(Float, default=0)
    created_at = Column(DateTime, default=func.now())

    object = relationship("ConstructionObject")
    work_type = relationship("WorkType")


    object = relationship("ConstructionObject")


# ─── TELEGRAM CHAT LINKS ────────────────────────────────

class ObjectChat(Base):
    """Привязка TG-чатов/групп к объектам и задачам"""
    __tablename__ = "object_chats"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    chat_id = Column(BigInteger, nullable=False)
    chat_title = Column(String(255))
    chat_type = Column(String(20), default="group")  # group, supergroup
    linked_by_id = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    object = relationship("ConstructionObject")
    task = relationship("Task")
    linked_by = relationship("User")


class DailyProgress(Base):
    """Прогресс по датам (консолидация)"""
    __tablename__ = "daily_progress"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, ForeignKey("objects.id"), nullable=False)
    date = Column(Date, nullable=False)
    day_number = Column(Integer)
    week_code = Column(String(20))
    modules_plan = Column(Float, default=0)
    modules_fact = Column(Float, default=0)
    brackets_plan = Column(Float, default=0)
    brackets_fact = Column(Float, default=0)
    sealant_plan = Column(Float, default=0)
    sealant_fact = Column(Float, default=0)
    hermetic_plan = Column(Float, default=0)
    hermetic_fact = Column(Float, default=0)
    notes = Column(Text)
    created_at = Column(DateTime, default=func.now())

    object = relationship("ConstructionObject")
