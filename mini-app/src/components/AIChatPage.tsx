import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Plus, Bot, SendHorizontal, Trash2, ExternalLink, Search,
} from "lucide-react";
import { format } from "date-fns";

interface AIChatPageProps {
  projectId: string;
  projectName: string;
  userRole: string;
  onBack?: () => void;
}

type ChatMode = "project" | "norms" | "all";
type Msg = { id?: string; role: "user" | "assistant"; content: string; created_at?: string; citations?: Citation[] };
type Conv = { id: string; title: string; updated_at: string; preview?: string };
type Citation = { document_code: string; section?: string; document_id?: string; source_url?: string };

const PROJECT_QUICK = [
  "Статус объекта",
  "Открытые алерты",
  "Прогресс монтажа",
  "Дефицит материалов",
];

const NORM_QUICK = [
  { icon: "📐", label: "Требования к НВФ", prompt: "Какие основные требования ГОСТ и СП к навесным вентилируемым фасадам?" },
  { icon: "🔩", label: "Крепёж СПК", prompt: "Требования к крепежу светопрозрачных конструкций по ГОСТ" },
  { icon: "🧱", label: "Огнестойкость", prompt: "Требования пожарной безопасности для фасадных систем" },
  { icon: "📏", label: "Допуски монтажа", prompt: "Допустимые отклонения при монтаже НВФ по СП и ГОСТ" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const MODE_LABELS: Record<ChatMode, { icon: string; label: string }> = {
  project: { icon: "🏗️", label: "Проект" },
  norms: { icon: "📐", label: "Нормативка" },
  all: { icon: "🔄", label: "Всё" },
};

const AIChatPage = ({ projectId, projectName, userRole, onBack }: AIChatPageProps) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingNorms, setIsSearchingNorms] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const [mode, setMode] = useState<ChatMode>("all");
  const [hasNormDocs, setHasNormDocs] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadConversations(); checkNormDocs(); }, [projectId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (view === "chat") inputRef.current?.focus(); }, [view]);

  const checkNormDocs = async () => {
    const { count } = await supabase
      .from("norm_documents" as any)
      .select("id", { count: "exact", head: true });
    setHasNormDocs((count ?? 0) > 0);
  };

  const loadConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_conversations")
      .select("id, title, updated_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (!data) return;

    const convs: Conv[] = [];
    for (const c of data.slice(0, 20)) {
      const { data: msgs } = await supabase
        .from("ai_messages")
        .select("content")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);
      convs.push({ ...c, preview: msgs?.[0]?.content?.slice(0, 60) || "" });
    }
    setConversations(convs);
  };

  const openConversation = async (convId: string) => {
    setActiveConvId(convId);
    const { data } = await supabase
      .from("ai_messages")
      .select("id, role, content, created_at, citations")
      .eq("conversation_id", convId)
      .order("created_at");
    setMessages(
      (data || [])
        .filter((m: any) => m.role !== "system")
        .map((m: any) => ({
          id: m.id, role: m.role as "user" | "assistant",
          content: m.content, created_at: m.created_at,
          citations: m.citations || [],
        }))
    );
    setView("chat");
  };

  const createNewConversation = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ project_id: projectId, user_id: user.id, title: "Новый диалог" })
      .select()
      .single();
    if (error || !data) return;
    setActiveConvId(data.id);
    setMessages([]);
    setView("chat");
  };

  const deleteConversation = async (convId: string) => {
    await supabase.from("ai_conversations").delete().eq("id", convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConvId === convId) {
      setActiveConvId(null);
      setMessages([]);
      setView("list");
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !user) return;
    let convId = activeConvId;

    if (!convId) {
      const { data } = await supabase
        .from("ai_conversations")
        .insert({ project_id: projectId, user_id: user.id, title: text.trim().slice(0, 40) })
        .select()
        .single();
      if (!data) return;
      convId = data.id;
      setActiveConvId(convId);
    }

    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setIsLoading(true);

    await supabase.from("ai_messages").insert({
      conversation_id: convId, role: "user", content: text.trim(), mode,
    });

    if (messages.length === 0) {
      await supabase.from("ai_conversations").update({ title: text.trim().slice(0, 40) }).eq("id", convId);
    }

    // Show norm search indicator
    if (mode === "norms" || mode === "all") {
      setIsSearchingNorms(true);
    }

    let assistantSoFar = "";
    let pendingCitations: Citation[] = [];

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
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
          projectId, projectName, userRole, mode,
        }),
      });

      setIsSearchingNorms(false);

      if (!resp.ok || !resp.body) {
        const errText = resp.status === 429
          ? "Слишком много запросов. Попробуйте позже."
          : resp.status === 402
            ? "Лимит запросов исчерпан."
            : "Ошибка AI. Попробуйте позже.";
        setMessages((prev) => [...prev, { role: "assistant", content: errText }]);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        const content = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.id) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content, citations: pendingCitations } : m));
          }
          return [...prev, { role: "assistant", content, citations: pendingCitations }];
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
            // Check for citations event
            if (parsed.citations) {
              pendingCitations = parsed.citations;
              continue;
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message with citations
      if (assistantSoFar && convId) {
        await supabase.from("ai_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantSoFar,
          mode,
          citations: pendingCitations,
        });
      }
    } catch (e) {
      console.error("AI chat error:", e);
      setIsSearchingNorms(false);
      setMessages((prev) => [...prev, { role: "assistant", content: "Ошибка соединения. Попробуйте позже." }]);
    }
    setIsLoading(false);
  };

  const renderCitations = (citations?: Citation[]) => {
    if (!citations?.length) return null;
    return (
      <div className="bg-[hsl(var(--bg2)/0.5)] rounded-xl p-3 mt-2 border border-[hsl(var(--border)/0.1)]">
        <div className="text-[11px] text-[hsl(var(--t3))] uppercase tracking-wider mb-2">📄 Источники</div>
        {citations.map((c, i) => (
          <div key={i} className={`${i > 0 ? "border-t border-[hsl(var(--border)/0.05)] pt-2 mt-2" : ""}`}>
            {c.source_url ? (
              <button
                onClick={() => window.open(c.source_url!, "_blank")}
                className="flex items-center gap-2 text-[13px] text-primary hover:underline w-full text-left"
              >
                <span className="font-mono text-[12px] text-primary/80">{c.document_code}</span>
                {c.section && <span className="text-[hsl(var(--t3))]">{c.section}</span>}
                <ExternalLink size={12} className="ml-auto flex-shrink-0 text-[hsl(var(--t3))]" />
              </button>
            ) : (
              <div className="flex items-center gap-2 text-[13px]">
                <span className="font-mono text-[12px] text-primary/80">{c.document_code}</span>
                {c.section && <span className="text-[hsl(var(--t3))]">{c.section}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ── Mode Switcher ──
  const renderModeSwitcher = () => (
    <div className="flex gap-1 bg-[hsl(var(--bg2))] rounded-xl p-1">
      {(Object.keys(MODE_LABELS) as ChatMode[]).map((m) => {
        const isDisabled = m === "norms" && hasNormDocs === false;
        return (
          <button
            key={m}
            onClick={() => !isDisabled && setMode(m)}
            disabled={isDisabled}
            className={`flex-1 h-8 rounded-lg text-[12px] transition-all duration-200 ${
              mode === m
                ? "bg-[hsl(var(--bg3,var(--bg1)))] text-[hsl(var(--t1))] font-medium"
                : isDisabled
                  ? "text-[hsl(var(--t3)/0.4)] cursor-not-allowed"
                  : "text-[hsl(var(--t3))] active:scale-[0.97]"
            }`}
          >
            {MODE_LABELS[m].icon} {MODE_LABELS[m].label}
          </button>
        );
      })}
    </div>
  );

  // ── Quick Questions ──
  const renderQuickQuestions = () => {
    const showProject = mode === "project" || mode === "all";
    const showNorms = (mode === "norms" || mode === "all") && hasNormDocs;

    return (
      <div className="text-center py-8 space-y-4">
        {showProject && (
          <div>
            <p className="text-[11px] text-[hsl(var(--t3))] uppercase tracking-wider mb-2">По проекту</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PROJECT_QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="bg-[hsl(var(--bg1))] rounded-xl px-3 py-2 text-[12px] text-[hsl(var(--t2))] active:scale-[0.97] transition-transform"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {showNorms && (
          <div>
            <p className="text-[11px] text-[hsl(var(--t3))] uppercase tracking-wider mb-2">По нормативке</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {NORM_QUICK.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendMessage(q.prompt)}
                  className="bg-[hsl(var(--bg1))] rounded-xl px-3 py-2 text-[12px] text-[hsl(var(--t2))] active:scale-[0.97] transition-transform"
                >
                  {q.icon} {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "norms" && !hasNormDocs && (
          <div className="py-4">
            <p className="text-[14px] text-[hsl(var(--t2))]">📚 Нормативная база загружается</p>
            <p className="text-[12px] text-[hsl(var(--t3))] mt-1">Скоро здесь появятся ГОСТы, СП и СНиП.</p>
          </div>
        )}
      </div>
    );
  };

  // ── Conversation list view ──
  if (view === "list") {
    return (
      <div className="animate-fade-in px-3 pt-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="w-9 h-9 rounded-xl bg-[hsl(var(--bg2))] flex items-center justify-center text-[hsl(var(--t2))]">
                <ArrowLeft size={18} />
              </button>
            )}
            <Bot size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-[hsl(var(--t1))]">AI-помощник</h2>
          </div>
          <button
            onClick={createNewConversation}
            className="w-9 h-9 rounded-xl bg-[hsl(var(--bg2))] flex items-center justify-center text-[hsl(var(--t2))] active:scale-[0.95] transition-transform"
          >
            <Plus size={18} />
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <Bot size={48} className="mx-auto text-[hsl(var(--t3)/0.2)] mb-3" />
            <p className="text-[14px] text-[hsl(var(--t2))] mb-1">Нет диалогов</p>
            <p className="text-[12px] text-[hsl(var(--t3))] mb-4">Задайте вопрос об объекте</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PROJECT_QUICK.map((q) => (
                <button
                  key={q}
                  onClick={async () => {
                    await createNewConversation();
                    setTimeout(() => sendMessage(q), 100);
                  }}
                  className="bg-[hsl(var(--bg1))] rounded-xl px-3 py-2 text-[12px] text-[hsl(var(--t2))] active:scale-[0.97] transition-transform"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div key={conv.id} className="flex items-center gap-3 p-3 bg-[hsl(var(--bg1))] rounded-xl active:scale-[0.98] transition-transform">
                <button className="flex-1 text-left min-w-0" onClick={() => openConversation(conv.id)}>
                  <div className="text-[14px] font-medium text-[hsl(var(--t1))] truncate">{conv.title}</div>
                  {conv.preview && <div className="text-[11px] text-[hsl(var(--t2))] truncate">{conv.preview}</div>}
                  <div className="text-[10px] text-[hsl(var(--t3))] mt-0.5">
                    {format(new Date(conv.updated_at), "dd.MM.yy HH:mm")}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="text-[hsl(var(--t3))] hover:text-destructive transition-colors flex-shrink-0 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Chat view ──
  return (
    <div className="flex flex-col h-[calc(100vh-130px)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
        <button
          onClick={() => { setView("list"); loadConversations(); }}
          className="w-9 h-9 rounded-xl bg-[hsl(var(--bg2))] flex items-center justify-center text-[hsl(var(--t2))]"
        >
          <ArrowLeft size={18} />
        </button>
        <Bot size={20} className="text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-[hsl(var(--t1))] truncate">AI-помощник</div>
          <div className="text-[9px] text-primary font-mono">{projectName}</div>
        </div>
        <button
          onClick={createNewConversation}
          className="w-9 h-9 rounded-xl bg-[hsl(var(--bg2))] flex items-center justify-center text-[hsl(var(--t2))]"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && renderQuickQuestions()}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
              <div
                className={`px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md font-medium"
                    : "bg-[hsl(var(--bg1))] text-[hsl(var(--t1))] rounded-2xl rounded-bl-md border border-border"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "assistant" && renderCitations(msg.citations)}
            </div>
          </div>
        ))}

        {/* Norm search indicator */}
        {isSearchingNorms && (
          <div className="flex items-center gap-2 px-4 py-2 text-[12px] text-[hsl(var(--t3))]">
            <Search size={14} className="animate-pulse" />
            <span className="animate-pulse">Ищу в нормативной базе...</span>
          </div>
        )}

        {isLoading && !isSearchingNorms && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-1 px-4 py-3 bg-[hsl(var(--bg1))] rounded-2xl rounded-bl-md w-fit border border-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mode Switcher + Input */}
      <div className="px-3 pt-2 pb-1 bg-[hsl(var(--bg0,var(--background)))] border-t border-border flex-shrink-0">
        {renderModeSwitcher()}
      </div>
      <div className="flex items-end gap-2 px-3 pb-3 bg-[hsl(var(--bg0,var(--background)))] flex-shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Спросите про объект..."
          rows={1}
          className="flex-1 bg-[hsl(var(--bg1))] border border-border rounded-xl px-4 py-3 text-foreground text-[14px] outline-none resize-none max-h-[100px] leading-relaxed focus:border-primary/30"
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 100) + "px";
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
        >
          <SendHorizontal size={18} className="text-primary-foreground" />
        </button>
      </div>
    </div>
  );
};

export default AIChatPage;
