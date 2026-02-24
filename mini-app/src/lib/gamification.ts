import { supabase } from "@/integrations/supabase/client";

// ── XP rewards per action ──
export const XP_REWARDS: Record<string, number> = {
  daily_report: 15,
  photo_upload: 5,
  alert_created: 10,
  alert_resolved: 20,
  plan_fact_entry: 10,
  task_completed: 25,
  document_upload: 5,
  login_streak: 5,
  onboarding_passed: 50,
};

// ── Levels ──
export const LEVELS = [
  { level: 1, title: "Новичок", minXp: 0, emoji: "🟢" },
  { level: 2, title: "Стажёр", minXp: 50, emoji: "🔵" },
  { level: 3, title: "Специалист", minXp: 150, emoji: "🟣" },
  { level: 4, title: "Мастер", minXp: 400, emoji: "🟠" },
  { level: 5, title: "Эксперт", minXp: 800, emoji: "🔴" },
  { level: 6, title: "Легенда", minXp: 1500, emoji: "⭐" },
];

// ── Badges ──
export const BADGES = [
  { id: "first_report", name: "Первый отчёт", emoji: "📋", description: "Отправьте первый ежедневный отчёт", condition: (actions: Record<string, number>) => (actions.daily_report || 0) >= 1 },
  { id: "alert_hero", name: "Бдительный", emoji: "🚨", description: "Создайте 5 алертов", condition: (actions: Record<string, number>) => (actions.alert_created || 0) >= 5 },
  { id: "resolver", name: "Решала", emoji: "✅", description: "Закройте 10 алертов", condition: (actions: Record<string, number>) => (actions.alert_resolved || 0) >= 10 },
  { id: "photographer", name: "Фотограф", emoji: "📸", description: "Загрузите 20 фото", condition: (actions: Record<string, number>) => (actions.photo_upload || 0) >= 20 },
  { id: "streak_3", name: "3 дня подряд", emoji: "🔥", description: "Заходите 3 дня подряд", condition: (actions: Record<string, number>) => (actions.login_streak || 0) >= 3 },
  { id: "master", name: "Мастер данных", emoji: "📊", description: "30 записей план-факт", condition: (actions: Record<string, number>) => (actions.plan_fact_entry || 0) >= 30 },
];

export function getLevel(totalXp: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXp >= l.minXp) current = l;
    else break;
  }
  const nextLevel = LEVELS.find((l) => l.minXp > totalXp);
  const progress = nextLevel
    ? ((totalXp - current.minXp) / (nextLevel.minXp - current.minXp)) * 100
    : 100;
  return { ...current, totalXp, nextLevel, progress: Math.min(progress, 100) };
}

export function getEarnedBadges(actionCounts: Record<string, number>) {
  return BADGES.filter((b) => b.condition(actionCounts));
}

export async function awardXP(userId: string, projectId: string, action: string, metadata?: Record<string, unknown>) {
  const xp = XP_REWARDS[action] || 0;
  if (xp === 0) return null;

  const { data, error } = await supabase.from("user_xp").insert({
    user_id: userId,
    project_id: projectId,
    action,
    xp,
    metadata: metadata || {},
  } as any).select().single();

  if (error) {
    console.warn("XP award failed:", error.message);
    return null;
  }
  return data;
}

export async function getUserXPData(userId: string, projectId?: string) {
  let query = supabase.from("user_xp").select("*").eq("user_id", userId);
  if (projectId) query = query.eq("project_id", projectId);
  const { data } = await query;

  const events = (data as any[]) || [];
  const totalXp = events.reduce((s, e) => s + (e.xp || 0), 0);
  const actionCounts: Record<string, number> = {};
  events.forEach((e) => {
    actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
  });

  return { totalXp, actionCounts, events, level: getLevel(totalXp), badges: getEarnedBadges(actionCounts) };
}

export async function getLeaderboard(projectId?: string, limit = 10) {
  let query = supabase.from("user_xp").select("user_id, xp");
  if (projectId) query = query.eq("project_id", projectId);
  const { data } = await query;

  const events = (data as any[]) || [];
  const userMap = new Map<string, number>();
  events.forEach((e) => {
    userMap.set(e.user_id, (userMap.get(e.user_id) || 0) + (e.xp || 0));
  });

  const sorted = Array.from(userMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Fetch display names
  const userIds = sorted.map((s) => s[0]);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));

  return sorted.map(([userId, xp], i) => ({
    rank: i + 1,
    userId,
    displayName: profileMap.get(userId) || "Пользователь",
    xp,
    level: getLevel(xp),
  }));
}
