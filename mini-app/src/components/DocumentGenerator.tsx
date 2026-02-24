import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, FileSpreadsheet, Download, Loader2, Sparkles, ArrowLeft, Eye, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  projectName: string;
}

interface Template {
  id: string;
  label: string;
  icon: string;
  type: "docx" | "csv";
  fields: Field[];
  aiLetter?: boolean;
}

interface Field {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string;
}

const WORD_TEMPLATES: Template[] = [
  {
    id: "hidden_works_act", label: "Акт скрытых работ", icon: "🔍", type: "docx",
    fields: [
      { key: "facade_name", label: "Фасад", type: "text", placeholder: "Фасад А" },
      { key: "floor", label: "Этаж", type: "text", placeholder: "5" },
      { key: "work_description", label: "Вид работ", type: "textarea", placeholder: "Монтаж кронштейнов НВФ" },
      { key: "result", label: "Результат осмотра", type: "textarea", defaultValue: "Работы выполнены в соответствии с проектной документацией." },
      { key: "date", label: "Дата", type: "date" },
    ],
  },
  {
    id: "acceptance_act", label: "Акт приёмки работ", icon: "✅", type: "docx",
    fields: [
      { key: "period", label: "Период", type: "text", placeholder: "01.01 — 31.01.2026" },
      { key: "works", label: "Выполненные работы", type: "textarea" },
      { key: "volume", label: "Объём", type: "text" },
      { key: "remarks", label: "Замечания", type: "textarea", defaultValue: "Замечаний нет" },
      { key: "date", label: "Дата", type: "date" },
    ],
  },
  {
    id: "meeting_protocol", label: "Протокол совещания", icon: "📋", type: "docx",
    fields: [
      { key: "participants", label: "Участники", type: "textarea", placeholder: "Иванов И.И., Петров П.П." },
      { key: "agenda", label: "Повестка", type: "textarea" },
      { key: "decisions", label: "Решения", type: "textarea" },
      { key: "responsible", label: "Ответственные и сроки", type: "textarea" },
      { key: "date", label: "Дата", type: "date" },
    ],
  },
  {
    id: "daily_report", label: "Дневной отчёт", icon: "📝", type: "docx",
    fields: [
      { key: "weather", label: "Погода", type: "text", placeholder: "Ясно, +15°C" },
      { key: "workers_count", label: "Кол-во рабочих", type: "text" },
      { key: "works", label: "Выполненные работы", type: "textarea" },
      { key: "issues", label: "Проблемы", type: "textarea", defaultValue: "Нет" },
      { key: "date", label: "Дата", type: "date" },
    ],
  },
  {
    id: "defect_act", label: "Акт о дефектах", icon: "⚠️", type: "docx",
    fields: [
      { key: "facade_name", label: "Фасад", type: "text" },
      { key: "floor", label: "Этаж", type: "text" },
      { key: "defects", label: "Описание дефектов", type: "textarea" },
      { key: "cause", label: "Причина", type: "textarea" },
      { key: "recommendations", label: "Рекомендации", type: "textarea" },
      { key: "date", label: "Дата", type: "date" },
    ],
  },
  {
    id: "letter_client", label: "Письмо заказчику", icon: "✉️", type: "docx", aiLetter: true,
    fields: [
      { key: "recipient_name", label: "Кому", type: "text", placeholder: "ООО «Заказчик»" },
      { key: "subject", label: "Тема", type: "text", placeholder: "О ходе работ" },
      { key: "key_points", label: "Ключевые моменты", type: "textarea", placeholder: "Отставание по фасаду Б, необходимо согласование..." },
      { key: "tone", label: "Тон", type: "select", options: [
        { value: "official", label: "Официальный" },
        { value: "neutral", label: "Нейтральный" },
        { value: "urgent", label: "Срочный" },
      ]},
      { key: "sender_name", label: "Отправитель", type: "text" },
      { key: "sender_position", label: "Должность", type: "text", placeholder: "Руководитель проекта" },
    ],
  },
  {
    id: "letter_subcontractor", label: "Письмо субподрядчику", icon: "📨", type: "docx", aiLetter: true,
    fields: [
      { key: "recipient_name", label: "Кому", type: "text" },
      { key: "subject", label: "Тема", type: "text" },
      { key: "key_points", label: "Ключевые моменты", type: "textarea" },
      { key: "tone", label: "Тон", type: "select", options: [
        { value: "official", label: "Официальный" },
        { value: "neutral", label: "Нейтральный" },
        { value: "urgent", label: "Срочный" },
      ]},
      { key: "sender_name", label: "Отправитель", type: "text" },
      { key: "sender_position", label: "Должность", type: "text" },
    ],
  },
];

