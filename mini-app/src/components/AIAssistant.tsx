import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIAssistantProps {
  projectId: string;
  projectName: string;
  userRole?: string;
}

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  { label: "📊 Статус объекта", msg: "Какой статус по объекту сейчас?" },
  { label: "🔴 Отставания", msg: "Где самые критичные отставания?" },
  { label: "✅ Задачи на сегодня", msg: "Что нужно сделать сегодня?" },
  { label: "📦 Материалы", msg: "Хватит ли материалов до конца недели?" },
  { label: "📋 Сводка", msg: "Напиши сводку для директора" },
  { label: "⚠️ Риски", msg: "Какие риски на следующей неделе?" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const AIAssistant = ({ projectId, projectName, userRole }: AIAssistantProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          projectId,
          projectName,
          userRole: userRole || "user",
        }),
      });

      if (!resp.ok || !resp.body) {
        const errText = resp.status === 429
          ? "Слишком много запросов. Попробуйте позже."
          : resp.status === 402
          ? "Лимит запросов исчерпан."
          : "Ошибка AI. Попробуйте позже.";
        setMessages(prev => [...prev, { role: "assistant", content: errText }]);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        const content = assistantSoFar;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: "assistant", content }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("AI chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "Ошибка соединения. Попробуйте позже." }]);
    }
    setIsLoading(false);
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[150] w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-500 border-none cursor-pointer flex items-center justify-center text-xl shadow-lg shadow-primary/40 transition-transform hover:scale-110"
        style={{ display: open ? "none" : "flex" }}
      >
        🤖
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-[300] flex flex-col bg-background">
          {/* Header */}
          <div className="bg-background/95 backdrop-blur-xl border-b border-border px-3.5 py-2.5 flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-base relative flex-shrink-0">
              🤖
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-bold">STSphera AI</div>
              <div className="text-[9px] text-primary font-mono">Ассистент · {projectName}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full bg-bg2 border border-border text-t2 flex items-center justify-center cursor-pointer hover:text-t1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Context bar */}
          <div className="px-3 py-1.5 bg-primary/8 border-b border-primary/15 text-[9px] text-primary font-mono flex-shrink-0">
            📍 {projectName} · {userRole || "user"}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            {messages.length === 0 && (
              <div className="text-center text-t3 text-[11px] mt-8">
                Задайте вопрос об объекте или выберите быстрое действие ниже
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 self-end ${
                    msg.role === "user"
                      ? "bg-bg3"
                      : "bg-primary/10 border border-primary/30"
                  }`}
                >
                  {msg.role === "user" ? "👤" : "🤖"}
                </div>
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-primary to-blue-500 text-primary-foreground rounded-br-sm font-medium"
                      : "bg-bg2 border border-border text-foreground rounded-bl-sm"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-1 px-3 py-2 items-center">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="px-3 py-2 flex gap-1.5 overflow-x-auto scrollbar-none flex-shrink-0 border-t border-border">
            {QUICK_ACTIONS.map(qa => (
              <button
                key={qa.msg}
                onClick={() => sendMessage(qa.msg)}
                className="flex-shrink-0 px-2.5 py-1 rounded-xl bg-bg2 border border-border text-t2 text-[10px] cursor-pointer whitespace-nowrap hover:border-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
              >
                {qa.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2 px-3 py-2.5 bg-background/95 backdrop-blur-xl border-t border-border flex-shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Спросите об объекте..."
              rows={1}
              className="flex-1 bg-bg2 border border-border rounded-2xl px-3.5 py-2 text-foreground text-[12px] outline-none resize-none max-h-[90px] leading-relaxed focus:border-primary/30"
              style={{ height: "auto" }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 90) + "px";
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-blue-500 border-none cursor-pointer flex items-center justify-center text-base flex-shrink-0 self-end transition-opacity disabled:opacity-40 disabled:cursor-default"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
