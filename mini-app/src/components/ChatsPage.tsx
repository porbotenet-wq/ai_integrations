import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle, CheckSquare, AlertTriangle, Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { format } from "date-fns";

interface Chat {
  id: string;
  name: string;
  telegram_link: string;
  chat_type: string;
  category: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number | null;
  reference_id: string | null;
}

const TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  general: { icon: MessageCircle, color: "text-[hsl(var(--blue))]" },
  task: { icon: CheckSquare, color: "text-primary" },
  alert: { icon: AlertTriangle, color: "text-destructive" },
};

const FILTERS = [
  { value: "all", label: "Все" },
  { value: "task", label: "Задачи" },
  { value: "alert", label: "Алерты" },
  { value: "general", label: "Общие" },
];

interface Props {
  projectId: string;
}

const ChatsPage = ({ projectId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newType, setNewType] = useState("general");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadChats();
  }, [projectId]);

  const loadChats = async () => {
    const { data } = await supabase
      .from("project_chats")
      .select("id, name, telegram_link, chat_type, category, last_message, last_message_at, unread_count, reference_id")
      .eq("project_id", projectId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    setChats((data as Chat[]) || []);
  };

  const filtered = filter === "all" ? chats : chats.filter((c) => c.chat_type === filter);

  const createChat = async () => {
    if (!newName.trim() || !newLink.trim() || !user) return;
    setCreating(true);
    const { error } = await supabase.from("project_chats").insert({
      project_id: projectId,
      name: newName.trim(),
      telegram_link: newLink.trim(),
      chat_type: newType,
      category: newType === "alert" ? "safety" : newType === "task" ? "construction" : "management",
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setNewName("");
      setNewLink("");
      setNewType("general");
      setShowCreate(false);
      loadChats();
    }
    setCreating(false);
  };

  const openChat = (chat: Chat) => {
    window.open(chat.telegram_link, "_blank");
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) return format(d, "HH:mm");
      return format(d, "dd.MM");
    } catch { return ""; }
  };

  return (
    <div className="animate-fade-in px-3 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[16px] font-bold text-t1">Обсуждения</h2>
          <span className="text-[12px] text-t3">{chats.length} чатов</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-bg1 text-t2"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Chat list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle size={48} className="mx-auto text-t3 opacity-20 mb-2" />
          <p className="text-[14px] text-t2">Нет обсуждений</p>
          <p className="text-[12px] text-t3 mt-1">Обсуждения создаются автоматически при работе с задачами</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((chat) => {
            const typeInfo = TYPE_ICONS[chat.chat_type] || TYPE_ICONS.general;
            const Icon = typeInfo.icon;
            const unread = chat.unread_count || 0;
            return (
              <button
                key={chat.id}
                onClick={() => openChat(chat)}
                className="w-full flex items-center gap-3 p-3 bg-bg1 rounded-xl active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-bg2 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className={typeInfo.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-t1 truncate">{chat.name}</div>
                  {chat.last_message && (
                    <div className="text-[11px] text-t2 truncate max-w-[200px]">{chat.last_message}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {chat.last_message_at && (
                    <span className="text-[10px] text-t3">{formatTime(chat.last_message_at)}</span>
                  )}
                  {unread > 0 && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-[10px] text-primary-foreground font-bold flex items-center justify-center px-1">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-4 z-[100] w-14 h-14 rounded-2xl bg-primary shadow-[0_0_16px_hsl(var(--green-glow))] flex items-center justify-center active:scale-[0.95] transition-transform"
      >
        <Plus size={24} className="text-primary-foreground" />
      </button>

      {/* Create sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="bg-bg0 border-border rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-[16px] text-t1">Новое обсуждение</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            {/* Type chips */}
            <div className="flex gap-2">
              {[
                { v: "general", l: "Общий" },
                { v: "task", l: "По задаче" },
                { v: "alert", l: "По алерту" },
              ].map((t) => (
                <button
                  key={t.v}
                  onClick={() => setNewType(t.v)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] ${
                    newType === t.v ? "bg-primary text-primary-foreground" : "bg-bg1 text-t2"
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>
            <input
              className="w-full bg-bg1 border border-border rounded-xl px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary/30"
              placeholder="Название чата..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="w-full bg-bg1 border border-border rounded-xl px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary/30"
              placeholder="https://t.me/..."
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
            />
            <Button
              className="w-full rounded-xl py-3"
              disabled={!newName.trim() || !newLink.trim() || creating}
              onClick={createChat}
            >
              {creating ? "Создание..." : "Создать обсуждение"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ChatsPage;
