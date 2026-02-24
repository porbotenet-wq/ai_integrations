import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2, Sparkles, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { workTypesTemplate, getTemplatesByWorkType, type WorkTemplate } from "@/data/workTypesTemplate";

interface Contact {
  role: string;
  name: string;
  phone: string;
  email: string;
}

interface ProjectData {
  name: string;
  code: string;
  address: string;
  city: string;
  client_name: string;
  client_inn: string;
  client_director: string;
  client_phone: string;
  client_email: string;
  client_legal_address: string;
  client_actual_address: string;
  client_bank: string;
  client_account: string;
  work_type: "nvf" | "spk" | "both";
  start_date: string;
  end_date: string;
  contacts: Contact[];
}

interface SelectedWork {
  number: number;
  volume: string;
  duration: string;
  start_date: string;
  end_date: string;
  workers: string;
}

const defaultContacts: Contact[] = [
  { role: "Директор", name: "", phone: "", email: "" },
  { role: "Руководитель проекта", name: "", phone: "", email: "" },
  { role: "Начальник участка", name: "", phone: "", email: "" },
  { role: "Прораб 1", name: "", phone: "", email: "" },
];

const emptyProject: ProjectData = {
  name: "", code: "", address: "", city: "",
  client_name: "", client_inn: "", client_director: "",
  client_phone: "", client_email: "", client_legal_address: "",
  client_actual_address: "", client_bank: "", client_account: "",
  work_type: "spk", start_date: "", end_date: "",
  contacts: [...defaultContacts],
};

const steps = [
  { id: 1, label: "Объект" },
  { id: 2, label: "Заказчик" },
  { id: 3, label: "Контакты" },
  { id: 4, label: "Вид работ" },
  { id: 5, label: "Работы" },
  { id: 6, label: "ГПР" },
];

interface Props {
  onBack: () => void;
  onCreated: (id: string, name?: string) => void;
}