const EXCEL_TEMPLATES: Template[] = [
  { id: "materials_registry", label: "Реестр материалов", icon: "📦", type: "csv", fields: [] },
  { id: "plan_fact_export", label: "Выгрузка план-факт", icon: "📊", type: "csv", fields: [] },
  { id: "crews_schedule", label: "График бригад", icon: "👷", type: "csv", fields: [] },
  { id: "supply_summary", label: "Сводка по снабжению", icon: "🚛", type: "csv", fields: [] },
];

const DocumentGenerator = ({ projectId, projectName }: Props) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const handleSelect = (tmpl: Template) => {
    setSelected(tmpl);
    setPreview(null);
    setDownloadUrl(null);
    const defaults: Record<string, string> = {};
    tmpl.fields.forEach((f) => {
      if (f.defaultValue) defaults[f.key] = f.defaultValue;
      if (f.type === "date") defaults[f.key] = today;
      if (f.type === "select" && f.options?.length) defaults[f.key] = f.options[0].value;
    });
    setFormData(defaults);
  };

  const generate = async () => {
    if (!selected) return;
    setLoading(true);
    setPreview(null);
    setDownloadUrl(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            templateType: selected.id,
            params: { ...formData, project_id: projectId, project_name: projectName },
          }),
        },
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Ошибка ${resp.status}`);
      }

      const result = await resp.json();
      if (result.success) {
        setDownloadUrl(result.file_url);
        if (result.ai_content) setPreview(result.ai_content);
        toast({ title: "✅ Документ готов", description: result.filename });
      } else {
        throw new Error(result.error || "Ошибка генерации");
      }
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "Неизвестная ошибка", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Template list view ──
  if (!selected) {
    return (
      <div className="animate-fade-in space-y-4">
        {/* Word section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Word документы</span>
            <span className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {WORD_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="bg-[hsl(var(--card))] border border-border rounded-xl p-3 text-left active:scale-[0.97] transition-transform hover:border-primary/30"
              >
                <div className="text-[16px] mb-1">{t.icon}</div>
                <div className="text-[11px] font-semibold text-foreground leading-tight">{t.label}</div>
                {t.aiLetter && (
                  <div className="flex items-center gap-1 mt-1">
                    <Sparkles className="h-2.5 w-2.5 text-primary" />
                    <span className="text-[9px] text-primary font-medium">AI</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Excel section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Таблицы (CSV)</span>
            <span className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {EXCEL_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  handleSelect(t);
                  // Auto-generate for data exports (no fields)
                }}
                className="bg-[hsl(var(--card))] border border-border rounded-xl p-3 text-left active:scale-[0.97] transition-transform hover:border-primary/30"
              >
                <div className="text-[16px] mb-1">{t.icon}</div>
                <div className="text-[11px] font-semibold text-foreground leading-tight">{t.label}</div>
                <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">Из данных проекта</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ──
  return (
    <div className="animate-fade-in space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setSelected(null); setPreview(null); setDownloadUrl(null); }}
          className="w-8 h-8 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center text-foreground"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-[18px]">{selected.icon}</span>
        <h3 className="text-[14px] font-bold text-foreground">{selected.label}</h3>
      </div>

      {/* Fields */}
      {selected.fields.length > 0 ? (
        <div className="space-y-2.5">
          {selected.fields.map((f) => (
            <div key={f.key}>
              <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  value={formData[f.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full bg-[hsl(var(--muted))] border border-border rounded-lg px-3 py-2 text-[12px] text-foreground outline-none resize-none focus:border-primary/30"
                />
              ) : f.type === "select" ? (
                <select
                  value={formData[f.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  className="w-full bg-[hsl(var(--muted))] border border-border rounded-lg px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/30"
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  value={formData[f.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full bg-[hsl(var(--muted))] border border-border rounded-lg px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/30"
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[hsl(var(--muted))] rounded-xl p-4 text-center">
          <FileSpreadsheet className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
          <p className="text-[12px] text-foreground">Данные будут выгружены из проекта автоматически</p>
        </div>
      )}

      {/* AI Preview */}
      {preview && (
        <div className="bg-[hsl(var(--muted))] border border-border rounded-xl p-3">
          <div className="flex items-center gap-1 mb-2">
            <Eye className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase">Preview AI-текста</span>
          </div>
          <div className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {preview}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={generate}
          disabled={loading}
          className="flex-1 h-10 rounded-xl text-[12px] font-semibold gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : selected.aiLetter ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {loading ? "Генерация..." : selected.aiLetter ? "AI Генерация" : "Сформировать"}
        </Button>

        {downloadUrl && (
          <Button
            variant="outline"
            className="h-10 rounded-xl text-[12px] font-semibold gap-2"
            onClick={() => window.open(downloadUrl, "_blank")}
          >
            <Download className="h-4 w-4" />
            Скачать
          </Button>
        )}
      </div>
    </div>
  );
};

export default DocumentGenerator;
