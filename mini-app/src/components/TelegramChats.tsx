import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Send, Plus, ExternalLink, Trash2, MessageCircle } from "lucide-react";

interface Chat {
  id: string;
  name: string;
  telegram_link: string;
  category: string;
  sort_order: number;
}

const CATEGORIES = [
  { value: "design", label: "Проектирование", emoji: "📐" },
  { value: "production", label: "Производство", emoji: "🏭" },
  { value: "construction", label: "СМР Площадка", emoji: "🏗" },
  { value: "management", label: "Управленческий", emoji: "👔" },
  { value: "supply", label: "Снабжение", emoji: "📦" },
  { value: "safety", label: "ОТ и ТБ", emoji: "⛑" },
  { value: "other", label: "Другое", emoji: "💬" },
];

interface Props {
  projectId: string;
}

const TelegramChats = ({ projectId }: Props) => {
  const { roles } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newCategory, setNewCategory] = useState("construction");

  const canManage = roles.includes("pm") || roles.includes("director");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("project_chats")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      setChats((data as Chat[]) || []);
    };
    load();
  }, [projectId]);

  const addChat = async () => {
    if (!newName.trim() || !newLink.trim()) return;
    const { data, error } = await supabase
      .from("project_chats")
      .insert({
        project_id: projectId,
        name: newName.trim(),
        telegram_link: newLink.trim(),
        category: newCategory,
        sort_order: chats.length + 1,
      })
      .select()
      .single();
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setChats((prev) => [...prev, data as Chat]);
      setNewName("");
      setNewLink("");
      setAdding(false);
    }
  };

  const removeChat = async (id: string) => {
    await supabase.from("project_chats").delete().eq("id", id);
    setChats((prev) => prev.filter((c) => c.id !== id));
  };

  const getCategoryInfo = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative text-muted-foreground hover:text-primary transition-colors"
          title="Telegram чаты"
        >
          <Send className="h-4 w-4" />
          {chats.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[7px] font-bold rounded-full w-3 h-3 flex items-center justify-center">
              {chats.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 bg-bg1 border-border"
      >
        <div className="px-3 py-2 border-b border-border">
          <div className="text-[11px] font-bold uppercase tracking-wider text-t2 flex items-center gap-1.5">
            <Send className="h-3 w-3 text-primary" /> Telegram чаты
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {chats.length === 0 && !adding && (
            <div className="text-center py-6 px-3">
              <MessageCircle className="h-6 w-6 mx-auto text-t3 mb-1 opacity-40" />
              <p className="text-[10px] text-t3">Нет чатов</p>
            </div>
          )}

          {chats.map((chat) => {
            const cat = getCategoryInfo(chat.category);
            return (
              <div
                key={chat.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-bg2 transition-colors group"
              >
                <span className="text-sm shrink-0">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate">{chat.name}</div>
                  <div className="text-[9px] text-t3">{cat.label}</div>
                </div>
                <a
                  href={chat.telegram_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {canManage && (
                  <button
                    className="text-t3 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => removeChat(chat.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add form */}
          {adding && (
            <div className="px-3 py-2 border-t border-border space-y-2">
              <input
                autoFocus
                className="w-full bg-bg2 border border-border rounded-md px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                placeholder="Название чата..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="w-full bg-bg2 border border-border rounded-md px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                placeholder="https://t.me/..."
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
              />
              <select
                className="w-full bg-bg2 border border-border rounded-md px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-[10px] flex-1" onClick={addChat}>
                  Добавить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px]"
                  onClick={() => setAdding(false)}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>

        {canManage && !adding && (
          <div className="px-3 py-2 border-t border-border">
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-[10px] gap-1 text-t3"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3 w-3" /> Добавить чат
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default TelegramChats;
