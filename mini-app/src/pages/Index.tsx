import { useState, useEffect, lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import TopBar from "@/components/TopBar";
import TabBar from "@/components/TabBar";
import OfflineBar from "@/components/OfflineBar";

import { useOfflineCache } from "@/hooks/useOfflineCache";

// ── Lazy-loaded компоненты ────────────────────────────────
const DashboardRouter = lazy(() => import("@/components/DashboardRouter"));
const Floors = lazy(() => import("@/components/Floors"));
const PlanFact = lazy(() => import("@/components/PlanFact"));
const Crew = lazy(() => import("@/components/Crew"));
const SupplyDashboard = lazy(() => import("@/components/SupplyDashboard"));
const GPR = lazy(() => import("@/components/GPR"));
const Alerts = lazy(() => import("@/components/Alerts"));
const ProjectList = lazy(() => import("@/components/ProjectList"));
const ProjectCard = lazy(() => import("@/components/ProjectCard"));
const CreateProjectWizard = lazy(() => import("@/components/CreateProjectWizard"));
const SheetsSync = lazy(() => import("@/components/SheetsSync"));
const Documents = lazy(() => import("@/components/Documents"));
const Workflow = lazy(() => import("@/components/Workflow"));
const AIAssistant = lazy(() => import("@/components/AIAssistant"));
const ProjectCalendar = lazy(() => import("@/components/ProjectCalendar"));
const DirectorDashboard = lazy(() => import("@/components/DirectorDashboard"));
const GamificationPanel = lazy(() => import("@/components/GamificationPanel"));
const ForemenAI = lazy(() => import("@/components/ForemenAI"));
const ReportPDF = lazy(() => import("@/components/ReportPDF"));
const InstallPWA = lazy(() => import("@/components/InstallPWA"));
const DailyLogs = lazy(() => import("@/components/DailyLogs"));
const Approvals = lazy(() => import("@/components/Approvals"));
const TelegramSettings = lazy(() => import("@/components/TelegramSettings"));
const ProfilePage = lazy(() => import("@/components/ProfilePage"));
const TeamPage = lazy(() => import("@/components/TeamPage"));
const ProjectMenu = lazy(() => import("@/components/ProjectMenu"));
const ChatsPage = lazy(() => import("@/components/ChatsPage"));
const AIChatPage = lazy(() => import("@/components/AIChatPage"));

// ── Типы ─────────────────────────────────────────────────
type Screen = "projects" | "create" | "project" | "director";

const FOREMAN_TABS = ["foreman1", "foreman2", "foreman3"];

const LazyFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const Index = () => {
  const { user, loading, roles, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("dash");
  const [screen, setScreen] = useState<Screen>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Проект");
  const [showGamification, setShowGamification] = useState(false);
  const [alertsCount] = useState(0);
  const { cacheProjectData } = useOfflineCache();

  const isDirector = roles.includes("director");
  const isForeman = roles.some((r) => FOREMAN_TABS.includes(r));
  const userRole = roles[0] || "user";

  useEffect(() => {
    if (selectedProjectId && screen === "project") {
      cacheProjectData(Number(selectedProjectId));
    }
  }, [selectedProjectId, screen]);

  // ── Загрузка ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div className="text-t2 text-[11px]">Загрузка STSphera…</div>
        </div>
      </div>
    );
  }

  // ── Не авторизован ───────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <span className="text-primary font-bold text-lg">S</span>
          </div>
          <h1 className="text-xl font-bold">STSphera</h1>
          <p className="text-[13px] text-[hsl(var(--t2))]">
            Откройте приложение через Telegram бот
          </p>
          <p className="text-[11px] text-[hsl(var(--t3))]">
            @Smrbotai_bot → кнопка «STSphera»
          </p>
        </div>
      </div>
    );
  }

  // ── Экран директора — портфель всех проектов ─────────────
  if (screen === "director" || (isDirector && screen === "projects")) {
    return (
      <div className="min-h-screen bg-background relative">
        <OfflineBar />
        <Suspense fallback={<LazyFallback />}>
        <DirectorDashboard
          onOpenProject={(id) => {
            setSelectedProjectId(id);
            setActiveTab("dash");
            setScreen("project");
          }}
        />
        <button
          onClick={() => setShowGamification(true)}
          className="fixed bottom-6 right-4 z-[100] w-11 h-11 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-lg shadow-lg hover:scale-110 transition-transform"
          title="Мой рейтинг"
        >
          🏆
        </button>
        {showGamification && user && (
          <div className="fixed inset-0 z-[200] bg-background animate-fade-in overflow-auto">
            <div className="sticky top-0 z-10 bg-[hsl(var(--bg0)/0.9)] backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-[14px]">🏆 Геймификация</span>
              <button onClick={() => setShowGamification(false)} className="text-t2 text-[11px] hover:text-t1">Закрыть</button>
            </div>
            <GamificationPanel userId={String(user.id)} projectId={selectedProjectId || ""} userRole={userRole} />
          </div>
        )}
        </Suspense>
      </div>
    );
  }

  // ── Список проектов ──────────────────────────────────────
  if (screen === "projects") {
    return (
      <div className="relative">
        <OfflineBar />
        <Suspense fallback={<LazyFallback />}>
        <ProjectList
          onSelectProject={(id, name) => {
            setSelectedProjectId(id);
            setProjectName(name || "Проект");
            setActiveTab("dash");
            setScreen("project");
          }}
          onCreateNew={() => setScreen("create")}
        />
        </Suspense>
      </div>
    );
  }

  // ── Создание проекта ──────────────────────────────────────
  if (screen === "create") {
    return (
      <Suspense fallback={<LazyFallback />}>
      <CreateProjectWizard
        onBack={() => setScreen("projects")}
        onCreated={(id, name) => {
          setSelectedProjectId(id);
          setProjectName(name || "Проект");
          setActiveTab("dash");
          setScreen("project");
        }}
      />
      </Suspense>
    );
  }

  // ── Экран проекта ─────────────────────────────────────────
  const pid = selectedProjectId!;

  const renderTab = () => {
    switch (activeTab) {
      case "card":    return <ProjectCard projectId={pid} onBack={() => setScreen("projects")} />;
      case "dash":    return <DashboardRouter projectId={pid} />;
      case "floors":  return <Floors projectId={pid} />;
      case "pf":      return <PlanFact projectId={pid} />;
      case "crew":    return <Crew projectId={pid} />;
      case "sup":     return <SupplyDashboard projectId={pid} />;
      case "cal":     return <ProjectCalendar projectId={pid} />;
      case "gpr":     return <GPR projectId={pid} />;
      case "alerts":  return <Alerts projectId={pid} />;
      case "logs":    return <DailyLogs projectId={pid} userRole={userRole} />;
      case "appr":    return <Approvals projectId={pid} userRole={userRole} />;
      case "wflow":   return <Workflow />;
      case "sheets":  return <SheetsSync />;
      case "docs":    return <Documents projectId={pid} projectName={projectName} />;
      case "ai":      return <ForemenAI projectId={pid} projectName={projectName} userRole={userRole} />;
      case "report":  return <ReportPDF projectId={pid} projectName={projectName} />;
      case "xp":      return user ? (
        <GamificationPanel userId={String(user.id)} projectId={pid} userRole={userRole} />
      ) : null;
      case "settings": return <TelegramSettings />;
      case "profile":  return <ProfilePage projectId={pid} />;
      case "team":     return <TeamPage projectId={pid} />;
      case "menu":     return <ProjectMenu projectId={pid} projectName={projectName} userRole={userRole} onTabChange={setActiveTab} onBackToProjects={() => setScreen(isDirector ? "director" : "projects")} />;
      case "chats":    return <ChatsPage projectId={pid} />;
      case "ai-chat":  return <AIChatPage projectId={pid} projectName={projectName} userRole={userRole} onBack={() => setActiveTab("menu")} />;
      default:        return <DashboardRouter projectId={pid} />;
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <OfflineBar projectId={pid} />

      <TopBar
        projectName={projectName}
        projectId={pid}
        onBackToProjects={() => setScreen(isDirector ? "director" : "projects")}
        extraActions={[
          { icon: "📄", label: "Отчёт", onClick: () => setActiveTab("report") },
          { icon: "🏆", label: "XP", onClick: () => setActiveTab("xp") },
        ]}
      />

      <div className="animate-fade-in pb-[72px]">
        <ErrorBoundary>
          <Suspense fallback={<LazyFallback />}>
          {renderTab()}
          </Suspense>
        </ErrorBoundary>
      </div>

      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showProjectCard
        userRoles={roles}
        alertsCount={alertsCount}
        extraTabs={isForeman ? [{ id: "ai", label: "ИИ", icon: "🤖" }] : []}
      />

      {!isForeman && (
        <Suspense fallback={null}>
        <AIAssistant projectId={pid} projectName={projectName} userRole={userRole} />
        </Suspense>
      )}

      <Suspense fallback={null}>
      <InstallPWA />
      </Suspense>
    </div>
  );
};

export default Index;
