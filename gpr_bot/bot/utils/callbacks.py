from aiogram.filters.callback_data import CallbackData


class ObjectCB(CallbackData, prefix="obj"):
    action: str  # list, detail, gpr, supply, construction, docs, team
    id: int = 0
    page: int = 0


class TaskCB(CallbackData, prefix="task"):
    action: str  # list, detail, complete, delegate, reschedule, comment
    id: int = 0
    page: int = 0


class GPRCB(CallbackData, prefix="gpr"):
    action: str  # view, sign, reject, create
    id: int = 0


class SupplyCB(CallbackData, prefix="sup"):
    action: str  # list, detail, approve, ship, receive, delay
    id: int = 0
    page: int = 0


class ConstructionCB(CallbackData, prefix="con"):
    action: str  # list, detail, start, complete, accept, defect, checklist
    id: int = 0


class NotifCB(CallbackData, prefix="notif"):
    action: str  # list, read, go
    id: int = 0
    page: int = 0


class AdminCB(CallbackData, prefix="adm"):
    action: str  # users, roles, set_role, approve_user
    user_id: int = 0
    role: str = ""


class NavCB(CallbackData, prefix="nav"):
    to: str  # back, main, close
    ctx: str = ""
    id: int = 0
