import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Phone, Mail, Send, X, Camera } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProfileData {
  display_name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  avatar_url: string | null;
  telegram_username: string | null;
  telegram_chat_id: string | null;
  created_at: string;
}

interface ProfileProject {
  id: string;
  name: string;
  city: string | null;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  director:   { bg: "bg-[hsl(180_60%_40%/0.12)]", text: "text-[hsl(180_80%_55%)]", label: "Директор" },
  pm:         { bg: "bg-[hsl(218_60%_62%/0.12)]", text: "text-[hsl(218_92%_62%)]", label: "РП" },
  opr:        { bg: "bg-[hsl(218_60%_62%/0.12)]", text: "text-[hsl(218_92%_62%)]", label: "ОПР" },
  km:         { bg: "bg-[hsl(218_60%_62%/0.12)]", text: "text-[hsl(218_92%_62%)]", label: "КМ" },
  kmd:        { bg: "bg-[hsl(218_60%_62%/0.12)]", text: "text-[hsl(218_92%_62%)]", label: "КМД" },
  supply:     { bg: "bg-[hsl(var(--amber-dim))]", text: "text-[hsl(var(--amber))]", label: "Снабжение" },
  production: { bg: "bg-[hsl(var(--amber-dim))]", text: "text-[hsl(var(--amber))]", label: "Производство" },
  foreman1:   { bg: "bg-[hsl(var(--green-dim))]", text: "text-primary", label: "Прораб 1" },
  foreman2:   { bg: "bg-[hsl(var(--green-dim))]", text: "text-primary", label: "Прораб 2" },
  foreman3:   { bg: "bg-[hsl(var(--green-dim))]", text: "text-primary", label: "Прораб 3" },
  pto:        { bg: "bg-[hsl(280_60%_55%/0.12)]", text: "text-[hsl(280_70%_65%)]", label: "ПТО" },
  inspector:  { bg: "bg-[hsl(var(--red-dim))]", text: "text-destructive", label: "Технадзор" },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role] || { bg: "bg-bg2", text: "text-t2", label: role };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

interface ProfilePageProps {
  projectId?: string;
}

