import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "STSphera_bot";

interface TelegramProfile {
  telegram_chat_id: string | null;
  telegram_username: string | null;
}

const TelegramSettings = () => {
  const { user, displayName, roles } = useAuth();

  const [profile, setProfile] = useState<TelegramProfile | null>(null);
  const [chatIdInput, setChatIdInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [step, setStep] = useState<"idle" | "enter_id" | "linked">("idle");

  useEffect(() => { if (user) loadProfile(); }, [user]);

  async function loadProfile() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("telegram_chat_id, telegram_username")
      .eq("user_id", user!.id)
      .maybeSingle();
    setProfile(data || { telegram_chat_id: null, telegram_username: null });
    setStep(data?.telegram_chat_id ? "linked" : "idle");
    setLoading(false);
  }

  async function handleLink() {
    const trimmed = chatIdInput.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      toast.error("Chat ID — только цифры, например: 123456789");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ telegram_chat_id: trimmed })
      .eq("user_id", user!.id);

    if (error) {
      toast.error(error.code === "23505"
        ? "Этот Telegram уже привязан к другому аккаунту"
        : "Ошибка: " + error.message
      );
    } else {
      toast.success("Telegram привязан ✅");
      await loadProfile();
    }
    setSaving(false);
  }

  async function handleUnlink() {
    if (!confirm("Отвязать Telegram от аккаунта?")) return;
    setUnlinking(true);
    const { error } = await supabase
      .from("profiles")
      .update({ telegram_chat_id: null, telegram_username: null })
      .eq("user_id", user!.id);

    if (error) {
      toast.error("Ошибка: " + error.message);
    } else {
      toast.success("Telegram отвязан");
      setProfile({ telegram_chat_id: null, telegram_username: null });
      setStep("idle");
      setChatIdInput("");
    }
    setUnlinking(false);
  }

  const roleLabel: Record<string, string> = {
    director: "👔 Директор", pm: "👷 РП",
    foreman1: "🏗️ Прораб", foreman2: "🏗️ Прораб", foreman3: "🏗️ Прораб",
    supply: "📦 Снабжение", pto: "📋 ПТО",
  };

  const notifs: Record<string, string[]> = {
    director: ["📊 Утренний дайджест 08:00 МСК", "🔔 Алерты критического приоритета", "📋 Итоги недели по пятницам", "📦 Дефицит материалов"],
    pm:       ["📋 Отчёты прорабов", "🔔 Все алерты проекта", "📦 Дефицит материалов", "⚠️ Алерты >24ч без ответа"],
    foreman:  ["⏰ Напоминание об отчёте в 17:00", "🔔 Критические алерты"],
  };

  const myNotifs = roles.includes("director") ? notifs.director
    : roles.includes("pm") ? notifs.pm
    : roles.some(r => r.startsWith("foreman")) ? notifs.foreman
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="ml-2 text-xs text-muted-foreground">Загрузка…</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">

      {/* Профиль */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          👤 Профиль
        </h3>
        {[
          ["Имя", displayName],
          ["Email", user?.email ?? "—"],
          ["Роль", roleLabel[roles[0]] ?? roles[0] ?? "—"],
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground font-medium">{val}</span>
          </div>
        ))}
      </div>

      {/* Telegram */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          ✈️ Telegram Bot
        </h3>

        {/* === ПРИВЯЗАН === */}
        {step === "linked" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Telegram привязан
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  Chat ID: {profile?.telegram_chat_id}
                </p>
              </div>
            </div>

            {myNotifs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Вы получаете уведомления:
                </p>
                {myNotifs.map(n => (
                  <p key={n} className="text-xs text-foreground pl-1">{n}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <a
                href={`https://t.me/${BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                ✈️ Открыть бота
              </a>
              <button
                onClick={handleUnlink}
                disabled={unlinking}
                className="px-4 py-2.5 rounded-lg border border-border text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                {unlinking ? "..." : "Отвязать"}
              </button>
            </div>
          </div>
        )}

        {/* === НЕ ПРИВЯЗАН === */}
        {step === "idle" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📵</span>
              <div>
                <p className="text-sm font-semibold text-foreground">Telegram не привязан</p>
                <p className="text-xs text-muted-foreground">
                  Привяжите аккаунт для получения уведомлений
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { n: "1", text: <>Откройте бота <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">@{BOT_USERNAME}</a> и отправьте /start</> },
                { n: "2", text: <>Скопируйте ваш Chat ID из ответа</> },
                { n: "3", text: <>Вставьте его ниже и нажмите «Привязать»</> },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                    {n}
                  </span>
                  <p className="text-xs text-foreground">{text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep("enter_id")}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              ✈️ Привязать Telegram
            </button>
          </div>
        )}

        {/* === ВВОД ID === */}
        {step === "enter_id" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Напишите боту{" "}
              <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                @{BOT_USERNAME}
              </a>{" "}
              команду /start и скопируйте Chat ID из ответа.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Ваш Chat ID
              </label>
              <input
                type="text"
                placeholder="123456789"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value.replace(/\D/g, ""))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleLink}
                disabled={saving || !chatIdInput.trim()}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Сохраняем..." : "✅ Привязать"}
              </button>
              <button
                onClick={() => { setStep("idle"); setChatIdInput(""); }}
                className="px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelegramSettings;
