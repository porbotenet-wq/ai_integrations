import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Plus, RefreshCw, ChevronDown, ChevronUp, X
} from "lucide-react";

interface SupplyDashboardProps {
  projectId: string;
}

interface Material {
  id: string;
  name: string;
  code_1c?: string;
  unit: string;
  category?: string;
  total_required: number;
  ordered: number;
  in_production: number;
  shipped: number;
  on_site: number;
  installed: number;
  deficit: number;
  status: string;
  supplier?: string;
  supplier_inn?: string;
  eta?: string;
  price_per_unit?: number;
}

interface Order {
  id: string;
  order_number?: string;
  order_number_1c?: string;
  material_id?: string;
  material_name: string;
  supplier: string;
  supplier_inn?: string;
  quantity: number;
  unit: string;
  price_per_unit?: number;
  total_amount?: number;
  status: "draft" | "confirmed" | "in_production" | "shipped" | "delivered" | "cancelled";
  order_date?: string;
  expected_delivery?: string;
  actual_delivery?: string;
  notes?: string;
  project_id: string;
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft:         { label: "Черновик",       color: "text-muted-foreground", bg: "bg-muted",             icon: "📝" },
  confirmed:     { label: "Подтверждён",    color: "text-blue-400",         bg: "bg-blue-400/10",       icon: "✅" },
  in_production: { label: "В производстве", color: "text-yellow-400",       bg: "bg-yellow-400/10",     icon: "⚙️" },
  shipped:       { label: "Отгружен",       color: "text-primary",          bg: "bg-primary/10",        icon: "🚛" },
  delivered:     { label: "Доставлен",      color: "text-emerald-400",      bg: "bg-emerald-400/10",    icon: "📦" },
  cancelled:     { label: "Отменён",        color: "text-destructive",      bg: "bg-destructive/10",    icon: "❌" },
};

const MATERIAL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ok:      { label: "Норма",    color: "text-primary" },
  low:     { label: "Мало",     color: "text-yellow-400" },
  deficit: { label: "Дефицит",  color: "text-destructive" },
  ordered: { label: "Заказано", color: "text-blue-400" },
};

const fmtNum = (n: number) => n?.toLocaleString("ru") ?? "—";
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—";
const fmtMoney = (n?: number) =>
  n ? `${n.toLocaleString("ru")} ₽` : "—";

