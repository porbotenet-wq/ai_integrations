from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from bot.db.models import (
    GPR, GPRItem, GPRSignature, GPRStatus, Department,
    ConstructionObject, ObjectStatus, ObjectRole, User
)


# Template of GPR items based on the analyzed document structure
GPR_TEMPLATE = [
    (Department.CONTRACT, [
        "Дата подписание договора",
        "Дата завершение работ",
        "График авансирования",
        "Направить Рук.проекта договор со сметой",
        "Передать контакты заказчика Рук.проекта",
    ]),
    (Department.TECHNICAL, [
        "Составить внутренний график производства работ",
        "Направить ГПР по отделам",
        "Определить ответственного по разработке ОПР",
        "Определить ответственного по разработке КМ",
        "Определить ответственного по разработке КМД",
        "Подготовить исходно-разрешительную документацию",
        "Определить ИТР на строительной площадке",
        "Получить ТЗ со штампом производства работ от заказчика",
        "Подписать ГПР с проектным отделом",
        "Подписать ГПР с отделом снабжения",
        "Подписать ГПР с производственным отделом",
        "Подписать ГПР с монтажным подразделением и ИТР",
    ]),
    (Department.DESIGN_OPR, [
        "Определить профильную систему",
        "Произвести первичный расчёт (статика + теплотехника)",
        "Статика стоечно-ригельной системы",
        "Статика кронштейнов",
        "Статика анкеров",
        "Подбор сечения профилей",
        "Узловые решения",
        "Фасады (с АР)",
        "Планы (с АР)",
        "Согласование с проектным институтом",
    ]),
    (Department.DESIGN_KM, [
        "Деталлировка фасадов",
        "Деталлировка планов",
        "Спецификация на профильную систему",
        "Первичная спецификация на заполнения",
        "Спецификация комплектующих",
        "Ведомость объёмов работ",
        "Разрезы",
        "Оформление узлов",
        "ТЗ на сопутствующие работы (козырьки, ограждения, люки)",
        "Согласовать фурнитуру и СКУД",
    ]),
    (Department.DESIGN_KMD, [
        "Получить геодезию",
        "Наложить фасады на геодезию",
        "Выдать чертежи на кронштейны",
        "Разработка КМД",
        "Выдать заявку на заполнения",
        "КМД на открывающие элементы",
        "Заявка на заполнения открывающих элементов",
        "Задания на декоративные элементы",
        "Выдать монтажные схемы",
    ]),
    (Department.SUPPLY, [
        "Поставка профильной системы",
        "Поставка кронштейнов",
        "Поставка заполнения",
        "Поставка паронита, анкеров",
        "Поставка монтажного комплекта",
        "Поставка фурнитуры",
        "Поставка оцинкованных изделий",
        "Поставка утеплителя",
        "Поставка герметика",
        "Поставка метизов",
        "Поставка комплектующих",
        "Поставка строительных подмостей",
        "Поставка бытового городка",
        "Поставка расходных материалов",
        "Поставка козырьков",
        "Поставка стеклянных ограждений",
        "Поставка вент. решёток",
    ]),
    (Department.PRODUCTION, [
        "Получить КМД, карту раскроя",
        "Отгрузка каркаса (по типам витражей)",
        "Отгрузка прижимных планок, декоративных крышек",
        "Отгрузка створок",
        "Отгрузка дверей",
    ]),
    (Department.SAFETY, [
        "Получить список работников",
        "Получить список ИТР",
        "Подготовка документов для выхода на объект",
        "Контроль охраны труда на объекте",
    ]),
    (Department.CONSTRUCTION, [
        "Геодезическая съёмка",
        "Испытания на вырыв анкера",
        "Организация штаба",
        "Приёмка строительной готовности фасада",
        "Приёмка основания под подмости",
        "Приёмка строительных подмостей",
        "Сборка строительных подмостей",
        "Разметка на фасаде",
        "Приёмка материалов",
        "Монтаж кронштейнов, каркаса",
        "Сдача работ (каркас)",
        "Монтаж отсечки + герметизация",
        "Сдача работ (отсечка)",
        "Монтаж первого слоя утеплителя",
        "Сдача работ (утепл. 1)",
        "Монтаж второго слоя утеплителя",
        "Сдача работ (утепл. 2)",
        "Монтаж заполнения",
        "Монтаж открывающих элементов",
        "Монтаж вент. решёток",
        "Монтаж прижимных планок, декоративных крышек",
        "Сдача работ (заполнение)",
        "Монтаж козырьков",
        "Сдача работ (козырьки)",
        "Монтаж стеклянных ограждений",
        "Сдача работ (ограждения)",
        "Разбор строительных подмостей",
        "Вывоз материалов, строительного городка",
    ]),
    (Department.PTO, [
        "АОСР, исп. схемы — кронштейны, каркас",
        "АОСР, исп. схемы — устройство примыкания",
        "АОСР, исп. схемы — заполнение",
        "АОСР, исп. схемы — открывающие элементы",
        "АОСР, исп. схемы — прижимные планки, декор. крышки",
        "АОСР, исп. схемы — козырьки, стеклянные ограждения",
    ]),
]