const ProfilePage = ({ projectId }: ProfilePageProps) => {
  const { user, roles, displayName } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [projects, setProjects] = useState<ProfileProject[]>([]);
  const [stats, setStats] = useState({ days: 0, logs: 0, photos: 0 });
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadProfile();
    loadProjects();
    loadStats();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, phone, email, position, avatar_url, telegram_username, telegram_chat_id, created_at")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setProfile(data);
      setEditName(data.display_name || "");
      setEditPhone(data.phone || "");
      setEditEmail(data.email || "");
      setEditPosition(data.position || "");
    }
    setLoading(false);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name, city")
      .order("created_at", { ascending: false });
    if (data) setProjects(data);
  };

  const loadStats = async () => {
    if (!user) return;
    const { count: logsCount } = await supabase
      .from("daily_logs")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by", user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("user_id", user.id)
      .single();

    const days = profile
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
      : 0;

    setStats({ days, logs: logsCount || 0, photos: 0 });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editName.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        position: editPosition.trim() || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      toast.success("Профиль обновлён");
      setEditOpen(false);
      loadProfile();
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadErr) {
      toast.error("Ошибка загрузки");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("user_id", user.id);
    setUploading(false);
    toast.success("Аватар обновлён");
    loadProfile();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const initials = profile.display_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const primaryRole = roles[0] || "user";

  return (
    <div className="p-3 pb-8 animate-fade-in space-y-5">
      {/* Header */}
      <div className="relative flex items-start gap-4 p-4 bg-bg1 rounded-2xl">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-[72px] h-[72px] rounded-2xl object-cover border border-primary/20"
            />
          ) : (
            <div className="w-[72px] h-[72px] rounded-2xl bg-bg2 border border-primary/20 flex items-center justify-center text-[24px] font-bold text-t2">
              {initials}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-[18px] font-bold text-t1 truncate">{profile.display_name}</h2>
          {profile.position && (
            <div className="text-[12px] text-t2">{profile.position}</div>
          )}
          <RoleBadge role={primaryRole} />
        </div>

        {/* Edit button */}
        <button
          onClick={() => setEditOpen(true)}
          className="absolute top-3 right-3 w-9 h-9 bg-bg2 rounded-xl flex items-center justify-center text-t2 hover:text-t1 transition-colors active:scale-[0.95]"
        >
          <Pencil size={14} />
        </button>
      </div>

      {/* Contacts */}
      <div>
        <div className="section-label">Контакты</div>
        <div className="space-y-2">
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="flex items-center gap-3 p-3 bg-bg1 rounded-xl active:scale-[0.98] transition-transform">
              <Phone size={16} className="text-t3 flex-shrink-0" />
              <span className="text-[14px] text-t1">{profile.phone}</span>
            </a>
          )}
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="flex items-center gap-3 p-3 bg-bg1 rounded-xl active:scale-[0.98] transition-transform">
              <Mail size={16} className="text-t3 flex-shrink-0" />
              <span className="text-[14px] text-t1">{profile.email}</span>
            </a>
          )}
          {profile.telegram_username && (
            <a href={`tg://resolve?domain=${profile.telegram_username.replace("@", "")}`} className="flex items-center gap-3 p-3 bg-bg1 rounded-xl active:scale-[0.98] transition-transform">
              <Send size={16} className="text-t3 flex-shrink-0" />
              <span className="text-[14px] text-t1">@{profile.telegram_username.replace("@", "")}</span>
            </a>
          )}
          {!profile.phone && !profile.email && !profile.telegram_username && (
            <div className="text-[12px] text-t3 py-2">Контакты не указаны</div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div>
        <div className="section-label">Статистика</div>
        <div className="flex gap-2">
          {[
            { num: stats.days, label: "Дней" },
            { num: stats.logs, label: "Отчётов" },
            { num: stats.photos, label: "Фото" },
          ].map((s) => (
            <div key={s.label} className="flex-1 bg-bg1 rounded-xl p-3 text-center">
              <div className="num text-[20px] font-bold text-t1">{s.num}</div>
              <div className="text-[10px] text-t3">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My projects */}
      <div>
        <div className="section-label">Мои объекты</div>
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="p-3 bg-bg1 rounded-xl">
              <div className="text-[14px] font-medium text-t1">{p.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={primaryRole} />
                {p.city && <span className="text-[11px] text-t3">{p.city}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="bg-background border-border rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-[16px] font-bold text-t1">Редактировать профиль</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4 pb-6">
            {/* Avatar upload */}
            <div className="flex items-center gap-3">
              <div className="relative">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-bg2 flex items-center justify-center text-[20px] font-bold text-t2">
                    {initials}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-lg flex items-center justify-center cursor-pointer active:scale-[0.95]">
                  <Camera size={14} className="text-primary-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              <div className="text-[12px] text-t3">
                {uploading ? "Загрузка..." : "Нажмите чтобы сменить фото"}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-t3 mb-1 block">ФИО</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-bg1 border-border" />
              </div>
              <div>
                <label className="text-[11px] text-t3 mb-1 block">Телефон</label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+7 999 123-45-67" className="bg-bg1 border-border" />
              </div>
              <div>
                <label className="text-[11px] text-t3 mb-1 block">Email</label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="name@company.ru" className="bg-bg1 border-border" />
              </div>
              <div>
                <label className="text-[11px] text-t3 mb-1 block">Должность</label>
                <Input value={editPosition} onChange={(e) => setEditPosition(e.target.value)} placeholder="Прораб" className="bg-bg1 border-border" />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !editName.trim()}
              className="w-full rounded-xl py-3"
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export { RoleBadge, ROLE_COLORS };
export default ProfilePage;
