"""
seed_demo.py — Наполнение демо-данными для Mini App
Запуск: docker exec gpr_bot-api-1 python3 seed_demo.py
"""
import asyncio
from datetime import date, datetime, timedelta, timezone
from bot.db.session import async_session, init_db
from bot.db.models import (
    Task, TaskStatus, Department,
    SupplyOrder, SupplyStatus,
    ConstructionStage, ConstructionStageStatus, ChecklistItem,
    Document, Notification,
)

OBJ_ID = 2  # СПК Блок Б
USER_ID = 1  # Adam/Алексей (admin)
NOW = datetime.utcnow()


async def seed():
    await init_db()
    async with async_session() as db:
        # ── Check if already seeded ──
        from sqlalchemy import select, func
        task_count = (await db.execute(select(func.count(Task.id)).where(Task.object_id == OBJ_ID))).scalar()
        if task_count > 0:
            print(f"Already seeded ({task_count} tasks). Skipping.")
            return

        print("Seeding demo data...")

        # ══════════════════════════════════════════════
        # TASKS (15 задач разных статусов и отделов)
        # ══════════════════════════════════════════════
        tasks_data = [
            ("Разработка ОПР фасад 1-3", Department.DESIGN_OPR, TaskStatus.DONE, 3, -30, -10),
            ("Разработка КМ кронштейны", Department.DESIGN_KM, TaskStatus.DONE, 2, -25, -8),
            ("КМД модули СПК блок Б", Department.DESIGN_KMD, TaskStatus.IN_PROGRESS, 3, -14, 7),
            ("Согласование цвета с заказчиком", Department.DESIGN_KM, TaskStatus.REVIEW, 2, -7, 3),
            ("Заказ алюминиевого профиля", Department.SUPPLY, TaskStatus.DONE, 3, -28, -14),
            ("Заказ стеклопакетов Guardian", Department.SUPPLY, TaskStatus.IN_PROGRESS, 4, -21, 10),
            ("Заказ утеплителя 100мм", Department.SUPPLY, TaskStatus.ASSIGNED, 2, -5, 7),
            ("Заказ крепежа Fischer FZA", Department.SUPPLY, TaskStatus.NEW, 1, None, 14),
            ("Монтаж лесов фасад 1", Department.CONSTRUCTION, TaskStatus.DONE, 3, -20, -12),
            ("Бурение Ø12 этажи 1-5", Department.CONSTRUCTION, TaskStatus.IN_PROGRESS, 3, -7, 5),
            ("Монтаж кронштейнов этажи 1-3", Department.CONSTRUCTION, TaskStatus.ASSIGNED, 2, None, 10),
            ("Геодезическая разбивка фасад 2", Department.CONSTRUCTION, TaskStatus.OVERDUE, 3, -10, -2),
            ("Оформление допуска ОТ бригада 3", Department.SAFETY, TaskStatus.DONE, 2, -15, -12),
            ("АОСР кронштейны этажи 1-3", Department.PTO, TaskStatus.NEW, 1, None, 21),
            ("Контроль качества сварных соединений", Department.CONSTRUCTION, TaskStatus.BLOCKED, 2, -5, 3),
        ]

        for title, dept, status, priority, start_offset, deadline_offset in tasks_data:
            t = Task(
                object_id=OBJ_ID,
                title=title,
                department=dept,
                status=status,
                priority=priority,
                assignee_id=USER_ID,
                created_by_id=USER_ID,
                deadline=date.today() + timedelta(days=deadline_offset) if deadline_offset else None,
                created_at=NOW + timedelta(days=start_offset) if start_offset else NOW,
                completed_at=NOW + timedelta(days=deadline_offset - 1) if status == TaskStatus.DONE else None,
            )
            if status == TaskStatus.BLOCKED:
                t.blocked_reason = "Ожидание результатов лабораторных испытаний"
            db.add(t)

        # ══════════════════════════════════════════════
        # SUPPLY ORDERS (10 заявок)
        # ══════════════════════════════════════════════
        supply_data = [
            ("Алюминиевый профиль Schüco", 2400, "п.м.", SupplyStatus.DELIVERED, "АлюмПро", -28, -14),
            ("Стеклопакеты Guardian SunGuard", 885, "шт", SupplyStatus.SHIPPED, "Guardian", -21, 5),
            ("Утеплитель Rockwool 100мм", 3200, "м²", SupplyStatus.ORDERED, "Rockwool", -5, 12),
            ("Крепёж Fischer FZA 12/30", 5000, "шт", SupplyStatus.APPROVED, "Fischer", 0, 14),
            ("Герметик Sika SG-20", 480, "шт", SupplyStatus.REQUESTED, "Sika", None, 21),
            ("Анкера Hilti HKD-S M12", 4998, "шт", SupplyStatus.DELAYED, "Hilti", -14, -3),
            ("Облицовочные панели RAL 7016", 1200, "шт", SupplyStatus.ORDERED, "Алюком", -10, 18),
            ("Уплотнитель EPDM", 2000, "п.м.", SupplyStatus.APPROVED, "Deventer", -3, 15),
            ("Подсистема НВФ (направляющие)", 800, "шт", SupplyStatus.SHIPPED, "Краспан", -18, 2),
            ("Доборные элементы (откосы)", 340, "шт", SupplyStatus.REQUESTED, None, None, 25),
        ]

        for mat, qty, unit, status, supplier, start_off, exp_off in supply_data:
            o = SupplyOrder(
                object_id=OBJ_ID,
                material_name=mat,
                quantity=qty,
                unit=unit,
                status=status,
                supplier=supplier,
                expected_date=date.today() + timedelta(days=exp_off),
                actual_date=date.today() + timedelta(days=exp_off - 2) if status == SupplyStatus.DELIVERED else None,
                delivery_location="Площадка ММДЦ",
                created_by_id=USER_ID,
                created_at=NOW + timedelta(days=start_off) if start_off else NOW,
            )
            db.add(o)

        # ══════════════════════════════════════════════
        # CONSTRUCTION STAGES (8 этапов с чек-листами)
        # ══════════════════════════════════════════════
        stages_data = [
            ("Подготовка площадки", 10, ConstructionStageStatus.ACCEPTED, [
                "Ограждение зоны работ", "Установка бытовок", "Подключение электричества", "Инструктаж ОТ",
            ]),
            ("Монтаж лесов/подмостей", 20, ConstructionStageStatus.ACCEPTED, [
                "Сборка лесов фасад 1", "Сборка лесов фасад 3", "Проверка устойчивости", "Акт приёмки лесов",
            ]),
            ("Геодезическая разбивка", 30, ConstructionStageStatus.IN_PROGRESS, [
                "Разбивка осей фасад 1", "Разбивка осей фасад 2", "Разбивка осей фасад 3", "Контрольная съёмка",
            ]),
            ("Бурение отверстий", 40, ConstructionStageStatus.IN_PROGRESS, [
                "Бурение Ø12 этажи 1-5", "Бурение Ø12 этажи 6-10", "Бурение Ø16 этажи 1-5",
                "Бурение Ø16 этажи 6-10", "Продувка отверстий", "Контроль глубины",
            ]),
            ("Монтаж кронштейнов", 50, ConstructionStageStatus.PENDING, [
                "Несущие кронштейны этажи 1-3", "Несущие кронштейны этажи 4-6",
                "Ветровые кронштейны этажи 1-3", "Геодезическая съёмка кронштейнов",
                "Сдача кронштейнов Технадзору",
            ]),
            ("Утепление", 60, ConstructionStageStatus.PENDING, [
                "Монтаж утеплителя слой 1", "Монтаж утеплителя слой 2",
                "Монтаж ветрозащитной мембраны", "Контроль толщины",
            ]),
            ("Монтаж подсистемы и облицовки", 70, ConstructionStageStatus.PENDING, [
                "Монтаж направляющих", "Монтаж облицовочных панелей фасад 1",
                "Монтаж облицовочных панелей фасад 3", "Монтаж доборных элементов",
            ]),
            ("Монтаж СПК", 80, ConstructionStageStatus.PENDING, [
                "Монтаж модулей СПК", "Устройство уплотнителя",
                "Герметизация швов", "Финальная проверка герметичности",
            ]),
        ]

        for name, sort, status, checklist_titles in stages_data:
            stage = ConstructionStage(
                object_id=OBJ_ID,
                name=name,
                sort_order=sort,
                status=status,
                started_at=NOW - timedelta(days=20) if status != ConstructionStageStatus.PENDING else None,
                completed_at=NOW - timedelta(days=5) if status == ConstructionStageStatus.ACCEPTED else None,
            )
            db.add(stage)
            await db.flush()

            for i, ct in enumerate(checklist_titles):
                is_done = status == ConstructionStageStatus.ACCEPTED or (
                    status == ConstructionStageStatus.IN_PROGRESS and i < len(checklist_titles) // 2
                )
                ci = ChecklistItem(
                    stage_id=stage.id,
                    title=ct,
                    is_done=is_done,
                    done_by_id=USER_ID if is_done else None,
                    done_at=NOW - timedelta(days=3) if is_done else None,
                    sort_order=(i + 1) * 10,
                )
                db.add(ci)

        # ══════════════════════════════════════════════
        # DOCUMENTS (12 документов)
        # ══════════════════════════════════════════════
        docs_data = [
            ("пто", "АОСР №1 — Подготовка площадки", 1),
            ("пто", "АОСР №2 — Монтаж лесов", 1),
            ("проектный", "ОПР фасады 1-3 (ревизия 2)", 2),
            ("проектный", "КМ кронштейны v1.1", 1),
            ("проектный", "КМД модули СПК (черновик)", 1),
            ("снабжение", "Спецификация материалов", 1),
            ("снабжение", "ТТН — алюминиевый профиль", 1),
            ("геодезия", "Исполнительная схема осей фасад 1", 1),
            ("от", "Журнал инструктажа ОТ", 1),
            ("от", "Допуск бригады №3", 1),
            ("фотофиксация", "Фото: монтаж лесов фасад 1", 1),
            ("фотофиксация", "Фото: бурение этажи 1-3", 1),
        ]

        for doc_type, title, version in docs_data:
            d = Document(
                object_id=OBJ_ID,
                doc_type=doc_type,
                title=title,
                version=version,
                uploaded_by_id=USER_ID,
                created_at=NOW - timedelta(days=15 - docs_data.index((doc_type, title, version))),
            )
            db.add(d)

        # ══════════════════════════════════════════════
        # NOTIFICATIONS (8 уведомлений)
        # ══════════════════════════════════════════════
        notifs_data = [
            ("task_assigned", "🔧 Новая задача", "КМД модули СПК блок Б — назначена вам", "task", False),
            ("task_overdue", "🔴 Просрочена задача", "Геодезическая разбивка фасад 2 — дедлайн истёк", "task", False),
            ("gpr_sign_request", "📋 Подпишите ГПР", "ГПР v1 ожидает вашей подписи", "gpr", False),
            ("supply_delayed", "⚠️ Задержка поставки", "Анкера Hilti HKD-S M12 — задержка 3 дня", "supply", False),
            ("supply_shipped", "🚛 Отгрузка", "Стеклопакеты Guardian — отгружены со склада", "supply", True),
            ("stage_completed", "🏗 Этап завершён", "Монтаж лесов/подмостей — принят Технадзором", "stage", True),
            ("general", "ℹ️ Обновление системы", "Добавлены новые виды работ в справочник", None, True),
            ("defect_reported", "🔴 Обнаружен дефект", "Трещина в анкерном отверстии, этаж 3, ось Б-4", "stage", False),
        ]

        for ntype, title, text, etype, is_read in notifs_data:
            n = Notification(
                user_id=USER_ID,
                type=ntype,
                title=title,
                text=text,
                entity_type=etype,
                entity_id=OBJ_ID,
                is_read=is_read,
                created_at=NOW - timedelta(hours=notifs_data.index((ntype, title, text, etype, is_read)) * 3),
            )
            db.add(n)

        await db.commit()
        print("✅ Seeded: 15 tasks, 10 supply orders, 8 stages + checklists, 12 documents, 8 notifications")


if __name__ == "__main__":
    asyncio.run(seed())