const Field = ({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) => (
  <div className="mb-2.5">
    <div className="text-[9px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-bg1 border border-border rounded-sm px-3 py-2 text-[11px] text-foreground outline-none focus:border-primary transition-colors placeholder:text-t3"
    />
  </div>
);

const CreateProjectWizard = ({ onBack, onCreated }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<ProjectData>(emptyProject);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [docName, setDocName] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 5: selected work numbers
  const [selectedWorks, setSelectedWorks] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Step 6: work details
  const [workDetails, setWorkDetails] = useState<Map<number, SelectedWork>>(new Map());

  const upd = (field: keyof ProjectData, val: string) =>
    setData((d) => ({ ...d, [field]: val }));

  const updContact = (idx: number, field: keyof Contact, val: string) =>
    setData((d) => {
      const contacts = [...d.contacts];
      contacts[idx] = { ...contacts[idx], [field]: val };
      return { ...d, contacts };
    });

  const addContact = () =>
    setData((d) => ({
      ...d,
      contacts: [...d.contacts, { role: "", name: "", phone: "", email: "" }],
    }));

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Ошибка", description: "Поддерживаются PDF, PNG, JPEG", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Ошибка", description: "Максимум 20 МБ", variant: "destructive" });
      return;
    }
    setUploading(true);
    setDocName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const filePath = `${crypto.randomUUID()}.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage.from("project-documents").upload(filePath, file);
      if (uploadError) throw uploadError;
      setUploading(false);
      setParsing(true);
      const { data: parseResult, error: parseError } = await supabase.functions.invoke("parse-project-document", { body: { file_path: filePath } });
      if (parseError) throw parseError;
      if (parseResult?.success && parseResult.project) {
        const p = parseResult.project;
        setData((prev) => ({
          ...prev,
          name: p.name || prev.name, code: p.code || prev.code,
          address: p.address || prev.address, city: p.city || prev.city,
          client_name: p.client_name || prev.client_name, client_inn: p.client_inn || prev.client_inn,
          client_director: p.client_director || prev.client_director, client_phone: p.client_phone || prev.client_phone,
          client_email: p.client_email || prev.client_email, client_legal_address: p.client_legal_address || prev.client_legal_address,
          client_actual_address: p.client_actual_address || prev.client_actual_address, client_bank: p.client_bank || prev.client_bank,
          client_account: p.client_account || prev.client_account,
          work_type: (["nvf", "spk", "both"].includes(p.work_type) ? p.work_type : prev.work_type) as ProjectData["work_type"],
          start_date: p.start_date || prev.start_date, end_date: p.end_date || prev.end_date,
          contacts: p.contacts?.length > 0
            ? p.contacts.map((c: { role?: string; name?: string; phone?: string; email?: string }) => ({ role: c.role || "", name: c.name || "", phone: c.phone || "", email: c.email || "" }))
            : prev.contacts,
        }));
        setFilled(true);
        toast({ title: "✨ Данные извлечены", description: "Поля заполнены из документа." });
      } else {
        throw new Error(parseResult?.error || "Не удалось распознать документ");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка обработки";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setUploading(false); setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Toggle work selection
  const toggleWork = (num: number) => {
    setSelectedWorks((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
        setWorkDetails((wd) => { const n = new Map(wd); n.delete(num); return n; });
      } else {
        next.add(num);
        if (!workDetails.has(num)) {
          setWorkDetails((wd) => new Map(wd).set(num, { number: num, volume: "", duration: "", start_date: "", end_date: "", workers: "" }));
        }
      }
      return next;
    });
  };

  // Toggle entire section
  const toggleSection = (sectionWorks: WorkTemplate[]) => {
    const nums = sectionWorks.map((w) => w.number);
    const allSelected = nums.every((n) => selectedWorks.has(n));
    setSelectedWorks((prev) => {
      const next = new Set(prev);
      nums.forEach((n) => {
        if (allSelected) {
          next.delete(n);
        } else {
          next.add(n);
          if (!workDetails.has(n)) {
            setWorkDetails((wd) => new Map(wd).set(n, { number: n, volume: "", duration: "", start_date: "", end_date: "", workers: "" }));
          }
        }
      });
      return next;
    });
  };

  const toggleSectionExpand = (sec: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(sec) ? next.delete(sec) : next.add(sec);
      return next;
    });
  };

  const updateWorkDetail = (num: number, field: keyof SelectedWork, val: string) => {
    setWorkDetails((prev) => {
      const next = new Map(prev);
      const existing = next.get(num) || { number: num, volume: "", duration: "", start_date: "", end_date: "", workers: "" };
      next.set(num, { ...existing, [field]: val });

      // Auto-calc end_date from start_date + duration
      if (field === "start_date" || field === "duration") {
        const updated = next.get(num)!;
        if (updated.start_date && updated.duration) {
          const days = parseInt(updated.duration);
          if (!isNaN(days) && days > 0) {
            const start = new Date(updated.start_date);
            start.setDate(start.getDate() + days);
            next.set(num, { ...updated, end_date: start.toISOString().split("T")[0] });
          }
        }
      }
      return next;
    });
  };

  const availableWorks = getTemplatesByWorkType(data.work_type);
  const sections = [...new Set(availableWorks.map((w) => w.section))];

  const handleCreate = async () => {
    if (!data.name.trim()) {
      toast({ title: "Ошибка", description: "Укажите название объекта", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const row = {
        name: data.name, code: data.code || null, address: data.address || null,
        city: data.city || null, client_name: data.client_name || null,
        client_inn: data.client_inn || null, client_director: data.client_director || null,
        client_phone: data.client_phone || null, client_email: data.client_email || null,
        client_legal_address: data.client_legal_address || null, client_actual_address: data.client_actual_address || null,
        client_bank: data.client_bank || null, client_account: data.client_account || null,
        work_type: data.work_type, start_date: data.start_date || null, end_date: data.end_date || null,
        contacts: JSON.parse(JSON.stringify(data.contacts.filter((c) => c.name || c.phone || c.email))),
        status: "active",
      };

      const { data: inserted, error } = await supabase.from("projects").insert(row).select("id, name").single();
      if (error) throw error;

      // Save selected work types
      const selectedTemplates = availableWorks.filter((w) => selectedWorks.has(w.number));
      if (selectedTemplates.length > 0) {
        const workRows = selectedTemplates.map((t, i) => {
          const detail = workDetails.get(t.number);
          return {
            project_id: inserted.id,
            name: t.name,
            section: t.section,
            subsection: t.subsection,
            unit: t.unit,
            sort_number: i + 1,
            volume: detail?.volume ? parseFloat(detail.volume) : null,
            duration_days: detail?.duration ? parseInt(detail.duration) : null,
            start_date: detail?.start_date || null,
            end_date: detail?.end_date || null,
            workers_count: detail?.workers ? parseInt(detail.workers) : null,
          };
        });
        await supabase.from("work_types").insert(workRows);
      }

      // Seed document folders
      await supabase.rpc("seed_project_folders", { p_project_id: inserted.id });

      toast({ title: "🚀 Объект создан", description: data.name });
      onCreated(inserted.id, inserted.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка сохранения";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <div className="sticky top-0 z-50 bg-bg0/88 backdrop-blur-[20px] border-b border-border px-3.5 py-2.5 flex items-center justify-between">
        <button onClick={onBack} className="text-t2 text-[13px] hover:text-primary transition-colors">← Назад</button>
        <span className="text-[13px] font-bold">Новый объект</span>
        <div className="w-12" />
      </div>

      {/* Steps */}
      <div className="flex gap-0.5 px-2.5 py-2 overflow-x-auto">
        {steps.map((s) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`flex-shrink-0 px-2.5 py-1.5 rounded-sm text-[9px] font-semibold text-center transition-all ${
              step === s.id
                ? "bg-primary/12 text-primary border border-primary/25"
                : step > s.id
                ? "bg-bg2 text-primary/60 border border-transparent"
                : "bg-bg1 text-t3 border border-transparent"
            }`}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>

      <div className="p-3.5">
        {/* Step 1: Object info */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary" /> Создать из документа
                <span className="flex-1 h-px bg-border" />
              </div>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                  filled ? "border-primary/40 bg-primary/5" : "border-border bg-bg2 hover:border-primary/30"
                }`}
                onClick={() => !uploading && !parsing && fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleDocUpload} />
                {uploading ? (
                  <><Loader2 className="h-5 w-5 mx-auto text-primary animate-spin" /><p className="text-[10px] text-t2 mt-1.5 font-semibold">Загрузка файла...</p></>
                ) : parsing ? (
                  <><Loader2 className="h-5 w-5 mx-auto text-primary animate-spin" /><p className="text-[10px] text-primary mt-1.5 font-semibold">✨ AI анализирует документ...</p><p className="text-[9px] text-t3 mt-0.5">{docName}</p></>
                ) : filled ? (
                  <><CheckCircle className="h-5 w-5 mx-auto text-primary" /><p className="text-[10px] text-primary mt-1.5 font-semibold">Данные извлечены из {docName}</p><p className="text-[9px] text-t3 mt-0.5">Нажмите для загрузки другого документа</p></>
                ) : (
                  <><FileUp className="h-5 w-5 mx-auto text-t3" /><p className="text-[10px] text-t2 mt-1.5 font-semibold">Загрузите договор, КП или спецификацию</p><p className="text-[9px] text-t3 mt-0.5">AI заполнит карточку автоматически • PDF, PNG, JPEG до 20 МБ</p></>
                )}
              </div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-3 flex items-center gap-2">
              Информация об объекте <span className="flex-1 h-px bg-border" />
            </div>
            <Field label="Название объекта" value={data.name} onChange={(v) => upd("name", v)} placeholder="Напр: СИТИ 4 — Блок Б" />
            <Field label="Код объекта" value={data.code} onChange={(v) => upd("code", v)} placeholder="Напр: CITY4-B" />
            <Field label="Город" value={data.city} onChange={(v) => upd("city", v)} placeholder="Москва" />
            <Field label="Адрес" value={data.address} onChange={(v) => upd("address", v)} placeholder="Адрес объекта" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Дата начала" value={data.start_date} onChange={(v) => upd("start_date", v)} type="date" />
              <Field label="Дата окончания" value={data.end_date} onChange={(v) => upd("end_date", v)} type="date" />
            </div>
          </div>
        )}

        {/* Step 2: Client */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-3 flex items-center gap-2">
              Заказчик / Партнёр <span className="flex-1 h-px bg-border" />
            </div>
            <Field label="Наименование предприятия" value={data.client_name} onChange={(v) => upd("client_name", v)} placeholder='ООО «Компания»' />
            <Field label="Генеральный директор" value={data.client_director} onChange={(v) => upd("client_director", v)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="ИНН" value={data.client_inn} onChange={(v) => upd("client_inn", v)} />
              <Field label="Телефон" value={data.client_phone} onChange={(v) => upd("client_phone", v)} />
            </div>
            <Field label="E-mail" value={data.client_email} onChange={(v) => upd("client_email", v)} />
            <Field label="Юридический адрес" value={data.client_legal_address} onChange={(v) => upd("client_legal_address", v)} />
            <Field label="Фактический адрес" value={data.client_actual_address} onChange={(v) => upd("client_actual_address", v)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Банк" value={data.client_bank} onChange={(v) => upd("client_bank", v)} />
              <Field label="Расчётный счёт" value={data.client_account} onChange={(v) => upd("client_account", v)} />
            </div>
          </div>
        )}

        {/* Step 3: Contacts */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-3 flex items-center gap-2">
              Контакты и коммуникация <span className="flex-1 h-px bg-border" />
            </div>
            {data.contacts.map((c, i) => (
              <div key={i} className="bg-bg1 border border-border rounded-sm p-2.5 mb-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Роль" value={c.role} onChange={(v) => updContact(i, "role", v)} placeholder="Директор / РП / Прораб" />
                  <Field label="ФИО" value={c.name} onChange={(v) => updContact(i, "name", v)} placeholder="Иванов И.И." />
                  <Field label="Телефон" value={c.phone} onChange={(v) => updContact(i, "phone", v)} placeholder="+7 ..." />
                  <Field label="E-mail" value={c.email} onChange={(v) => updContact(i, "email", v)} placeholder="email@..." />
                </div>
              </div>
            ))}
            <button onClick={addContact} className="w-full py-2 border border-dashed border-border rounded-sm text-[10px] text-t2 font-semibold hover:border-primary/25 hover:text-primary transition-all">
              + Добавить контакт
            </button>
          </div>
        )}

        {/* Step 4: Work type */}
        {step === 4 && (
          <div className="animate-fade-in">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-3 flex items-center gap-2">
              Вид работ и запуск <span className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-2 mb-4">
              {([
                { id: "spk" as const, icon: "🔲", title: "СПК", desc: "Стоечно-ригельная, модульное, структурное, спайдерное" },
                { id: "nvf" as const, icon: "🏗️", title: "НВФ", desc: "Подсистема, утепление, облицовка" },
                { id: "both" as const, icon: "🔀", title: "НВФ + СПК", desc: "Оба вида работ" },
              ]).map((wt) => (
                <button
                  key={wt.id}
                  onClick={() => {
                    setData((d) => ({ ...d, work_type: wt.id }));
                    setSelectedWorks(new Set());
                    setWorkDetails(new Map());
                  }}
                  className={`text-left p-3.5 rounded-lg border transition-all ${
                    data.work_type === wt.id ? "border-primary/40 bg-primary/8" : "border-border bg-bg1 hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{wt.icon}</span>
                    <span className="text-[12px] font-bold">{wt.title}</span>
                  </div>
                  <div className="text-[10px] text-t2 ml-7">{wt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Select works from contract */}
        {step === 5 && (
          <div className="animate-fade-in">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2 flex items-center gap-2">
              Выберите работы по договору <span className="flex-1 h-px bg-border" />
            </div>
            <div className="text-[9px] text-t3 mb-3">
              Выбрано: <span className="text-primary font-bold">{selectedWorks.size}</span> из {availableWorks.length} работ
            </div>

            {sections.map((sec) => {
              const sectionWorks = availableWorks.filter((w) => w.section === sec);
              const isExpanded = expandedSections.has(sec);
              const selectedCount = sectionWorks.filter((w) => selectedWorks.has(w.number)).length;
              const allSelected = selectedCount === sectionWorks.length;

              // Group by subsection
              const subsections = [...new Set(sectionWorks.map((w) => w.subsection))];

              return (
                <div key={sec} className="mb-2 bg-bg1 border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 p-2.5">
                    <button onClick={() => toggleSectionExpand(sec)} className="shrink-0">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-t2" /> : <ChevronRight className="h-3.5 w-3.5 text-t2" />}
                    </button>
                    <button
                      onClick={() => toggleSection(sectionWorks)}
                      className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[9px] transition-colors ${
                        allSelected ? "bg-primary border-primary text-primary-foreground" : selectedCount > 0 ? "bg-primary/30 border-primary/50" : "border-border"
                      }`}
                    >
                      {allSelected ? "✓" : selectedCount > 0 ? "–" : ""}
                    </button>
                    <button onClick={() => toggleSectionExpand(sec)} className="flex-1 text-left">
                      <span className="text-[11px] font-bold">{sec}</span>
                      <span className="text-[9px] text-t3 ml-2">{selectedCount}/{sectionWorks.length}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border">
                      {subsections.map((sub) => {
                        const subWorks = sectionWorks.filter((w) => w.subsection === sub);
                        return (
                          <div key={sub}>
                            <div className="px-3 py-1.5 bg-bg2/50 text-[9px] font-bold text-t3 uppercase tracking-wide">{sub}</div>
                            {subWorks.map((w) => (
                              <button
                                key={w.number}
                                onClick={() => toggleWork(w.number)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bg2 transition-colors ${
                                  selectedWorks.has(w.number) ? "bg-primary/5" : ""
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[8px] ${
                                  selectedWorks.has(w.number) ? "bg-primary border-primary text-primary-foreground" : "border-border"
                                }`}>
                                  {selectedWorks.has(w.number) ? "✓" : ""}
                                </div>
                                <span className="text-[10px] text-t2 font-mono w-5 shrink-0">{w.number}</span>
                                <span className="text-[10px] flex-1 truncate">{w.name}</span>
                                <span className="text-[9px] text-t3 font-mono shrink-0">{w.unit}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 6: GPR - volumes and dates */}
        {step === 6 && (
          <div className="animate-fade-in">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2 flex items-center gap-2">
              ГПР — объёмы и сроки <span className="flex-1 h-px bg-border" />
            </div>
            {selectedWorks.size === 0 ? (
              <div className="text-center py-8">
                <p className="text-[11px] text-t3">Сначала выберите работы на шаге 5</p>
                <button onClick={() => setStep(5)} className="text-primary text-[11px] font-semibold mt-2 hover:underline">
                  ← К выбору работ
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[9px] text-t3 mb-2">
                  Заполните объёмы и даты — график сформируется автоматически
                </div>
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_60px_50px_90px_90px_45px] gap-1 px-2 text-[8px] font-bold text-t3 uppercase">
                  <span>Работа</span><span>Объём</span><span>Дней</span><span>Начало</span><span>Конец</span><span>Люди</span>
                </div>
                {availableWorks
                  .filter((w) => selectedWorks.has(w.number))
                  .map((w) => {
                    const d = workDetails.get(w.number) || { number: w.number, volume: "", duration: "", start_date: "", end_date: "", workers: "" };
                    return (
                      <div key={w.number} className="bg-bg1 border border-border rounded-md p-2">
                        <div className="text-[10px] font-semibold mb-1.5 flex items-center gap-1.5">
                          <span className="text-t3 font-mono text-[9px]">{w.number}.</span>
                          {w.name}
                          <span className="text-[8px] text-t3 font-mono ml-auto">{w.unit}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          <input
                            placeholder="Объём"
                            value={d.volume}
                            onChange={(e) => updateWorkDetail(w.number, "volume", e.target.value)}
                            className="bg-bg2 border border-border rounded px-1.5 py-1 text-[10px] outline-none focus:border-primary"
                          />
                          <input
                            placeholder="Дней"
                            value={d.duration}
                            onChange={(e) => updateWorkDetail(w.number, "duration", e.target.value)}
                            className="bg-bg2 border border-border rounded px-1.5 py-1 text-[10px] outline-none focus:border-primary"
                          />
                          <input
                            type="date"
                            value={d.start_date}
                            onChange={(e) => updateWorkDetail(w.number, "start_date", e.target.value)}
                            className="bg-bg2 border border-border rounded px-1 py-1 text-[9px] outline-none focus:border-primary"
                          />
                          <input
                            type="date"
                            value={d.end_date}
                            onChange={(e) => updateWorkDetail(w.number, "end_date", e.target.value)}
                            className="bg-bg2 border border-border rounded px-1 py-1 text-[9px] outline-none focus:border-primary"
                          />
                          <input
                            placeholder="Люди"
                            value={d.workers}
                            onChange={(e) => updateWorkDetail(w.number, "workers", e.target.value)}
                            className="bg-bg2 border border-border rounded px-1.5 py-1 text-[10px] outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 mt-4">
          {step > 1 && (
            <button onClick={() => setStep((s) => s - 1)} className="flex-1 py-2.5 rounded-sm bg-bg1 border border-border text-t1 text-[11px] font-bold hover:bg-bg2 transition-all">
              ← Назад
            </button>
          )}
          {step < 6 ? (
            <button onClick={() => setStep((s) => s + 1)} className="flex-1 py-2.5 rounded-sm bg-primary text-primary-foreground text-[11px] font-bold hover:brightness-110 transition-all">
              Далее →
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 rounded-sm bg-primary text-primary-foreground text-[11px] font-bold hover:brightness-110 transition-all disabled:opacity-50">
              {saving ? "Сохранение..." : "🚀 Создать объект"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateProjectWizard;
