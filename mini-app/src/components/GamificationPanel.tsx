import { useState, useEffect } from "react";
import { getUserXPData, getLeaderboard, LEVELS, BADGES, type getLevel } from "@/lib/gamification";
import { Loader2, Trophy, Star, Medal, TrendingUp } from "lucide-react";

interface GamificationPanelProps {
  userId: string;
  projectId: string;
  userRole: string;
}

const GamificationPanel = ({ userId, projectId, userRole }: GamificationPanelProps) => {
  const [xpData, setXpData] = useState<Awaited<ReturnType<typeof getUserXPData>> | null>(null);
  const [leaderboard, setLeaderboard] = useState<Awaited<ReturnType<typeof getLeaderboard>>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"my" | "board">("my");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [xp, lb] = await Promise.all([
        getUserXPData(userId, projectId),
        getLeaderboard(projectId, 15),
      ]);
      setXpData(xp);
      setLeaderboard(lb);
      setLoading(false);
    };
    load();
  }, [userId, projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <div className="text-[11px] text-muted-foreground">Загрузка рейтинга…</div>
      </div>
    );
  }

  if (!xpData) return null;

  const { level, totalXp, badges, actionCounts } = xpData;

  return (
    <div className="p-3 space-y-3 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-0.5">
        {[
          { id: "my" as const, label: "Мой профиль", icon: Star },
          { id: "board" as const, label: "Лидерборд", icon: Trophy },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-semibold transition-colors ${
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "my" ? (
        <>
          {/* Level Card */}
          <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-1">{level.emoji}</div>
            <div className="text-[18px] font-bold text-foreground">{level.title}</div>
            <div className="text-[10px] text-muted-foreground">Уровень {level.level}</div>
            <div className="text-[28px] font-bold text-primary mt-2">{totalXp} XP</div>
            {level.nextLevel && (
              <div className="mt-3">
                <div className="flex justify-between text-[8px] text-muted-foreground mb-1">
                  <span>{level.minXp} XP</span>
                  <span>{level.nextLevel.minXp} XP</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                    style={{ width: `${level.progress}%` }}
                  />
                </div>
                <div className="text-[9px] text-muted-foreground mt-1">
                  До «{level.nextLevel.title}» осталось {level.nextLevel.minXp - totalXp} XP
                </div>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">
              🏅 Достижения
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BADGES.map((badge) => {
                const earned = badges.some((b) => b.id === badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`text-center p-2 rounded-lg border transition-colors ${
                      earned
                        ? "bg-primary/10 border-primary/30"
                        : "bg-muted/50 border-border opacity-40"
                    }`}
                  >
                    <div className="text-xl mb-0.5">{badge.emoji}</div>
                    <div className="text-[8px] font-semibold text-foreground">{badge.name}</div>
                    <div className="text-[7px] text-muted-foreground mt-0.5">{badge.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Stats */}
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">
              📈 Активность
            </div>
            <div className="space-y-1.5">
              {Object.entries(actionCounts).map(([action, count]) => {
                const labels: Record<string, string> = {
                  daily_report: "📋 Отчёты",
                  photo_upload: "📸 Фото",
                  alert_created: "🚨 Алерты",
                  alert_resolved: "✅ Решено",
                  plan_fact_entry: "📊 План-факт",
                  task_completed: "✔️ Задачи",
                  document_upload: "📄 Документы",
                  login_streak: "🔥 Дни подряд",
                };
                return (
                  <div key={action} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-[10px] text-foreground">{labels[action] || action}</span>
                    <span className="text-[10px] font-bold text-primary">{count}</span>
                  </div>
                );
              })}
              {Object.keys(actionCounts).length === 0 && (
                <div className="text-center text-[10px] text-muted-foreground py-4">
                  Пока нет активности. Начните работу, чтобы получать XP!
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Leaderboard */
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">
            🏆 Рейтинг команды
          </div>
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-[10px] text-muted-foreground">
              Пока нет участников в рейтинге
            </div>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((entry) => {
                const isMe = entry.userId === userId;
                const rankEmoji = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `${entry.rank}`;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors ${
                      isMe ? "bg-primary/10 border-primary/30" : "border-border"
                    }`}
                  >
                    <span className="text-sm w-6 text-center font-bold">{rankEmoji}</span>
                    <div className="flex-1">
                      <div className={`text-[11px] font-semibold ${isMe ? "text-primary" : "text-foreground"}`}>
                        {entry.displayName} {isMe && "(вы)"}
                      </div>
                      <div className="text-[8px] text-muted-foreground">
                        {entry.level.emoji} {entry.level.title}
                      </div>
                    </div>
                    <div className="text-[12px] font-bold text-primary">{entry.xp} XP</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GamificationPanel;
