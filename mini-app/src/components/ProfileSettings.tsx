import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileSettings = ({ open, onOpenChange }: ProfileSettingsProps) => {
  const { user } = useAuth();
  const [chatId, setChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setInitialLoading(true);
    supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setChatId(data?.telegram_chat_id ?? "");
        setInitialLoading(false);
      });
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ telegram_chat_id: chatId.trim() || null })
      .eq("user_id", user.id);
    setLoading(false);

    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      toast.success("Telegram ID сохранён");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Настройки профиля</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Привяжите Telegram для получения уведомлений
          </DialogDescription>
        </DialogHeader>

        {initialLoading ? (
          <div className="text-xs text-muted-foreground animate-pulse py-4">Загрузка...</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                Telegram Chat ID
              </label>
              <Input
                placeholder="Например: 123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Отправьте <span className="font-mono text-primary">/start</span> боту{" "}
                <span className="font-mono text-primary">@STSpheraBot</span>, затем{" "}
                <span className="font-mono text-primary">/myid</span> — он пришлёт ваш Chat ID.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              size="sm"
              className="w-full"
            >
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettings;
