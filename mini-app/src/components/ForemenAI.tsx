import { useState, useRef, useEffect } from "react";
import { Send, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ForemenAIProps {
  projectId: string;
  projectName: string;
  userRole?: string;
}

type Msg = { role: "user" | "assistant"; content: string; ts?: string };

const QUICK_ACTIONS = [
  { icon: "📋", label: "Ежедневный отчёт", color: "text-primary", msg: "Помоги составить ежедневный отчёт о ходе работ на сегодня. Что мне нужно включить?" },
  { icon: "⚠️", label: "Зафиксировать проблему", color: "text-destructive", msg: "Хочу зафиксировать проблему на объекте. Помоги правильно описать её и определить приоритет." },
  { icon: "📏", label: "Норма выработки", color: "text-warning", msg: "Сколько должна выработать бригада из 4 человек за 8-часовой рабочий день при монтаже НВФ? Какие нормы?" },
  { icon: "🏗️", label: "Технология монтажа", color: "text-primary", msg: "Напомни порядок монтажа НВФ фасада: кронштейны, направляющие, утепление, облицовка. Основные правила и типичные ошибки." },
  { icon: "📦", label: "Расчёт материалов", color: "text-primary", msg: "Помоги рассчитать количество материалов для монтажа 100 м² керамогранита на НВФ. Что понадобится?" },
  { icon: "👷", label: "Инструктаж ТБ", color: "text-warning", msg: "Дай краткий инструктаж по технике безопасности при работе на фасаде на высоте. Основные требования." },
  { icon: "📸", label: "Фото-отчёт", color: "text-muted-foreground", msg: "Что именно нужно фотографировать при ведении фото-отчёта по монтажу фасада? Дай чеклист." },
  { icon: "🔧", label: "Неисправность", color: "text-destructive", msg: "На объекте неисправность инструмента или оборудования. Как правильно зафиксировать и что делать дальше?" },
];

async function fetchProjectContext(projectId: string): Promise<string> {
  try {
    const [alertsRes, crewsRes, materialsRes, pfRes] = await Promise.all([
      supabase.from("alerts").select("title,priority,is_resolved").eq("project_id", projectId).eq("is_resolved", false).limit(5),
      supabase.from("crews").select("name,headcount,specialization,is_active").eq("project_id", projectId).eq("is_active", true),
      supabase.from("materials").select("name,status,deficit,on_site,unit").eq("project_id", projectId).neq("status", "ok").limit(5),
      supabase.from("plan_fact").select("date,plan_value,fact_value,week_number").eq("project_id", projectId).order("date", { ascending: false }).limit(7),
    ]);

    const alerts = alertsRes.data || [];
    const crews = crewsRes.data || [];
    const materials = materialsRes.data || [];
    const planFact = pfRes.data || [];

    const todayFact = planFact[0]?.fact_value ?? 0;
    const todayPlan = planFact[0]?.plan_value ?? 0;
    const efficiency = todayPlan > 0 ? Math.round((Number(todayFact) / Number(todayPlan)) * 100) : 0;

    let ctx = `Данные объекта:\n`;
    ctx += `- Бригады: ${crews.map((c) => `${c.name} (${c.headcount} чел, ${c.specialization || "—"})`).join("; ") || "нет данных"}\n`;
    ctx += `- Сегодня план/факт: ${todayPlan}/${todayFact} (${efficiency}%)\n`;
    if (alerts.length > 0) {
      ctx += `- Открытые алерты: ${alerts.map((a) => `[${a.priority}] ${a.title}`).join("; ")}\n`;
    }
    if (materials.length > 0) {
      ctx += `- Проблемные материалы: ${materials.map((m) => `${m.name}: дефицит ${m.deficit} ${m.unit}`).join("; ")}\n`;
    }
    return ctx;
  } catch {
    return "Данные объекта недоступны (офлайн)";
  }
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const ForemenAI = ({ projectId, projectName, userRole = "foreman1" }: ForemenAIProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState("");
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchProjectContext(projectId).then(setContext);
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setShowQuick(false);

    const userMsg: Msg = { role: "user", content: text.trim(), ts: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsLoading(true);

    const systemPrompt = `Ты — ИИ-помощник прораба строительного объекта. Твоя задача: помогать прорабу оперативно решать задачи на объекте.

Данные объекта "${projectName}":
${context}

Роль пользователя: ${userRole}

Отвечай коротко, практично, на русском. Используй строительную терминологию.
Для отчётов — давай структуру. Для проблем — предлагай решения.
Не разводи философию — прораб занят, ему нужны конкретные ответы.`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          projectId,
          projectName,
          userRole,
          systemPrompt,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errMsg = resp.status === 429 ? "Слишком много запросов. Подождите." : resp.status === 402 ? "Требуется оплата AI." : "Ошибка ИИ. Попробуйте позже.";
        setMessages((p) => [...p, { role: "assistant", content: errMsg }]);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      const upsert = (chunk: string) => {
        accumulated += chunk;
        const content = accumulated;
        const ts = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: "assistant", content, ts }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            /* skip partial */
          }
        }
      }
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Ошибка соединения. Проверьте интернет." }]);
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border bg-muted/50 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-sm relative">
          🤖
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-background animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-bold text-foreground">ИИ-ассистент прораба</div>
          <div className="text-[9px] text-muted-foreground font-mono">{projectName} · {context ? "Данные загружены" : "Загрузка контекста…"}</div>
        </div>
        <button
          onClick={() => setShowQuick((s) => !s)}
          className="text-[9px] text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
        >
          Действия <ChevronDown size={10} className={`transition-transform ${showQuick ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Quick actions */}
      {showQuick && (
        <div className="px-3 py-2.5 border-b border-border bg-background/50 flex-shrink-0">
          <div className="text-[9px] text-muted-foreground font-semibold uppercase mb-2">Быстрые действия</div>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => sendMessage(a.msg)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-left hover:border-primary/30 hover:bg-accent transition-all"
              >
                <span className="text-sm">{a.icon}</span>
                <span className={`text-[9px] font-semibold ${a.color}`}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {messages.length === 0 && !showQuick && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🤖</div>
            <div className="text-[11px] text-muted-foreground font-semibold">Чем помочь, прораб?</div>
            <div className="text-[9px] text-muted-foreground mt-1">Задайте вопрос или выберите действие выше</div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5
                ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border border-border"}`}
            >
              {msg.role === "user" ? "👷" : "🤖"}
            </div>
            <div className={`max-w-[82%] flex flex-col ${msg.role === "user" ? "items-end" : ""}`}>
              <div
                className={`px-3 py-2 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap
                  ${msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted border border-border text-foreground rounded-tl-sm"
                  }`}
              >
                {msg.content}
              </div>
              {msg.ts && <div className="text-[8px] text-muted-foreground mt-0.5 px-1">{msg.ts}</div>}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-xs">🤖</div>
            <div className="px-3 py-2.5 rounded-xl bg-muted border border-border">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-border bg-muted/80 backdrop-blur flex items-end gap-2 flex-shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите прорабу-ИИ..."
          rows={1}
          className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-[11px] text-foreground outline-none focus:border-primary/50 resize-none min-h-[36px] max-h-[80px] transition-colors placeholder:text-muted-foreground"
          style={{ lineHeight: "1.4" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 80) + "px";
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
};

export default ForemenAI;
