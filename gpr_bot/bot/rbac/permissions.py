from bot.db.models import UserRole, Department

# ─── PERMISSION DEFINITIONS ─────────────────────────────

PERMISSIONS = {
    # Object permissions
    "object.create":    {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.CONTRACT},
    "object.view_all":  {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.DIRECTOR, UserRole.CURATOR},
    "object.edit":      {UserRole.ADMIN, UserRole.PROJECT_MANAGER},
    "object.delete":    {UserRole.ADMIN},

    # GPR permissions
    "gpr.create":       {UserRole.ADMIN, UserRole.PROJECT_MANAGER},
    "gpr.sign":         {UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD, UserRole.SUPPLY,
                         UserRole.PRODUCTION, UserRole.CONSTRUCTION_ITR},
    "gpr.edit":         {UserRole.ADMIN, UserRole.PROJECT_MANAGER},
    "gpr.view":         set(UserRole),

    # Task permissions
    "task.create":      {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD},
    "task.assign":      {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD},
    "task.complete":    set(UserRole) - {UserRole.VIEWER},
    "task.approve":     {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD},
    "task.reschedule":  set(UserRole) - {UserRole.VIEWER},
    "task.delegate":    {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD},
    "task.view_all":    {UserRole.ADMIN, UserRole.PROJECT_MANAGER},

    # Supply permissions
    "supply.create":    {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD,
                         UserRole.DESIGNER_OPR, UserRole.DESIGNER_KM, UserRole.DESIGNER_KMD},
    "supply.approve":   {UserRole.ADMIN, UserRole.PROJECT_MANAGER},
    "supply.update":    {UserRole.ADMIN, UserRole.SUPPLY},
    "supply.receive":   {UserRole.SUPPLY, UserRole.PRODUCTION, UserRole.CONSTRUCTION_ITR},

    # Construction permissions
    "construction.start":    {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.CONSTRUCTION_ITR},
    "construction.complete": {UserRole.CONSTRUCTION_ITR},
    "construction.accept":   {UserRole.PROJECT_MANAGER},
    "construction.defect":   {UserRole.CONSTRUCTION_ITR, UserRole.PROJECT_MANAGER},

    # Documents
    "document.upload":  set(UserRole) - {UserRole.VIEWER},
    "document.approve": {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.DESIGN_HEAD},

    # Safety
    "safety.manage":    {UserRole.ADMIN, UserRole.SAFETY},

    # PTO
    "pto.create_aosr":  {UserRole.ADMIN, UserRole.PTO},

    # Admin
    "admin.manage_users":  {UserRole.ADMIN},
    "admin.manage_roles":  {UserRole.ADMIN},
    "admin.view_audit":    {UserRole.ADMIN, UserRole.PROJECT_MANAGER},

    # Dashboard
    "dashboard.view":   {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.CONTRACT, UserRole.DIRECTOR, UserRole.CURATOR},

    # Production & warehouse
    "production.plan":     {UserRole.ADMIN, UserRole.PRODUCTION, UserRole.PROJECT_MANAGER},
    "production.report":   {UserRole.ADMIN, UserRole.PRODUCTION},
    "warehouse.view":      {UserRole.ADMIN, UserRole.PRODUCTION, UserRole.SUPPLY, UserRole.PROJECT_MANAGER},
    "warehouse.manage":    {UserRole.ADMIN, UserRole.PRODUCTION, UserRole.SUPPLY},
    "shipment.create":     {UserRole.ADMIN, UserRole.SUPPLY, UserRole.PRODUCTION},
    "shipment.view":       set(UserRole) - {UserRole.VIEWER},
    "bom.create":          {UserRole.ADMIN, UserRole.DESIGNER_KM, UserRole.DESIGNER_KMD, UserRole.DESIGN_HEAD},
    "bom.view":            set(UserRole) - {UserRole.VIEWER},
    "zone.manage":         {UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.PTO},
    "material.manage":     {UserRole.ADMIN, UserRole.SUPPLY},
}

# ─── ROLE → DEPARTMENT MAPPING ───────────────────────────

ROLE_DEPARTMENT = {
    UserRole.CONTRACT: Department.CONTRACT,
    UserRole.PROJECT_MANAGER: Department.TECHNICAL,
    UserRole.DESIGN_HEAD: Department.DESIGN_OPR,
    UserRole.DESIGNER_OPR: Department.DESIGN_OPR,
    UserRole.DESIGNER_KM: Department.DESIGN_KM,
    UserRole.DESIGNER_KMD: Department.DESIGN_KMD,
    UserRole.SUPPLY: Department.SUPPLY,
    UserRole.PRODUCTION: Department.PRODUCTION,
    UserRole.CONSTRUCTION_ITR: Department.CONSTRUCTION,
    UserRole.SAFETY: Department.SAFETY,
    UserRole.PTO: Department.PTO,
    UserRole.DIRECTOR: Department.TECHNICAL,
    UserRole.CURATOR: Department.TECHNICAL,
    UserRole.GEODESIST: Department.CONSTRUCTION,
    UserRole.INSTALLER: Department.CONSTRUCTION,
}

# ─── ROLE DISPLAY NAMES (RU) ────────────────────────────

ROLE_NAMES = {
    UserRole.ADMIN: "Администратор",
    UserRole.PROJECT_MANAGER: "Руководитель проекта",
    UserRole.DESIGN_HEAD: "Рук. проектного отдела",
    UserRole.DESIGNER_OPR: "Конструктор ОПР",
    UserRole.DESIGNER_KM: "Конструктор КМ",
    UserRole.DESIGNER_KMD: "Конструктор КМД",
    UserRole.SUPPLY: "Отдел снабжения",
    UserRole.PRODUCTION: "Производственный отдел",
    UserRole.CONSTRUCTION_ITR: "ИТР / Прораб",
    UserRole.SAFETY: "Охрана труда",
    UserRole.PTO: "Отдел ПТО",
    UserRole.CONTRACT: "Договорной отдел",
    UserRole.VIEWER: "Наблюдатель",
    UserRole.DIRECTOR: "Генеральный директор",
    UserRole.CURATOR: "Куратор",
    UserRole.GEODESIST: "Геодезист",
    UserRole.INSTALLER: "Монтажник",
}

DEPARTMENT_NAMES = {
    Department.CONTRACT: "Договорной отдел",
    Department.TECHNICAL: "Технический отдел",
    Department.DESIGN_OPR: "Проектный отдел (ОПР)",
    Department.DESIGN_KM: "Проектный отдел (КМ)",
    Department.DESIGN_KMD: "Проектный отдел (КМД)",
    Department.SUPPLY: "Отдел снабжения",
    Department.PRODUCTION: "Производственный отдел",
    Department.SAFETY: "Охрана труда",
    Department.CONSTRUCTION: "Отдел СМР",
    Department.PTO: "Отдел ПТО",
}


def has_permission(role: UserRole, permission: str) -> bool:
    allowed = PERMISSIONS.get(permission, set())
    return role in allowed


def get_user_permissions(role: UserRole) -> list[str]:
    return [perm for perm, roles in PERMISSIONS.items() if role in roles]
