import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, X, Loader2 } from "lucide-react";

interface ProjectCalendarProps {
  projectId: string;
}

type EventType = "deadline" | "delivery" | "visit" | "payment" | "inspection" | "milestone" | "other";

interface CalEvent {
  id: string;
  project_id: string;
  title: string;
  date: string;
  end_date?: string;
  type: EventType;
  description?: string;
  is_done: boolean;
  priority?: "low" | "medium" | "high" | "critical";
  ref_1c?: string;
  doc_type_1c?: string;
  created_at?: string;
}

const EVENT_TYPE_CONFIG: Record<EventType, { icon: string; label: string; color: string; bg: string }> = {
  deadline:   { icon: "🎯", label: "Дедлайн",   color: "text-destructive",  bg: "bg-destructive/12" },
  delivery:   { icon: "🚛", label: "Поставка",   color: "text-primary",      bg: "bg-primary/12" },
  visit:      { icon: "👷", label: "Выезд",      color: "text-blue-400",     bg: "bg-blue-400/12" },
  payment:    { icon: "💳", label: "Оплата",     color: "text-yellow-400",   bg: "bg-yellow-400/12" },
  inspection: { icon: "🔍", label: "Технадзор",  color: "text-purple-400",   bg: "bg-purple-400/12" },
  milestone:  { icon: "🚩", label: "Веха",       color: "text-orange-400",   bg: "bg-orange-400/12" },
  other:      { icon: "📌", label: "Событие",    color: "text-muted-foreground", bg: "bg-muted" },
};

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAYS_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  let dow = first.getDay();
  if (dow === 0) dow = 7;
  for (let i = 1; i < dow; i++) days.push(new Date(0));
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function dateStr(d: Date): string {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

const today = dateStr(new Date());

const ProjectCalendar = ({ projectId }: ProjectCalendarProps) => {
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalEvent>>({
    type: "deadline", is_done: false, priority: "medium"
  });
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<EventType | "all">("all");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("calendar_events" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("date");
      setEvents((data as any[]) || []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const syncFromOtherTables = async () => {
      const [workRes] = await Promise.all([
        supabase.from("work_types").select("id,name,end_date").eq("project_id", projectId).not("end_date", "is", null),
      ]);

      const synced: CalEvent[] = [
        ...(workRes.data || []).map((w: { id: string; name: string; start_date?: string; end_date?: string }) => ({
          id: `gpr_${w.id}`,
          project_id: projectId,
          title: w.name,
          date: w.end_date,
          type: "deadline" as EventType,
          is_done: false,
          ref_1c: w.id,
          doc_type_1c: "WorkType",
        })),
      ];

      setEvents(prev => {
        const existing = new Set(prev.map(e => e.id));
        const toAdd = synced.filter(s => !existing.has(s.id));
        return [...prev, ...toAdd];
      });
    };
    syncFromOtherTables();
  }, [projectId]);

  const saveEvent = async () => {
    if (!newEvent.title || !newEvent.date) return;
    setSaving(true);
    try {
      const { data } = await (supabase.from("calendar_events" as any) as any).insert({
        ...newEvent,
        project_id: projectId,
        is_done: false,
        created_at: new Date().toISOString(),
      }).select().single();
      if (data) setEvents(prev => [...prev, data]);
    } catch (e) {
      console.error("Save error:", e);
    }
    setShowForm(false);
    setNewEvent({ type: "deadline", is_done: false, priority: "medium" });
    setSaving(false);
  };

  const toggleDone = async (id: string, current: boolean) => {
    if (id.startsWith("gpr_") || id.startsWith("order_")) return;
    await (supabase.from("calendar_events" as any) as any).update({ is_done: !current }).eq("id", id);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, is_done: !current } : e));
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const days = getDaysInMonth(year, month);

  const eventMap = new Map<string, CalEvent[]>();
  events
    .filter(e => filterType === "all" || e.type === filterType)
    .forEach(e => {
      const key = e.date?.slice(0, 10);
      if (!key) return;
      if (!eventMap.has(key)) eventMap.set(key, []);
      eventMap.get(key)!.push(e);
    });

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  const monthEvents = events
    .filter(e => e.date >= monthStart && e.date <= monthEnd)
    .filter(e => filterType === "all" || e.type === filterType)
    .sort((a, b) => a.date.localeCompare(b.date));

  const selectedEvents = selectedDate ? (eventMap.get(selectedDate) || []) : [];
  const overdueCount = events.filter(e => !e.is_done && e.date < today && e.type !== "delivery").length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="px-2.5 pt-2.5 pb-2 flex items-center gap-2">
        <button onClick={prevMonth} className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
          <ChevronLeft size={14} className="text-muted-foreground" />
        </button>
        <div className="flex-1 text-center">
          <div className="text-[13px] font-bold">{MONTHS_RU[month]} {year}</div>
          {overdueCount > 0 && (
            <div className="text-[9px] text-destructive">⚠️ {overdueCount} просроченных</div>
          )}
        </div>
        <button onClick={nextMonth} className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
          <ChevronRight size={14} className="text-muted-foreground" />
        </button>
        <button onClick={() => setShowForm(true)} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Plus size={14} />
        </button>
      </div>

      {/* View switcher & filters */}
      <div className="px-2.5 pb-2 flex items-center gap-2">
        <div className="flex bg-muted border border-border rounded-lg overflow-hidden flex-shrink-0">
          {(["month", "week", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-[9px] font-bold transition-all ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {{ month: "Месяц", week: "Неделя", list: "Список" }[v]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none flex-1">
          <button
            onClick={() => setFilterType("all")}
            className={`flex-shrink-0 px-2 py-1 rounded-md text-[9px] font-bold border transition-all ${filterType === "all" ? "bg-primary/12 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"}`}
          >
            Все
          </button>
          {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, any][]).map(([type, cfg]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex-shrink-0 px-2 py-1 rounded-md text-[9px] font-bold border transition-all ${filterType === type ? `${cfg.bg} ${cfg.color}` : "bg-muted border-border text-muted-foreground"}`}
            >
              {cfg.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Month view */}
      {view === "month" && (
        <div className="px-2.5">
          <div className="grid grid-cols-7 mb-1">
            {DAYS_RU.map(d => (
              <div key={d} className={`text-center text-[8px] font-bold py-1 ${d === "Сб" || d === "Вс" ? "text-destructive/60" : "text-muted-foreground"}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, idx) => {
              if (day.getTime() === 0) return <div key={`empty_${idx}`} />;
              const ds = dateStr(day);
              const dayEvents = eventMap.get(ds) || [];
              const isToday = ds === today;
              const isSelected = ds === selectedDate;
              const isPast = ds < today;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const hasOverdue = dayEvents.some(e => !e.is_done && ds < today);

              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(isSelected ? null : ds)}
                  className={`relative min-h-[44px] rounded-lg p-1 transition-all border text-left flex flex-col
                    ${isSelected ? "bg-primary/15 border-primary/40" :
                      isToday ? "bg-primary/8 border-primary/20" :
                      "bg-muted border-border hover:bg-accent"}
                  `}
                >
                  <span className={`text-[10px] font-bold leading-none
                    ${isToday ? "text-primary" :
                      isWeekend ? "text-destructive/60" :
                      isPast ? "text-muted-foreground" : "text-foreground"}
                  `}>
                    {day.getDate()}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((e, i) => {
                      const cfg = EVENT_TYPE_CONFIG[e.type];
                      return (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${e.is_done ? "opacity-30" : ""}`}
                          style={{ background: hasOverdue && !e.is_done && ds < today ? "#FF4757" : undefined }}
                          title={e.title}
                        >
                          {!hasOverdue && <div className={`w-1.5 h-1.5 rounded-full ${cfg.bg}`} />}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && <div className="text-[7px] text-muted-foreground">+{dayEvents.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              {selectedEvents.length === 0 ? (
                <div className="text-center py-4 text-[10px] text-muted-foreground">
                  Нет событий
                  <button
                    onClick={() => { setNewEvent(p => ({ ...p, date: selectedDate })); setShowForm(true); }}
                    className="block mx-auto mt-2 text-primary text-[10px]"
                  >
                    + Добавить
                  </button>
                </div>
              ) : (
                selectedEvents.map(e => <EventCard key={e.id} event={e} onToggle={toggleDone} />)
              )}
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="px-2.5 space-y-1.5">
          {monthEvents.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-muted-foreground">Нет событий в этом месяце</div>
          ) : (
            monthEvents.map(e => <EventCard key={e.id} event={e} onToggle={toggleDone} showDate />)
          )}
        </div>
      )}

      {/* Week view */}
      {view === "week" && (
        <div className="px-2.5">
          <WeekView year={year} month={month} events={events} onToggle={toggleDone} filterType={filterType} />
        </div>
      )}

      {/* Add event form */}
      {showForm && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-end">
          <div className="w-full bg-background border-t border-border rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-bold">Новое событие</span>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[8px] text-muted-foreground uppercase font-bold">Название *</label>
                <input
                  className="w-full mt-1 bg-muted border border-border rounded-xl px-3 py-2 text-[11px] outline-none focus:border-primary/50"
                  value={newEvent.title || ""}
                  onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                  placeholder="Название события"
                />
              </div>
              <div>
                <label className="text-[8px] text-muted-foreground uppercase font-bold">Тип</label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, any][]).map(([type, cfg]) => (
                    <button
                      key={type}
                      onClick={() => setNewEvent(p => ({ ...p, type }))}
                      className={`py-2 rounded-xl text-center border transition-all ${
                        newEvent.type === type ? `${cfg.bg} ${cfg.color}` : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      <div className="text-base">{cfg.icon}</div>
                      <div className="text-[8px] font-semibold mt-0.5">{cfg.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-muted-foreground uppercase font-bold">Дата *</label>
                  <input type="date"
                    className="w-full mt-1 bg-muted border border-border rounded-xl px-3 py-2 text-[11px] outline-none focus:border-primary/50"
                    value={newEvent.date || ""}
                    onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground uppercase font-bold">Дата окончания</label>
                  <input type="date"
                    className="w-full mt-1 bg-muted border border-border rounded-xl px-3 py-2 text-[11px] outline-none focus:border-primary/50"
                    value={newEvent.end_date || ""}
                    onChange={e => setNewEvent(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-[8px] text-muted-foreground uppercase font-bold">Описание</label>
                <textarea
                  className="w-full mt-1 bg-muted border border-border rounded-xl px-3 py-2 text-[11px] outline-none focus:border-primary/50 resize-none"
                  rows={2}
                  value={newEvent.description || ""}
                  onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                  placeholder="Детали..."
                />
              </div>
              <div className="pt-2 border-t border-border">
                <div className="text-[8px] text-muted-foreground uppercase font-bold mb-2">🔗 Поля 1С (опционально)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-muted-foreground">Тип документа 1С</label>
                    <input
                      className="w-full mt-0.5 bg-muted border border-border rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-primary/50"
                      value={newEvent.doc_type_1c || ""}
                      onChange={e => setNewEvent(p => ({ ...p, doc_type_1c: e.target.value }))}
                      placeholder="Заказ, Оплата..."
                    />
                  </div>
                  <div>
                    <label className="text-[8px] text-muted-foreground">Ссылка / номер 1С</label>
                    <input
                      className="w-full mt-0.5 bg-muted border border-border rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-primary/50"
                      value={newEvent.ref_1c || ""}
                      onChange={e => setNewEvent(p => ({ ...p, ref_1c: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={saveEvent}
                disabled={saving || !newEvent.title || !newEvent.date}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold disabled:opacity-50"
              >
                {saving ? "Сохранение..." : "Добавить событие"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EventCard = ({ event, onToggle, showDate }: {
  event: CalEvent;
  onToggle: (id: string, done: boolean) => void;
  showDate?: boolean;
}) => {
  const cfg = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.other;
  const isOverdue = !event.is_done && event.date < today;
  const isSynthetic = event.id.startsWith("gpr_") || event.id.startsWith("order_");

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
      event.is_done ? "opacity-50 bg-muted border-border" :
      isOverdue ? "bg-destructive/8 border-destructive/25" :
      `${cfg.bg} border-border`
    }`}>
      <button
        onClick={() => !isSynthetic && onToggle(event.id, event.is_done)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
          event.is_done ? "bg-primary border-primary" : "border-border hover:border-primary"
        }`}
      >
        {event.is_done && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold">{event.title}</span>
          <span className="text-base">{cfg.icon}</span>
        </div>
        {showDate && (
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {new Date(event.date + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short" })}
          </div>
        )}
        {event.description && <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{event.description}</div>}
        {event.ref_1c && <div className="text-[8px] text-muted-foreground mt-0.5 font-mono">1С: {event.doc_type_1c} {event.ref_1c}</div>}
      </div>
      {isOverdue && !event.is_done && (
        <div className="text-[8px] text-destructive font-bold flex-shrink-0">Просрочено</div>
      )}
    </div>
  );
};

const WeekView = ({ year, month, events, onToggle, filterType }: {
  year: number; month: number; events: CalEvent[];
  onToggle: (id: string, done: boolean) => void;
  filterType: EventType | "all";
}) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setWeekOffset(w => w - 1)} className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
          <ChevronLeft size={12} />
        </button>
        <span className="text-[10px] text-muted-foreground">
          {weekDays[0].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} –{" "}
          {weekDays[6].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
          <ChevronRight size={12} />
        </button>
      </div>
      <div className="space-y-1.5">
        {weekDays.map(day => {
          const ds = dateStr(day);
          const dayEvts = events.filter(e => e.date?.slice(0, 10) === ds && (filterType === "all" || e.type === filterType));
          const isToday = ds === today;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          return (
            <div key={ds}>
              <div className={`text-[9px] font-bold mb-1 ${isToday ? "text-primary" : isWeekend ? "text-destructive/60" : "text-muted-foreground"}`}>
                {day.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                {isToday && " · Сегодня"}
              </div>
              {dayEvts.length > 0 ? (
                dayEvts.map(e => <EventCard key={e.id} event={e} onToggle={onToggle} />)
              ) : (
                <div className="text-[9px] text-muted-foreground py-1 pl-2">—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectCalendar;
