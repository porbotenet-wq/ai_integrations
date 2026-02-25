"""
API Integration Tests — проверка ключевых endpoints
Run: docker exec gpr_bot-api-1 python3 -m pytest tests/test_api.py -v
Or:  docker exec gpr_bot-api-1 python3 tests/test_api.py
"""
import asyncio
import sys

BASE = "http://localhost:8000"
PASSED = 0
FAILED = 0
ERRORS = []


async def run_tests():
    global PASSED, FAILED
    import aiohttp

    async with aiohttp.ClientSession() as s:
        # ── Health ──
        await check(s, "GET", "/health", 200, lambda d: d["status"] == "ok")

        # ── Dashboard ──
        await check(s, "GET", "/api/dashboard", 200, lambda d: d["active_objects"] >= 0 and "production" in d)

        # ── Objects ──
        await check(s, "GET", "/api/objects?dev_user_id=8059235604", 200, lambda d: isinstance(d, list))

        # ── Object detail ──
        await check(s, "GET", "/api/objects/2?dev_user_id=8059235604", 200, lambda d: d["id"] == 2)

        # ── Tasks ──
        await check(s, "GET", "/api/objects/2/tasks", 200, lambda d: isinstance(d, list) and len(d) > 0)

        # ── Supply (needs auth) ──
        await check(s, "GET", "/api/objects/2/supply?dev_user_id=8059235604", 200, lambda d: isinstance(d, list) and len(d) > 0)

        # ── Construction ──
        await check(s, "GET", "/api/objects/2/construction", 200, lambda d: isinstance(d, list) and len(d) > 0)

        # ── Documents (needs auth) ──
        await check(s, "GET", "/api/objects/2/documents?dev_user_id=8059235604", 200, lambda d: isinstance(d, list) and len(d) > 0)

        # ── Notifications ──
        await check(s, "GET", "/api/notifications?dev_user_id=8059235604", 200, lambda d: isinstance(d, list))

        # ── Notification summary ──
        await check(s, "GET", "/api/notifications/summary?dev_user_id=8059235604", 200, lambda d: isinstance(d, dict))

        # ── Profile ──
        await check(s, "GET", "/api/profile?dev_user_id=8059235604", 200, lambda d: "full_name" in d)

        # ── GPR ──
        await check(s, "GET", "/api/gpr/2", 200, lambda d: "items" in d or "id" in d)

        # ── Production dashboard ──
        await check(s, "GET", "/api/production/2/dashboard", 200, lambda d: "total_modules" in d)

        # ── Production chain: zones ──
        await check(s, "GET", "/api/production-chain/2/zones", 200, lambda d: isinstance(d, list) and len(d) > 0)

        # ── Production chain: materials ──
        await check(s, "GET", "/api/production-chain/2/materials", 200, lambda d: isinstance(d, list) and len(d) > 0)

        # ── Production chain: warehouse ──
        await check(s, "GET", "/api/production-chain/2/warehouse", 200, lambda d: "summary" in d)

        # ── Production chain: shipments ──
        await check(s, "GET", "/api/production-chain/2/shipments", 200, lambda d: isinstance(d, list))

        # ── Production chain: element-status ──
        await check(s, "GET", "/api/production-chain/2/element-status", 200, lambda d: "stages" in d and "summary" in d)

        # ── Production chain: production-plan ──
        await check(s, "GET", "/api/production-chain/2/production-plan", 200, lambda d: "workshops" in d)

        # ── Production chain: chats ──
        await check(s, "GET", "/api/production-chain/2/chats", 200, lambda d: isinstance(d, list))

        # ── Org structure ──
        await check(s, "GET", "/api/org-structure?dev_user_id=8059235604", 200, lambda d: isinstance(d, (list, dict)))

        # ── Production work-types ──
        await check(s, "GET", "/api/production/work-types", 200, lambda d: isinstance(d, list))

        # ── Production crews ──
        await check(s, "GET", "/api/production/crews", 200, lambda d: isinstance(d, list))

    # Summary
    total = PASSED + FAILED
    print(f"\n{'='*40}")
    print(f"Results: {PASSED}/{total} passed, {FAILED} failed")
    if ERRORS:
        print(f"\nFailures:")
        for e in ERRORS:
            print(f"  ❌ {e}")
    print(f"{'='*40}")
    return FAILED == 0


async def check(session, method, path, expected_code, validator=None):
    global PASSED, FAILED, ERRORS
    url = f"{BASE}{path}"
    name = f"{method} {path.split('?')[0]}"
    try:
        async with session.request(method, url) as resp:
            code = resp.status
            if code != expected_code:
                FAILED += 1
                ERRORS.append(f"{name}: expected {expected_code}, got {code}")
                print(f"  ❌ {name} — {code}")
                return

            if validator:
                data = await resp.json()
                if not validator(data):
                    FAILED += 1
                    ERRORS.append(f"{name}: validation failed")
                    print(f"  ❌ {name} — validation failed")
                    return

            PASSED += 1
            print(f"  ✅ {name}")
    except Exception as e:
        FAILED += 1
        ERRORS.append(f"{name}: {e}")
        print(f"  ❌ {name} — {e}")


if __name__ == "__main__":
    ok = asyncio.run(run_tests())
    sys.exit(0 if ok else 1)
