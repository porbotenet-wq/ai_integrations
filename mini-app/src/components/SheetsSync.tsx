import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Download, Upload, ArrowLeftRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const TABLES = [
  { value: "materials", label: "📦 Материалы (materials)" },
  { value: "plan_fact", label: "📋 План-Факт (plan_fact)" },
  { value: "floors", label: "🏗️ Этажи (floors)" },
  { value: "work_types", label: "📆 Виды работ (work_types)" },
];

interface SyncResult {
  success: boolean;
  error?: string;
  rows_processed?: number;
  rows_pushed?: number;
  pulled?: number;
  pushed?: number;
}

const SheetsSync = () => {
  const { toast } = useToast();
  const [sheetId, setSheetId] = useState("");
  const [sheetName, setSheetName] = useState("Лист1");
  const [targetTable, setTargetTable] = useState("materials");
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const callSync = async (action: "pull" | "push" | "sync") => {
    if (!sheetId.trim()) {
      toast({ title: "Ошибка", description: "Укажите ID Google таблицы", variant: "destructive" });
      return;
    }

    setLoading(action);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("google-sheets-sync", {
        body: { action, sheet_id: sheetId.trim(), sheet_name: sheetName.trim() || "Лист1", target_table: targetTable },
      });

      if (error) throw error;

      setLastResult(data as SyncResult);

      if (data?.success) {
        const msg = action === "pull"
          ? `Загружено строк: ${data.rows_processed}`
          : action === "push"
            ? `Выгружено строк: ${data.rows_pushed}`
            : `Загружено: ${data.pulled}, выгружено: ${data.pushed}`;
        toast({ title: "Синхронизация завершена", description: msg });
      } else {
        toast({ title: "Ошибка синхронизации", description: data?.error || "Неизвестная ошибка", variant: "destructive" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка вызова функции";
      setLastResult({ success: false, error: msg });
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="animate-fade-in p-2.5 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 flex items-center gap-2">
        <RefreshCw className="h-3 w-3" /> Google Sheets синхронизация
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Settings Card */}
      <div className="bg-bg2 border border-border rounded-lg p-4 space-y-3">
        <div>
          <label className="text-[10px] font-semibold text-t2 uppercase tracking-wide mb-1 block">
            ID Google таблицы
          </label>
          <Input
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            className="bg-bg1 border-border text-[12px] font-mono h-9"
          />
          <p className="text-[9px] text-t3 mt-1">
            Скопируйте из URL таблицы: docs.google.com/spreadsheets/d/<span className="text-primary">ID_ЗДЕСЬ</span>/edit
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-t2 uppercase tracking-wide mb-1 block">
              Имя листа
            </label>
            <Input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Лист1"
              className="bg-bg1 border-border text-[12px] h-9"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-t2 uppercase tracking-wide mb-1 block">
              Таблица БД
            </label>
            <Select value={targetTable} onValueChange={setTargetTable}>
              <SelectTrigger className="bg-bg1 border-border text-[12px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-[12px]">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={() => callSync("pull")}
          disabled={!!loading}
          variant="outline"
          className="h-12 flex-col gap-1 bg-bg2 border-border hover:border-primary/25 hover:bg-primary/8"
        >
          {loading === "pull" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Download className="h-4 w-4 text-primary" />}
          <span className="text-[10px] font-semibold">Pull</span>
        </Button>
        <Button
          onClick={() => callSync("push")}
          disabled={!!loading}
          variant="outline"
          className="h-12 flex-col gap-1 bg-bg2 border-border hover:border-warning/25 hover:bg-warning/8"
        >
          {loading === "push" ? <Loader2 className="h-4 w-4 animate-spin text-warning" /> : <Upload className="h-4 w-4 text-warning" />}
          <span className="text-[10px] font-semibold">Push</span>
        </Button>
        <Button
          onClick={() => callSync("sync")}
          disabled={!!loading}
          variant="outline"
          className="h-12 flex-col gap-1 bg-bg2 border-border hover:border-info/25 hover:bg-info/8"
        >
          {loading === "sync" ? <Loader2 className="h-4 w-4 animate-spin text-info" /> : <ArrowLeftRight className="h-4 w-4 text-info" />}
          <span className="text-[10px] font-semibold">Sync</span>
        </Button>
      </div>

      {/* Result */}
      {lastResult && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border ${
          lastResult.success
            ? "bg-primary/5 border-primary/20"
            : "bg-destructive/5 border-destructive/20"
        }`}>
          {lastResult.success
            ? <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          }
          <div className="text-[11px]">
            {lastResult.success ? (
              <span className="text-primary font-semibold">
                Успешно.{" "}
                {lastResult.rows_processed != null && `Строк: ${lastResult.rows_processed}`}
                {lastResult.rows_pushed != null && `Строк: ${lastResult.rows_pushed}`}
                {lastResult.pulled != null && `Pull: ${lastResult.pulled}, Push: ${lastResult.pushed}`}
              </span>
            ) : (
              <span className="text-destructive">{lastResult.error}</span>
            )}
          </div>
        </div>
      )}

      {/* Help */}
      <div className="bg-bg1 border border-border rounded-lg p-3">
        <div className="text-[10px] font-bold text-t2 mb-1.5">Как использовать:</div>
        <ul className="text-[10px] text-t3 space-y-1 list-disc list-inside">
          <li><strong className="text-t2">Pull</strong> — загрузить данные из Google Sheets в базу</li>
          <li><strong className="text-t2">Push</strong> — выгрузить данные из базы в Google Sheets</li>
          <li><strong className="text-t2">Sync</strong> — двусторонняя синхронизация (pull + push)</li>
          <li>Убедитесь, что сервисный аккаунт имеет доступ к таблице</li>
        </ul>
      </div>
    </div>
  );
};

export default SheetsSync;
