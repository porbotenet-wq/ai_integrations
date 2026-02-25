"""
seed_production_chain.py — Demo data for zones, BOM, materials, warehouse, shipments
Run: docker exec gpr_bot-api-1 python3 seed_production_chain.py
"""
import asyncio
from datetime import date, datetime, timedelta
from bot.db.session import async_session, init_db
from bot.db.models import Zone, BOMItem, Material, Warehouse, Shipment

OBJ_ID = 2
NOW = datetime.utcnow()


async def seed():
    await init_db()
    async with async_session() as db:
        from sqlalchemy import select, func
        zc = (await db.execute(select(func.count(Zone.id)).where(Zone.object_id == OBJ_ID))).scalar()
        if zc > 0:
            print(f"Already seeded ({zc} zones). Skipping.")
            return

        print("Seeding production chain...")

        # ── ZONES (6 зон фасада) ──
        zones = []
        zones_data = [
            ("Фасад 1 — этажи 1-5", "1-5 / А-Г", "НВФ", 885, 1, -10, 20),
            ("Фасад 1 — этажи 6-10", "6-10 / А-Г", "НВФ", 720, 2, 5, 35),
            ("Фасад 2 — витражи", "1-3 / Д-Е", "СПК", 12, 3, 0, 30),
            ("Фасад 3 — этажи 1-5", "1-5 / Ж-К", "НВФ", 824, 1, -5, 25),
            ("Фасад 3 — этажи 6-10", "6-10 / Ж-К", "НВФ", 564, 2, 10, 40),
            ("Парапет", "кровля", "НВФ", 120, 4, 15, 45),
        ]
        for name, axis, stype, vol, prio, start_off, deliv_off in zones_data:
            z = Zone(
                object_id=OBJ_ID, name=name, floor_axis=axis,
                system_type=stype, volume=vol, priority=prio,
                production_start_date=date.today() + timedelta(days=start_off),
                delivery_date=date.today() + timedelta(days=deliv_off),
            )
            db.add(z)
            zones.append(z)
        await db.flush()

        # ── BOM ITEMS (per zone) ──
        bom_templates = {
            "НВФ": [
                ("КРН-Н-{z}", "bracket", "Сталь 09Г2С", 120, 2.4, "completed"),
                ("КРН-В-{z}", "bracket", "Сталь 09Г2С", 80, 1.8, "in_production"),
                ("НПР-{z}", "profile", "Алюминий 6063-Т6", 200, 1.2, "in_production"),
                ("ПНЛ-{z}", "panel", "Алюкобонд RAL 7016", 150, 3.5, "approved"),
                ("УТП-{z}", "insulation", "Rockwool 100мм", 300, 0.8, "approved"),
                ("АНК-{z}", "anchor", "Fischer FZA 12/30", 240, 0.3, "draft"),
            ],
            "СПК": [
                ("МОД-{z}", "module", "Алюминий + стеклопакет", 12, 45.0, "in_production"),
                ("УПЛ-{z}", "seal", "EPDM Deventer", 50, 0.2, "approved"),
                ("ГРМ-{z}", "sealant", "Sika SG-20", 24, 0.5, "draft"),
            ],
        }

        all_bom = []
        for i, z in enumerate(zones):
            stype = zones_data[i][2]
            templates = bom_templates.get(stype, bom_templates["НВФ"])
            for mark_tpl, itype, material, qty, weight, status in templates:
                mark = mark_tpl.format(z=i + 1)
                bom = BOMItem(
                    zone_id=z.id, mark=mark, item_type=itype,
                    material=material, quantity=qty, weight=weight,
                    status=status,
                )
                db.add(bom)
                all_bom.append((bom, status))
        await db.flush()

        # ── WAREHOUSE (for completed/in_production items) ──
        for bom, status in all_bom:
            if status in ("completed", "in_production"):
                produced = bom.quantity if status == "completed" else int(bom.quantity * 0.6)
                shipped = int(produced * 0.3) if status == "completed" else 0
                wh = Warehouse(
                    bom_item_id=bom.id,
                    produced_qty=produced,
                    shipped_qty=shipped,
                    remaining=produced - shipped,
                    ready_date=date.today() + timedelta(days=3) if status == "completed" else None,
                    ready_to_ship=status == "completed",
                )
                db.add(wh)

        # ── MATERIALS (10 позиций) ──
        materials_data = [
            ("ALU-6063", "Алюминиевый профиль 6063-Т6", "metal", "п.м.", 4800, 4800, 2400, 1200, 0),
            ("STL-09G2S", "Сталь 09Г2С (кронштейны)", "metal", "кг", 8500, 8500, 3200, 2800, 0),
            ("GLS-SGD", "Стеклопакет Guardian SunGuard", "glass", "шт", 885, 500, 120, 0, 385),
            ("RW-100", "Rockwool Фасад Баттс 100мм", "insulation", "м²", 6400, 6400, 3200, 0, 0),
            ("FZA-12", "Fischer FZA 12/30", "fastener", "шт", 9996, 5000, 5000, 0, 4996),
            ("ALK-7016", "Алюкобонд RAL 7016", "panel", "шт", 2400, 1200, 600, 0, 1200),
            ("EPDM-D", "Уплотнитель EPDM Deventer", "seal", "п.м.", 2000, 800, 800, 0, 1200),
            ("SIKA-20", "Герметик Sika SG-20", "sealant", "шт", 480, 0, 0, 0, 480),
            ("HKD-M12", "Анкер Hilti HKD-S M12", "fastener", "шт", 4998, 4998, 2000, 0, 0),
            ("KRS-NVF", "Подсистема Краспан (направляющие)", "profile", "шт", 1600, 800, 400, 0, 800),
        ]
        for code, name, mtype, unit, demand, purchased, stock, in_prod, deficit in materials_data:
            m = Material(
                code=code, name=name, type=mtype, unit=unit,
                object_demand=demand, purchased=purchased,
                in_stock=stock, in_production=in_prod, deficit=deficit,
            )
            db.add(m)

        # ── SHIPMENTS (3 отгрузки) ──
        shipments_data = [
            ("SHP-001", zones[0].id, -5, "Кронштейны несущие — 120 шт, ветровые — 80 шт", 200, "МАЗ 6430 А8-312"),
            ("SHP-002", zones[0].id, -2, "Направляющие — 100 шт, панели — 50 шт", 150, "КАМАЗ 65117"),
            ("SHP-003", zones[3].id, 0, "Кронштейны несущие — 120 шт", 120, "ГАЗон NEXT"),
        ]
        for batch, zid, day_off, items_list, qty, vehicle in shipments_data:
            s = Shipment(
                batch_number=batch, object_id=OBJ_ID, zone_id=zid,
                ship_date=date.today() + timedelta(days=day_off),
                items_list=items_list, quantity=qty, vehicle=vehicle,
            )
            db.add(s)

        await db.commit()
        print(f"✅ Seeded: {len(zones)} zones, {len(all_bom)} BOM items, "
              f"{len(materials_data)} materials, {len(shipments_data)} shipments + warehouse")


if __name__ == "__main__":
    asyncio.run(seed())
