import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { detectPrimaryRole } from "@/lib/detectPrimaryRole";
import {
  Camera, FileText, Layers, AlertTriangle, CheckCircle, Calendar,
  Users, Package, FolderOpen, Briefcase, BarChart3, DollarSign,
  AlertOctagon, ShoppingCart, Truck, PenTool, Calculator, GitBranch,
  Table, ClipboardCheck, Book, Bot, Settings, ChevronRight, Plus,
  Building2, MessageCircle
} from "lucide-react";

interface ProjectMenuProps {
  projectId: string;
  projectName: string;
  userRole: string;
  onTabChange: (tab: string) => void;
  onBackToProjects?: () => void;
}

interface ToolItem {
  id: string;
  tab: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  badgeKey?: string;
}

const ROLE_TOOLS: Record<string, ToolItem[]> = {
  foreman: [
    { id: "photo", tab: "logs", icon: Camera, label: "Фотоотчёт", desc: "Загрузить фото с объекта" },
    { id: "daily", tab: "logs", icon: FileText, label: "Дневной отчёт", desc: "Отчёт за смену" },
    { id: "floors", tab: "floors", icon: Layers, label: "Мои этажи", desc: "Прогресс по этажам" },
    { id: "alerts", tab: "alerts", icon: AlertTriangle, label: "Алерты", desc: "Проблемы и замечания", badgeKey: "alerts" },
  ],
  pm: [
    { id: "appr", tab: "appr", icon: CheckCircle, label: "Согласования", desc: "Документы на подпись", badgeKey: "approvals" },
    { id: "gpr", tab: "gpr", icon: Calendar, label: "ГПР", desc: "График производства работ" },
    { id: "crew", tab: "crew", icon: Users, label: "Бригады", desc: "Управление бригадами" },
    { id: "sup", tab: "sup", icon: Package, label: "Снабжение", desc: "Заказы и поставки" },
    { id: "docs", tab: "docs", icon: FolderOpen, label: "Документы", desc: "Проектная документация" },
  ],
  director: [
    { id: "portfolio", tab: "dash", icon: Briefcase, label: "Портфель", desc: "Все объекты" },
    { id: "kpi", tab: "pf", icon: BarChart3, label: "KPI", desc: "Показатели эффективности" },
    { id: "finance", tab: "sup", icon: DollarSign, label: "Финансы", desc: "Бюджет и затраты" },
    { id: "critical", tab: "alerts", icon: AlertOctagon, label: "Критичное", desc: "Требует внимания", badgeKey: "alerts" },
  ],
  supply: [
    { id: "orders", tab: "sup", icon: ShoppingCart, label: "Заказы", desc: "Активные заказы" },
    { id: "deficit", tab: "sup", icon: AlertTriangle, label: "Дефицит", desc: "Нехватка материалов", badgeKey: "deficit" },
    { id: "suppliers", tab: "sup", icon: Truck, label: "Поставщики", desc: "База поставщиков" },
    { id: "docs", tab: "docs", icon: FileText, label: "Документы", desc: "Накладные и счета" },
  ],
  pto: [
    { id: "drawings", tab: "docs", icon: PenTool, label: "Чертежи", desc: "Проектная документация" },
    { id: "volumes", tab: "pf", icon: Calculator, label: "Объёмы", desc: "Ведомости объёмов" },
    { id: "changes", tab: "wflow", icon: GitBranch, label: "Изменения", desc: "Журнал изменений" },
    { id: "sheets", tab: "sheets", icon: Table, label: "Sheets", desc: "Таблицы и расчёты" },
  ],
  inspector: [
    { id: "checks", tab: "floors", icon: ClipboardCheck, label: "Проверки", desc: "Акты осмотра" },
    { id: "remarks", tab: "alerts", icon: AlertTriangle, label: "Замечания", desc: "Предписания", badgeKey: "alerts" },
    { id: "journal", tab: "logs", icon: Book, label: "Журнал", desc: "Журнал работ" },
    { id: "photos", tab: "logs", icon: Camera, label: "Фото", desc: "Фотофиксация" },
  ],
};

