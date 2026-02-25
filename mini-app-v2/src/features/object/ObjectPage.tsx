import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useObject } from "@/shared/api";
import { GPRTab } from "@/features/gpr/GPRTab";
import { TasksTab } from "@/features/tasks/TasksTab";
import { SupplyTab } from "@/features/supply/SupplyTab";
import { ConstructionTab } from "@/features/construction/ConstructionTab";
import { DocumentsTab } from "@/features/documents/DocumentsTab";
import { ProductionChainTab } from "@/features/production-chain/ProductionChainTab";
import { AIChatTab } from "@/features/ai-chat/AIChatTab";
import { OBJECT_STATUS_LABELS, statusColor } from "@/shared/lib/format";

type Tab = "gpr" | "tasks" | "construction" | "supply" | "docs" | "production" | "ai";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "gpr", label: "ГПР", icon: "📋" },
  { id: "tasks", label: "Задачи", icon: "✅" },
  { id: "construction", label: "Монтаж", icon: "🏗" },
  { id: "production", label: "Произв.", icon: "🏭" },
  { id: "supply", label: "Поставки", icon: "📦" },
  { id: "docs", label: "Документы", icon: "📄" },
  { id: "ai", label: "AI", icon: "🤖" },
];

export function ObjectPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const objectId = Number(id);
  const { data: obj, isLoading } = useObject(objectId);

  const tabParam = searchParams.get("tab") as Tab | null;
  const validTab = tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "gpr";
  const [activeTab, setActiveTab] = useState<Tab>(validTab);

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
        {activeTab === "construction" && <ConstructionTab objectId={objectId} />}
        {activeTab === "production" && <ProductionChainTab objectId={objectId} />}
        {activeTab === "supply" && <SupplyTab objectId={objectId} />}
        {activeTab === "docs" && <DocumentsTab objectId={objectId} />}
        {activeTab === "ai" && <AIChatTab objectId={objectId} objectName={obj.name} />}
      </div>
    </div>
  );
}
