import { useState } from "react";
import { useProfile } from "@/shared/api";
import { ProfileMainTab } from "./ProfileMainTab";
import { ProfileTasksTab } from "./ProfileTasksTab";
import { ProfileActivityTab } from "./ProfileActivityTab";
import { ProfileSettingsTab } from "./ProfileSettingsTab";

type Tab = "main" | "tasks" | "activity" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "main", label: "Профиль" },
  { id: "tasks", label: "Задачи" },
  { id: "activity", label: "Активность" },
  { id: "settings", label: "Настройки" },
];

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const [activeTab, setActiveTab] = useState<Tab>("main");

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-tg-button border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-4 pb-2 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-tg-button text-tg-button-text"
                : "bg-tg-section-bg text-tg-hint"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-2">
        {activeTab === "main" && <ProfileMainTab profile={profile} />}
        {activeTab === "tasks" && <ProfileTasksTab />}
        {activeTab === "activity" && <ProfileActivityTab />}
        {activeTab === "settings" && <ProfileSettingsTab settings={{}} />}
      </div>
    </div>
  );
}