const SupplyDashboard = ({ projectId }: SupplyDashboardProps) => {
  const [tab, setTab] = useState<"materials" | "orders" | "analytics">("materials");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    status: "draft", project_id: projectId
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [matRes, ordRes] = await Promise.all([
      supabase.from("materials").select("*").eq("project_id", projectId).order("name"),
      supabase.from("orders" as any).select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setMaterials(matRes.data || []);
    setOrders((ordRes.data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalDeficit = materials.filter(m => m.deficit > 0).length;
  const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length;
  const inTransit = orders.filter(o => o.status === "shipped").length;
  const totalBudget = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const deliveredBudget = orders
    .filter(o => o.status === "delivered")
    .reduce((s, o) => s + (o.total_amount || 0), 0);

  const saveOrder = async () => {
    if (!newOrder.material_name || !newOrder.supplier || !newOrder.quantity) return;
    setSaving(true);
    const record = {
      ...newOrder,
      project_id: projectId,
      total_amount: (newOrder.quantity || 0) * (newOrder.price_per_unit || 0) || null,
    };
    await (supabase.from("orders" as any) as any).insert(record);
    setShowNewOrder(false);
    setNewOrder({ status: "draft", project_id: projectId });
    await fetchData();
    setSaving(false);
  };

  const updateOrderStatus = async (id: string, status: Order["status"]) => {
    await (supabase.from("orders" as any) as any).update({
      status,
      ...(status === "delivered" ? { actual_delivery: new Date().toISOString().split("T")[0] } : {}),
    }).eq("id", id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-1.5 px-2.5 pt-2.5 pb-2">
        {[
          { label: "Дефицит", value: totalDeficit, color: totalDeficit > 0 ? "text-destructive" : "text-primary", icon: "⚠️" },
          { label: "Заказов", value: activeOrders, color: "text-blue-400", icon: "📋" },
          { label: "В пути", value: inTransit, color: "text-primary", icon: "🚛" },
          { label: "Бюджет", value: fmtMoney(totalBudget), color: "text-foreground", icon: "💰", small: true },
        ].map((k) => (
          <div key={k.label} className="bg-muted border border-border rounded-lg p-2 text-center">
            <div className="text-base mb-0.5">{k.icon}</div>
            <div className={`${k.small ? "text-[9px]" : "text-[16px]"} font-bold ${k.color} leading-none`}>
              {k.value}
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-2.5 pb-2">
        {(["materials", "orders", "analytics"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
              tab === t ? "bg-primary/12 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
            }`}
          >
            {{ materials: "📦 Материалы", orders: "📋 Заказы", analytics: "📊 Аналитика" }[t]}
          </button>
        ))}
      </div>

      {/* MATERIALS */}
      {tab === "materials" && (
        <div className="px-2.5 space-y-1.5">
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
            {["all", "deficit", "low", "ok", "ordered"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[9px] font-bold border transition-all ${
                  filterStatus === s ? "bg-primary/12 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {{ all: "Все", deficit: "🔴 Дефицит", low: "🟡 Мало", ok: "✅ Норма", ordered: "🔵 Заказано" }[s]}
              </button>
            ))}
          </div>

          {materials
            .filter(m => filterStatus === "all" || m.status === filterStatus)
            .map((m) => {
              const cfg = MATERIAL_STATUS_CONFIG[m.status] || MATERIAL_STATUS_CONFIG.ok;
              const expanded = expandedId === m.id;
              const pct = m.total_required > 0 ? Math.round((m.on_site / m.total_required) * 100) : 0;

              return (
                <div key={m.id} className="bg-muted border border-border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                    onClick={() => setExpandedId(expanded ? null : m.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold truncate">{m.name}</span>
                        {m.code_1c && (
                          <span className="text-[8px] font-mono text-muted-foreground bg-accent px-1 rounded flex-shrink-0">
                            {m.code_1c}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-accent overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${m.deficit > 0 ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</div>
                      <div className="text-[8px] text-muted-foreground font-mono">
                        {fmtNum(m.on_site)} / {fmtNum(m.total_required)} {m.unit}
                      </div>
                    </div>
                    {expanded ? <ChevronUp size={12} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />}
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 border-t border-border">
                      <div className="grid grid-cols-3 gap-2 mt-2.5">
                        {[
                          { label: "Заказано", value: fmtNum(m.ordered) + " " + m.unit },
                          { label: "В произв.", value: fmtNum(m.in_production) + " " + m.unit },
                          { label: "Отгружено", value: fmtNum(m.shipped) + " " + m.unit },
                          { label: "На площадке", value: fmtNum(m.on_site) + " " + m.unit },
                          { label: "Установлено", value: fmtNum(m.installed) + " " + m.unit },
                          { label: "Дефицит", value: m.deficit > 0 ? fmtNum(m.deficit) + " " + m.unit : "—", red: m.deficit > 0 },
                        ].map((row) => (
                          <div key={row.label} className="bg-accent rounded-lg p-2 text-center">
                            <div className="text-[8px] text-muted-foreground">{row.label}</div>
                            <div className={`text-[10px] font-bold mt-0.5 ${(row as any).red ? "text-destructive" : "text-foreground"}`}>
                              {row.value}
                            </div>
                          </div>
                        ))}
                      </div>
                      {(m.supplier || m.eta || m.price_per_unit) && (
                        <div className="mt-2 pt-2 border-t border-border space-y-0.5">
                          {m.supplier && (
                            <div className="flex justify-between text-[9px]">
                              <span className="text-muted-foreground">Поставщик</span>
                              <span className="text-foreground font-medium">{m.supplier}</span>
                            </div>
                          )}
                          {m.supplier_inn && (
                            <div className="flex justify-between text-[9px]">
                              <span className="text-muted-foreground">ИНН</span>
                              <span className="text-muted-foreground font-mono">{m.supplier_inn}</span>
                            </div>
                          )}
                          {m.eta && (
                            <div className="flex justify-between text-[9px]">
                              <span className="text-muted-foreground">ETA</span>
                              <span className="text-primary font-medium">{fmtDate(m.eta)}</span>
                            </div>
                          )}
                          {m.price_per_unit && (
                            <div className="flex justify-between text-[9px]">
                              <span className="text-muted-foreground">Цена / ед.</span>
                              <span className="text-foreground font-mono">{fmtMoney(m.price_per_unit)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {materials.filter(m => filterStatus === "all" || m.status === filterStatus).length === 0 && (
            <div className="text-center py-8 text-[11px] text-muted-foreground">Нет материалов с таким статусом</div>
          )}
        </div>
      )}

      {/* ORDERS */}
      {tab === "orders" && (
        <div className="px-2.5 space-y-1.5">
          <button
            onClick={() => setShowNewOrder(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 border border-primary/25 text-primary text-[11px] font-bold hover:bg-primary/15 transition-all"
          >
            <Plus size={13} /> Новый заказ
          </button>

          {showNewOrder && (
            <div className="bg-muted border border-primary/25 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold">Новый заказ</span>
                <button onClick={() => setShowNewOrder(false)}><X size={14} className="text-muted-foreground" /></button>
              </div>
              {[
                { key: "material_name", label: "Материал / номенклатура", required: true },
                { key: "supplier", label: "Поставщик", required: true },
                { key: "supplier_inn", label: "ИНН поставщика" },
                { key: "order_number_1c", label: "Номер документа 1С" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[8px] text-muted-foreground font-semibold uppercase">{f.label}{f.required && " *"}</label>
                  <input
                    className="w-full mt-0.5 bg-accent border border-border rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-primary/50"
                    value={(newOrder as any)[f.key] || ""}
                    onChange={e => setNewOrder(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[8px] text-muted-foreground font-semibold uppercase">Кол-во *</label>
                  <input type="number" className="w-full mt-0.5 bg-accent border border-border rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-primary/50"
                    value={newOrder.quantity || ""}
                    onChange={e => setNewOrder(p => ({ ...p, quantity: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground font-semibold uppercase">Ед. изм.</label>
                  <input className="w-full mt-0.5 bg-accent border border-border rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-primary/50"
                    value={newOrder.unit || ""}
                    onChange={e => setNewOrder(p => ({ ...p, unit: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground font-semibold uppercase">Цена / ед.</label>
                  <input type="number" className="w-full mt-0.5 bg-accent border border-border rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-primary/50"
                    value={newOrder.price_per_unit || ""}
                    onChange={e => setNewOrder(p => ({ ...p, price_per_unit: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-muted-foreground font-semibold uppercase">Дата заказа</label>
                  <input type="date" className="w-full mt-0.5 bg-accent border border-border rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-primary/50"
                    value={newOrder.order_date || ""}
                    onChange={e => setNewOrder(p => ({ ...p, order_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground font-semibold uppercase">Ожид. поставка</label>
                  <input type="date" className="w-full mt-0.5 bg-accent border border-border rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-primary/50"
                    value={newOrder.expected_delivery || ""}
                    onChange={e => setNewOrder(p => ({ ...p, expected_delivery: e.target.value }))} />
                </div>
              </div>
              <button
                onClick={saveOrder}
                disabled={saving || !newOrder.material_name || !newOrder.supplier}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold disabled:opacity-50"
              >
                {saving ? "Сохранение..." : "Создать заказ"}
              </button>
            </div>
          )}

          {orders.map((order) => {
            const cfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.draft;
            const expanded = expandedId === order.id;
            return (
              <div key={order.id} className="bg-muted border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                >
                  <span className="text-base flex-shrink-0">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold truncate">{order.material_name}</span>
                      {order.order_number_1c && (
                        <span className="text-[8px] font-mono text-muted-foreground bg-accent px-1 rounded flex-shrink-0">
                          {order.order_number_1c}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {order.supplier} · {fmtNum(order.quantity)} {order.unit}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </div>
                    {order.expected_delivery && (
                      <div className="text-[8px] text-muted-foreground mt-0.5">{fmtDate(order.expected_delivery)}</div>
                    )}
                  </div>
                  {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                </button>

                {expanded && (
                  <div className="px-3 pb-3 border-t border-border">
                    <div className="mt-2.5 space-y-1">
                      {[
                        { label: "Поставщик", value: order.supplier },
                        { label: "ИНН", value: order.supplier_inn },
                        { label: "№ в 1С", value: order.order_number_1c },
                        { label: "Цена / ед.", value: fmtMoney(order.price_per_unit) },
                        { label: "Сумма", value: fmtMoney(order.total_amount) },
                        { label: "Дата заказа", value: fmtDate(order.order_date) },
                        { label: "Ожид. поставка", value: fmtDate(order.expected_delivery) },
                        { label: "Факт. поставка", value: fmtDate(order.actual_delivery) },
                      ].filter(r => r.value && r.value !== "—").map(row => (
                        <div key={row.label} className="flex justify-between text-[9px]">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="text-foreground font-medium">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="text-[8px] text-muted-foreground uppercase font-bold mb-1.5">Изменить статус</div>
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(ORDER_STATUS_CONFIG) as Order["status"][])
                          .filter(s => s !== order.status && s !== "cancelled")
                          .map(s => {
                            const c = ORDER_STATUS_CONFIG[s];
                            return (
                              <button
                                key={s}
                                onClick={() => updateOrderStatus(order.id, s)}
                                className={`px-2 py-1 rounded-md text-[9px] font-semibold border transition-all ${c.bg} ${c.color}`}
                              >
                                {c.icon} {c.label}
                              </button>
                            );
                          })}
                        <button
                          onClick={() => updateOrderStatus(order.id, "cancelled")}
                          className="px-2 py-1 rounded-md text-[9px] font-semibold text-destructive bg-destructive/10 border border-destructive/20"
                        >
                          ❌ Отменить
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {orders.length === 0 && !showNewOrder && (
            <div className="text-center py-8">
              <div className="text-2xl mb-2">📋</div>
              <div className="text-[11px] text-muted-foreground">Заказов нет</div>
              <div className="text-[9px] text-muted-foreground mt-1">Создайте первый заказ</div>
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS */}
      {tab === "analytics" && (
        <div className="px-2.5 space-y-2.5">
          <div className="bg-muted border border-border rounded-xl p-3.5">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-3">💰 Бюджет снабжения</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[8px] text-muted-foreground">Всего заказано</div>
                <div className="text-[16px] font-bold text-foreground">{fmtMoney(totalBudget)}</div>
              </div>
              <div>
                <div className="text-[8px] text-muted-foreground">Доставлено</div>
                <div className="text-[16px] font-bold text-primary">{fmtMoney(deliveredBudget)}</div>
              </div>
            </div>
            {totalBudget > 0 && (
              <div className="mt-3">
                <div className="text-[8px] text-muted-foreground mb-1">
                  Исполнение {Math.round((deliveredBudget / totalBudget) * 100)}%
                </div>
                <div className="h-2 rounded-full bg-accent overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min((deliveredBudget / totalBudget) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted border border-border rounded-xl p-3.5">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-3">📊 Статусы заказов</div>
            {(Object.entries(ORDER_STATUS_CONFIG) as [string, any][]).map(([status, cfg]) => {
              const count = orders.filter(o => o.status === status).length;
              if (count === 0) return null;
              return (
                <div key={status} className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{cfg.icon}</span>
                  <span className={`text-[10px] font-semibold flex-1 ${cfg.color}`}>{cfg.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{count}</span>
                </div>
              );
            })}
          </div>

          <div className="bg-muted border border-primary/20 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[10px] font-bold uppercase text-muted-foreground flex-1">🔗 Интеграция с 1С</div>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                Скоро
              </span>
            </div>
            <div className="text-[9px] text-muted-foreground leading-relaxed">
              Все заказы хранятся с полями: код номенклатуры 1С, ИНН контрагента, номер документа 1С.
              После подключения — двусторонняя синхронизация через REST API или XML-обмен.
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[8px]">
              {[
                "Номенклатура → Материалы",
                "Контрагенты → Поставщики",
                "Заказы поставщику → Заказы",
                "Поступление товаров → Статус",
              ].map(t => (
                <div key={t} className="flex items-center gap-1 text-muted-foreground">
                  <div className="w-1 h-1 rounded-full bg-primary/40" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-2.5 py-3">
        <button
          onClick={fetchData}
          className="w-full flex items-center justify-center gap-2 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={11} /> Обновить данные
        </button>
      </div>
    </div>
  );
};

export default SupplyDashboard;
