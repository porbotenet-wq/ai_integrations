from aiogram.fsm.state import StatesGroup, State


class RegisterForm(StatesGroup):
    full_name = State()
    phone = State()
    department = State()


class CreateObjectForm(StatesGroup):
    name = State()
    city = State()
    address = State()
    contract_date = State()
    deadline_date = State()
    confirm = State()


class CreateTaskForm(StatesGroup):
    select_object = State()
    title = State()
    description = State()
    department = State()
    assignee = State()
    deadline = State()
    confirm = State()


class RescheduleForm(StatesGroup):
    new_deadline = State()
    reason = State()
    confirm = State()


class DelegateForm(StatesGroup):
    select_user = State()
    comment = State()
    confirm = State()


class CommentForm(StatesGroup):
    text = State()


class SupplyCreateForm(StatesGroup):
    material = State()
    quantity = State()
    unit = State()
    delivery_location = State()
    expected_date = State()
    confirm = State()


class DefectForm(StatesGroup):
    description = State()
    photo = State()
    confirm = State()


class BlockedForm(StatesGroup):
    reason = State()


class FactForm(StatesGroup):
    """Ввод факта выполнения работ (прораб)"""
    select_object = State()
    select_work_type = State()
    select_floor = State()
    select_facade = State()
    enter_volume = State()
    enter_workers = State()
    upload_photos = State()
    enter_notes = State()
    confirm = State()