async def create_gpr_from_template(
    session: AsyncSession, object_id: int, created_by_id: int
) -> GPR:
    gpr = GPR(
        object_id=object_id,
        version=1,
        status=GPRStatus.DRAFT,
        created_by=created_by_id,
    )
    session.add(gpr)
    await session.flush()

    sort_order = 0
    for dept, items in GPR_TEMPLATE:
        for title in items:
            item = GPRItem(
                gpr_id=gpr.id,
                department=dept,
                title=title,
                sort_order=sort_order,
            )
            session.add(item)
            sort_order += 1

    await session.flush()
    return gpr


async def get_gpr_by_object(session: AsyncSession, object_id: int) -> GPR | None:
    result = await session.execute(
        select(GPR)
        .options(
            selectinload(GPR.items),
            selectinload(GPR.signatures).selectinload(GPRSignature.user),
        )
        .where(GPR.object_id == object_id)
    )
    return result.scalar_one_or_none()


async def send_gpr_for_signatures(session: AsyncSession, gpr_id: int, object_id: int):
    """Create signature requests for all department heads assigned to the object."""
    gpr = await session.get(GPR, gpr_id)
    if not gpr:
        return

    result = await session.execute(
        select(ObjectRole)
        .options(selectinload(ObjectRole.user))
        .where(ObjectRole.object_id == object_id)
    )
    roles = result.scalars().all()

    for obj_role in roles:
        existing = await session.execute(
            select(GPRSignature).where(
                GPRSignature.gpr_id == gpr_id,
                GPRSignature.user_id == obj_role.user_id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        sig = GPRSignature(
            gpr_id=gpr_id,
            user_id=obj_role.user_id,
            department=obj_role.user.department,
        )
        session.add(sig)

    gpr.status = GPRStatus.PENDING_SIGNATURES
    await session.flush()


async def sign_gpr(session: AsyncSession, gpr_id: int, user_id: int) -> bool:
    result = await session.execute(
        select(GPRSignature).where(
            GPRSignature.gpr_id == gpr_id,
            GPRSignature.user_id == user_id,
        )
    )
    sig = result.scalar_one_or_none()
    if not sig:
        return False

    sig.signed = True
    sig.signed_at = datetime.utcnow()
    await session.flush()

    # Check if all signed
    all_sigs = await session.execute(
        select(GPRSignature).where(GPRSignature.gpr_id == gpr_id)
    )
    signatures = all_sigs.scalars().all()
    if all(s.signed for s in signatures):
        gpr = await session.get(GPR, gpr_id)
        gpr.status = GPRStatus.ACTIVE
        obj = await session.get(ConstructionObject, gpr.object_id)
        obj.status = ObjectStatus.ACTIVE
        await session.flush()
        return True  # all signed

    return False


async def get_gpr_items_by_department(session: AsyncSession, gpr_id: int, department: Department) -> list[GPRItem]:
    result = await session.execute(
        select(GPRItem).where(
            GPRItem.gpr_id == gpr_id,
            GPRItem.department == department,
        ).order_by(GPRItem.sort_order)
    )
    return result.scalars().all()
