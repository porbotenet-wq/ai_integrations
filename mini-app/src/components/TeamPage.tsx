import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RoleBadge, ROLE_COLORS } from "@/components/ProfilePage";

interface TeamMember {
  user_id: string;
  display_name: string;
  position: string | null;
  avatar_url: string | null;
  telegram_username: string | null;
  last_active_at: string | null;
  role: string;
}

const ROLE_GROUPS: { key: string; label: string; roles: string[] }[] = [
  { key: "management", label: "Руководство", roles: ["director", "pm"] },
  { key: "engineers", label: "Инженеры", roles: ["opr", "km", "kmd"] },
  { key: "foremen", label: "Прорабы", roles: ["foreman1", "foreman2", "foreman3"] },
  { key: "supply", label: "Снабжение", roles: ["supply", "production"] },
  { key: "pto", label: "ПТО", roles: ["pto"] },
  { key: "inspection", label: "Технадзор", roles: ["inspector"] },
];

interface TeamPageProps {
  projectId: string;
}

const TeamPage = ({ projectId }: TeamPageProps) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeam();
  }, [projectId]);

  const loadTeam = async () => {
    setLoading(true);
    // Get all user_roles, then fetch their profiles
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (!rolesData || rolesData.length === 0) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(rolesData.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, position, avatar_url, telegram_username, last_active_at")
      .in("user_id", userIds);

    if (!profiles) {
      setLoading(false);
      return;
    }

    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    const team: TeamMember[] = rolesData
      .map((r) => {
        const p = profileMap.get(r.user_id);
        if (!p) return null;
        return {
          user_id: r.user_id,
          display_name: p.display_name,
          position: p.position,
          avatar_url: p.avatar_url,
          telegram_username: p.telegram_username,
          last_active_at: p.last_active_at,
          role: r.role,
        };
      })
      .filter(Boolean) as TeamMember[];

    setMembers(team);
    setLoading(false);
  };

  const isOnline = (lastActive: string | null) => {
    if (!lastActive) return false;
    return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
  };

  const filtered = search.trim()
    ? members.filter((m) =>
        m.display_name.toLowerCase().includes(search.toLowerCase())
      )
    : members;

  const uniqueUsers = new Set(filtered.map((m) => m.user_id));

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 pb-8 animate-fade-in space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-t1">Команда</h2>
        <span className="text-[12px] text-t3">{uniqueUsers.size} участников</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-t3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени..."
          className="bg-bg1 border-border rounded-xl pl-9 text-[14px]"
        />
      </div>

      {/* Grouped list */}
      {ROLE_GROUPS.map((group) => {
        const groupMembers = filtered.filter((m) =>
          group.roles.includes(m.role)
        );
        if (groupMembers.length === 0) return null;

        // Deduplicate by user_id within group
        const seen = new Set<string>();
        const unique = groupMembers.filter((m) => {
          if (seen.has(m.user_id)) return false;
          seen.add(m.user_id);
          return true;
        });

        return (
          <div key={group.key}>
            <div className="section-label">{group.label}</div>
            <div className="space-y-2">
              {unique.map((m, i) => {
                const initials = m.display_name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const online = isOnline(m.last_active_at);

                return (
                  <div
                    key={`${m.user_id}-${m.role}-${i}`}
                    className="flex items-center gap-3 p-3 bg-bg1 rounded-xl stagger-item"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {/* Avatar with online dot */}
                    <div className="relative flex-shrink-0">
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt={m.display_name}
                          className="w-11 h-11 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-bg2 flex items-center justify-center text-[12px] font-bold text-t2">
                          {initials}
                        </div>
                      )}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg1 ${
                          online
                            ? "bg-[hsl(var(--green))] animate-pulse-dot"
                            : "bg-bg3"
                        }`}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-t1 truncate">
                        {m.display_name}
                      </div>
                      {m.position && (
                        <div className="text-[11px] text-t2 truncate">
                          {m.position}
                        </div>
                      )}
                    </div>

                    {/* Role badge + TG */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <RoleBadge role={m.role} />
                      {m.telegram_username && (
                        <a
                          href={`tg://resolve?domain=${m.telegram_username.replace("@", "")}`}
                          className="w-9 h-9 rounded-xl bg-bg2 flex items-center justify-center text-t3 hover:text-primary transition-colors active:scale-[0.95]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Send size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[13px] text-t3">
          Участники не найдены
        </div>
      )}
    </div>
  );
};

export default TeamPage;
