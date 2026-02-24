import { useState } from "react";
import { useParams } from "react-router-dom";
import { useObject } from "@/shared/api";
import { GPRTab } from "@/features/gpr/GPRTab";
import { TasksTab } from "@/features/tasks/TasksTab";
import { OBJECT_STATUS_LABELS, statusColor } from "@/shared/lib/format";

type Tab = "gpr" | "tasks" | "construction" | "supply" | "docs";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "gpr", label: "ГПР", icon: "📋" },
  { id: "tasks", label: "Задачи", icon: "✅" },
  { id: "construction", label: "Монтаж", icon: "🏗" },
  { id: "supply", label: "Поставки", icon: "📦" },
  { id: "docs", label: "Документы", icon: "📄" },
];

export function ObjectPage() {
  const { id } = useParams<{ id: string }>();
  const objectId = Number(id);
  const { data: obj, isLoading } = useObject(objectId);
  const [activeTab, setActiveTab] = useState<Tab>("gpr");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-tg-button border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!obj) {
    return <div className="text-center text-tg-hint py-16">Объект не найден</div>;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-tg-text truncate">{obj.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          {obj.city && <span className="text-xs text-tg-hint">{obj.city}</span>}
          <span className={`text-xs font-medium ${statusColor(obj.status)}`}>
            {OBJECT_STATUS_LABELS[obj.status] || obj.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-tg-button text-tg-button-text"
                : "bg-tg-section-bg text-tg-hint"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-2">
        {activeTab === "gpr" && <GPRTab objectId={objectId} />}
        {activeTab === "tasks" && <TasksTab objectId={objectId} />}
        {activeTab === "construction" && <div className="text-tg-hint text-sm py-8 text-center">Монтаж — в разработке</div>}
        {activeTab === "supply" && <div className="text-tg-hint text-sm py-8 text-center">Поставки — в разработке</div>}
        {activeTab === "docs" && <div className="text-tg-hint text-sm py-8 text-center">Документы — в разработке</div>}
      </div>
    </div>
  );
}