interface TeamMemberAvatar {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  last_active_at: string | null;
}

const ProjectMenu = ({ projectId, projectName, userRole, onTabChange, onBackToProjects }: ProjectMenuProps) => {
  const { roles } = useAuth();
  const [project, setProject] = useState<{ cover_image_url: string | null; city: string | null; status: string; work_type: string } | null>(null);
  const [teamAvatars, setTeamAvatars] = useState<TeamMemberAvatar[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [progressPct, setProgressPct] = useState(0);

  const primaryRole = detectPrimaryRole(roles);

  useEffect(() => {
    loadProject();
    loadTeamAvatars();
    loadBadges();
  }, [projectId]);

  const loadProject = async () => {
    const { data } = await supabase
      .from("projects")
      .select("cover_image_url, city, status, work_type")
      .eq("id", projectId)
      .single();
    if (data) setProject(data);

    // Progress from floors
    const { data: facades } = await supabase.from("facades").select("id").eq("project_id", projectId);
    if (facades && facades.length > 0) {
      const { data: floors } = await supabase
        .from("floors")
        .select("modules_plan, modules_fact")
        .in("facade_id", facades.map((f) => f.id));
      if (floors) {
        const plan = floors.reduce((s, f) => s + Number(f.modules_plan), 0);
        const fact = floors.reduce((s, f) => s + Number(f.modules_fact), 0);
        setProgressPct(plan > 0 ? Math.round((fact / plan) * 100) : 0);
      }
    }
  };

  const loadTeamAvatars = async () => {
    const { data: rolesData } = await supabase.from("user_roles").select("user_id");
    if (!rolesData) return;
    const userIds = [...new Set(rolesData.map((r) => r.user_id))];
    setTeamCount(userIds.length);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, last_active_at")
      .in("user_id", userIds.slice(0, 10));

    if (profiles) setTeamAvatars(profiles);
  };

  const loadBadges = async () => {
    const [alertsRes, approvalsRes, deficitRes] = await Promise.all([
      supabase.from("alerts").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("is_resolved", false),
      supabase.from("approvals").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending"),
      supabase.from("materials").select("id", { count: "exact", head: true }).eq("project_id", projectId).gt("deficit", 0),
    ]);
    setBadges({
      alerts: alertsRes.count || 0,
      approvals: approvalsRes.count || 0,
      deficit: deficitRes.count || 0,
    });
  };

  // Determine which tools to show
  const getToolsForRole = (): ToolItem[] => {
    if (["foreman1", "foreman2", "foreman3"].includes(primaryRole)) return ROLE_TOOLS.foreman;
    if (ROLE_TOOLS[primaryRole]) return ROLE_TOOLS[primaryRole];
    return ROLE_TOOLS.pm; // fallback
  };

  const tools = getToolsForRole();

  const isOnline = (lastActive: string | null) => {
    if (!lastActive) return false;
    return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
  };

  const statusLabels: Record<string, string> = {
    draft: "Черновик",
    active: "В работе",
    paused: "Приостановлен",
    completed: "Завершён",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-[hsl(var(--blue-dim))] text-[hsl(var(--blue))]",
    active: "bg-[hsl(var(--green-dim))] text-primary",
    paused: "bg-[hsl(var(--amber-dim))] text-[hsl(var(--amber))]",
    completed: "bg-[hsl(var(--blue-dim))] text-[hsl(var(--blue))]",
  };

  const GENERAL_ITEMS = [
    { tab: "chats", icon: MessageCircle, label: "Обсуждения", desc: "Telegram-чаты проекта" },
    { tab: "cal", icon: Calendar, label: "Календарь", desc: "События и дедлайны" },
    { tab: "docs", icon: FolderOpen, label: "Документы", desc: "Все документы проекта" },
    { tab: "ai-chat", icon: Bot, label: "AI-помощник", desc: "Спросить AI" },
    { tab: "settings", icon: Settings, label: "Настройки", desc: "Настройки проекта" },
  ];

  return (
    <div className="animate-fade-in pb-8">
      {/* Hero header */}
      <div className="h-[120px] relative rounded-b-2xl overflow-hidden mb-4">
        {project?.cover_image_url ? (
          <img
            src={project.cover_image_url}
            alt={projectName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--bg2))] to-[hsl(var(--bg3))] flex items-center justify-center">
            <Building2 size={40} className="text-t3 opacity-[0.15]" />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, hsl(var(--bg0)) 0%, hsl(var(--bg0) / 0.7) 40%, transparent 70%)" }}
        />
        <div className="absolute bottom-0 left-0 right-0 p-4 z-[2]">
          <h2
            className="text-[18px] font-bold text-white leading-tight"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
          >
            {projectName}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            {project?.city && <span className="text-[12px] text-white/70">{project.city}</span>}
            {project?.status && (
              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium ${statusColors[project.status] || statusColors.draft}`}>
                {statusLabels[project.status] || project.status}
              </span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[hsl(var(--bg3))] z-[3]">
          <div className="h-full bg-primary rounded-r-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="px-3 space-y-4">
        {/* Team section */}
        <div>
          <div className="section-label">Команда</div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {teamAvatars.map((m) => {
              const initials = m.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <button
                  key={m.user_id}
                  onClick={() => onTabChange("team")}
                  className="relative flex-shrink-0 active:scale-[0.95] transition-transform"
                >
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.display_name} className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-bg2 flex items-center justify-center text-[10px] font-bold text-t2">
                      {initials}
                    </div>
                  )}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${isOnline(m.last_active_at) ? "bg-[hsl(var(--green))] animate-pulse-dot" : "bg-bg3"}`} />
                </button>
              );
            })}
            <button
              onClick={() => onTabChange("team")}
              className="w-10 h-10 rounded-xl bg-bg2 flex items-center justify-center text-t3 flex-shrink-0 active:scale-[0.95] transition-transform"
            >
              <Plus size={16} />
            </button>
          </div>
          <button onClick={() => onTabChange("team")} className="text-[11px] text-t3 mt-1 active:text-t1">
            {teamCount} участников
          </button>
        </div>

        {/* Tools section */}
        <div>
          <div className="section-label">Инструменты</div>
          <div className="grid grid-cols-2 gap-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const badgeCount = tool.badgeKey ? badges[tool.badgeKey] || 0 : 0;
              return (
                <button
                  key={tool.id}
                  onClick={() => onTabChange(tool.tab)}
                  className="relative bg-bg1 rounded-xl p-3 min-h-[80px] text-left active:scale-[0.97] transition-transform"
                >
                  {/* LED left strip when badge > 0 */}
                  {badgeCount > 0 && (
                    <div className="absolute top-2 left-0 bottom-2 w-[2px] rounded-full bg-destructive shadow-[0_0_6px_hsl(var(--red-glow))]" />
                  )}
                  <Icon size={20} className="text-t3 mb-2" />
                  <div className="text-[13px] font-medium text-t1">{tool.label}</div>
                  <div className="text-[10px] text-t3 mt-0.5">{tool.desc}</div>
                  {/* Badge */}
                  {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] text-white font-bold flex items-center justify-center px-1">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* General section */}
        <div>
          <div className="section-label">Общее</div>
          <div className="space-y-2">
            {GENERAL_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.tab}
                  onClick={() => onTabChange(item.tab)}
                  className="w-full flex items-center gap-3 p-3 bg-bg1 rounded-xl active:scale-[0.98] transition-transform"
                >
                  <Icon size={20} className="text-t3 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="text-[14px] text-t1">{item.label}</div>
                    <div className="text-[10px] text-t3">{item.desc}</div>
                  </div>
                  <ChevronRight size={16} className="text-t3 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectMenu;
