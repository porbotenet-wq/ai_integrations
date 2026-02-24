import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate } from "../_shared/authMiddleware.ts";
import { getCorsHeaders } from "../_shared/corsHeaders.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── DOCX generation helpers ──

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function docxParagraph(text: string, opts: { bold?: boolean; size?: number; align?: string } = {}): string {
  const sz = opts.size || 24; // half-points, 24 = 12pt
  const bold = opts.bold ? "<w:b/>" : "";
  const align = opts.align ? `<w:jc w:val="${opts.align}"/>` : "";
  return `<w:p><w:pPr>${align}<w:rPr>${bold}<w:sz w:val="${sz}"/></w:rPr></w:pPr><w:r><w:rPr>${bold}<w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function makeDocxBytes(paragraphs: string[]): Uint8Array {
  const body = paragraphs.join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  // Simple ZIP with stored (no compression) entries
  return createZip([
    { path: "[Content_Types].xml", data: new TextEncoder().encode(contentTypes) },
    { path: "_rels/.rels", data: new TextEncoder().encode(rels) },
    { path: "word/_rels/document.xml.rels", data: new TextEncoder().encode(wordRels) },
    { path: "word/document.xml", data: new TextEncoder().encode(doc) },
  ]);
}

// ── Minimal ZIP implementation (store mode, no compression) ──

interface ZipEntry { path: string; data: Uint8Array; }

function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    
    // Local file header
    const local = new Uint8Array(30 + nameBytes.length + entry.data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression (store)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true); // compressed
    lv.setUint32(22, entry.data.length, true); // uncompressed
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    parts.push(local);

    // Central directory header
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0x20, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    centralDir.push(cd);

    offset += local.length;
  }

  // End of central directory
  const cdSize = centralDir.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  // Combine
  const total = offset + cdSize + 22;
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { result.set(p, pos); pos += p.length; }
  for (const c of centralDir) { result.set(c, pos); pos += c.length; }
  result.set(eocd, pos);
  return result;
}

function crc32(data: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return ~crc >>> 0;
}

// ── CSV/Excel-like generation (CSV with BOM for Excel compatibility) ──

function makeCsvBytes(headers: string[], rows: string[][]): Uint8Array {
  const bom = "\uFEFF";
  const csvContent = bom + [
    headers.join(";"),
    ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")),
  ].join("\r\n");
  return new TextEncoder().encode(csvContent);
}

// ── Template generators ──

interface TemplateResult {
  data: Uint8Array;
  filename: string;
  contentType: string;
  fileType: string;
}

async function generateTemplate(
  templateType: string,
  params: Record<string, any>,
  supabase: any,
): Promise<TemplateResult> {
  const projectId = params.project_id;
  const today = new Date().toLocaleDateString("ru-RU");

  switch (templateType) {
    // ── WORD Templates ──
    case "hidden_works_act": {
      const paras = [
        docxParagraph("АКТ ОСВИДЕТЕЛЬСТВОВАНИЯ СКРЫТЫХ РАБОТ", { bold: true, size: 28, align: "center" }),
        docxParagraph(""),
        docxParagraph(`Объект: ${params.project_name || "—"}`),
        docxParagraph(`Дата: ${params.date || today}`),
        docxParagraph(`Фасад: ${params.facade_name || "—"}`),
        docxParagraph(`Этаж: ${params.floor || "—"}`),
        docxParagraph(""),
        docxParagraph("Вид скрытых работ:", { bold: true }),
        docxParagraph(params.work_description || "Монтаж кронштейнов НВФ"),
        docxParagraph(""),
        docxParagraph("Результат осмотра:", { bold: true }),
        docxParagraph(params.result || "Работы выполнены в соответствии с проектной документацией."),
        docxParagraph(""),
        docxParagraph("Заключение:", { bold: true }),
        docxParagraph(params.conclusion || "Разрешается производство последующих работ."),
        docxParagraph(""),
        docxParagraph(`Представитель подрядчика: _________________ ${params.contractor || ""}`),
        docxParagraph(`Представитель заказчика: _________________ ${params.client || ""}`),
        docxParagraph(`Представитель технадзора: _________________ ${params.inspector || ""}`),
      ];
      return {
        data: makeDocxBytes(paras),
        filename: `Акт_скрытых_работ_${today.replace(/\./g, "-")}.docx`,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileType: "docx",
      };
    }

    case "acceptance_act": {
      const paras = [
        docxParagraph("АКТ ПРИЁМКИ ВЫПОЛНЕННЫХ РАБОТ", { bold: true, size: 28, align: "center" }),
        docxParagraph(""),
        docxParagraph(`Объект: ${params.project_name || "—"}`),
        docxParagraph(`Дата: ${params.date || today}`),
        docxParagraph(`Период: ${params.period || "—"}`),
        docxParagraph(""),
        docxParagraph("Выполненные работы:", { bold: true }),
        docxParagraph(params.works || "—"),
        docxParagraph(""),
        docxParagraph("Объём:", { bold: true }),
        docxParagraph(params.volume || "—"),
        docxParagraph(""),
        docxParagraph("Замечания:", { bold: true }),
        docxParagraph(params.remarks || "Замечаний нет"),
        docxParagraph(""),
        docxParagraph(`Подрядчик: _________________ ${params.contractor || ""}`),
        docxParagraph(`Заказчик: _________________ ${params.client || ""}`),
      ];
      return {
        data: makeDocxBytes(paras),
        filename: `Акт_приёмки_${today.replace(/\./g, "-")}.docx`,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileType: "docx",
      };
    }

    case "meeting_protocol": {
      const paras = [
        docxParagraph("ПРОТОКОЛ СОВЕЩАНИЯ", { bold: true, size: 28, align: "center" }),
        docxParagraph(""),
        docxParagraph(`Объект: ${params.project_name || "—"}`),
        docxParagraph(`Дата: ${params.date || today}`),
        docxParagraph(`Участники: ${params.participants || "—"}`),
        docxParagraph(""),
        docxParagraph("Повестка:", { bold: true }),
        docxParagraph(params.agenda || "—"),
        docxParagraph(""),
        docxParagraph("Решения:", { bold: true }),
        docxParagraph(params.decisions || "—"),
        docxParagraph(""),
        docxParagraph("Ответственные и сроки:", { bold: true }),
        docxParagraph(params.responsible || "—"),
      ];
      return {
        data: makeDocxBytes(paras),
        filename: `Протокол_${today.replace(/\./g, "-")}.docx`,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileType: "docx",
      };
    }

    case "defect_act": {
      const paras = [
        docxParagraph("АКТ О ДЕФЕКТАХ", { bold: true, size: 28, align: "center" }),
        docxParagraph(""),
        docxParagraph(`Объект: ${params.project_name || "—"}`),
        docxParagraph(`Дата обнаружения: ${params.date || today}`),
        docxParagraph(`Фасад: ${params.facade_name || "—"}`),
        docxParagraph(`Этаж: ${params.floor || "—"}`),
        docxParagraph(""),
        docxParagraph("Описание дефектов:", { bold: true }),
        docxParagraph(params.defects || "—"),
        docxParagraph(""),
        docxParagraph("Причина:", { bold: true }),
        docxParagraph(params.cause || "—"),
        docxParagraph(""),
        docxParagraph("Рекомендации по устранению:", { bold: true }),
        docxParagraph(params.recommendations || "—"),
        docxParagraph(""),
        docxParagraph(`Составил: _________________ ${params.author || ""}`),
      ];
      return {
        data: makeDocxBytes(paras),
        filename: `Акт_дефектов_${today.replace(/\./g, "-")}.docx`,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileType: "docx",
      };
    }

    case "daily_report": {
      const paras = [
        docxParagraph("ДНЕВНОЙ ОТЧЁТ", { bold: true, size: 28, align: "center" }),
        docxParagraph(""),
        docxParagraph(`Объект: ${params.project_name || "—"}`),
        docxParagraph(`Дата: ${params.date || today}`),
        docxParagraph(`Погода: ${params.weather || "—"}`),
        docxParagraph(`Количество рабочих: ${params.workers_count || "—"}`),
        docxParagraph(""),
        docxParagraph("Выполненные работы:", { bold: true }),
        docxParagraph(params.works || "—"),
        docxParagraph(""),
        docxParagraph("Проблемы:", { bold: true }),
        docxParagraph(params.issues || "Нет"),
        docxParagraph(""),
        docxParagraph(`Прораб: _________________ ${params.foreman || ""}`),
      ];
      return {
        data: makeDocxBytes(paras),
        filename: `Дневной_отчёт_${today.replace(/\./g, "-")}.docx`,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileType: "docx",
      };
    }

    case "letter_client":
    case "letter_subcontractor": {
      // AI-generated letter content expected in params.ai_content
      const recipient = templateType === "letter_client" ? "Заказчику" : "Субподрядчику";
      const paras = [
        docxParagraph(`ПИСЬМО ${recipient.toUpperCase()}`, { bold: true, size: 28, align: "center" }),
        docxParagraph(""),
        docxParagraph(`Исх. № ${params.outgoing_number || "___"} от ${params.date || today}`),
        docxParagraph(""),
        docxParagraph(`Кому: ${params.recipient_name || "—"}`),
        docxParagraph(`От: ${params.sender_name || "—"}`),
        docxParagraph(""),
        docxParagraph(`Тема: ${params.subject || "—"}`),
        docxParagraph(""),
        ...(params.ai_content || params.body || "—").split("\n").map((line: string) => docxParagraph(line)),
        docxParagraph(""),
        docxParagraph("С уважением,"),
        docxParagraph(params.sender_name || ""),
        docxParagraph(params.sender_position || ""),
      ];
      return {
        data: makeDocxBytes(paras),
        filename: `Письмо_${recipient}_${today.replace(/\./g, "-")}.docx`,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileType: "docx",
      };
    }

    // ── EXCEL (CSV) Templates ──
    case "materials_registry": {
      const { data: materials } = await supabase
        .from("materials")
        .select("name, unit, total_required, ordered, in_production, shipped, on_site, installed, deficit, status, supplier")
        .eq("project_id", projectId)
        .order("name");

      const headers = ["Материал", "Ед.", "Потребность", "Заказано", "В производстве", "Отгружено", "На площадке", "Смонтировано", "Дефицит", "Статус", "Поставщик"];
      const rows = (materials || []).map((m: any) => [
        m.name, m.unit, String(m.total_required), String(m.ordered), String(m.in_production),
        String(m.shipped), String(m.on_site), String(m.installed), String(m.deficit), m.status, m.supplier || "",
      ]);
      return {
        data: makeCsvBytes(headers, rows),
        filename: `Реестр_материалов_${today.replace(/\./g, "-")}.csv`,
        contentType: "text/csv; charset=utf-8",
        fileType: "csv",
      };
    }

    case "plan_fact_export": {
      const { data: pf } = await supabase
        .from("plan_fact")
        .select("date, week_number, plan_value, fact_value, notes, work_types!inner(name, section)")
        .eq("project_id", projectId)
        .order("date");

      const headers = ["Дата", "Неделя", "Вид работ", "Раздел", "План", "Факт", "Примечание"];
      const rows = (pf || []).map((r: any) => [
        r.date, String(r.week_number), r.work_types?.name || "", r.work_types?.section || "",
        String(r.plan_value), String(r.fact_value), r.notes || "",
      ]);
      return {
        data: makeCsvBytes(headers, rows),
        filename: `План_факт_${today.replace(/\./g, "-")}.csv`,
        contentType: "text/csv; charset=utf-8",
        fileType: "csv",
      };
    }

    case "crews_schedule": {
      const { data: crews } = await supabase
        .from("crews")
        .select("name, specialization, headcount, foreman_name, is_active, facades(name)")
        .eq("project_id", projectId)
        .order("name");

      const headers = ["Бригада", "Специализация", "Численность", "Бригадир", "Фасад", "Активна"];
      const rows = (crews || []).map((c: any) => [
        c.name, c.specialization || "", String(c.headcount), c.foreman_name || "",
        c.facades?.name || "", c.is_active ? "Да" : "Нет",
      ]);
      return {
        data: makeCsvBytes(headers, rows),
        filename: `График_бригад_${today.replace(/\./g, "-")}.csv`,
        contentType: "text/csv; charset=utf-8",
        fileType: "csv",
      };
    }

    case "supply_summary": {
      const { data: orders } = await supabase
        .from("orders")
        .select("order_number, material_name, supplier, quantity, unit, status, expected_delivery, total_amount")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      const headers = ["№ Заказа", "Материал", "Поставщик", "Количество", "Ед.", "Сумма", "Статус", "Ожидаемая поставка"];
      const rows = (orders || []).map((o: any) => [
        o.order_number || "", o.material_name, o.supplier, String(o.quantity), o.unit,
        String(o.total_amount || ""), o.status, o.expected_delivery || "",
      ]);
      return {
        data: makeCsvBytes(headers, rows),
        filename: `Сводка_снабжение_${today.replace(/\./g, "-")}.csv`,
        contentType: "text/csv; charset=utf-8",
        fileType: "csv",
      };
    }

    default:
      throw new Error(`Unknown template: ${templateType}`);
  }
}

// ── AI Letter Generation ──

async function generateLetterAI(params: Record<string, any>): Promise<string> {
  const DO_MODEL_ACCESS_KEY = Deno.env.get("DO_MODEL_ACCESS_KEY");
  if (!DO_MODEL_ACCESS_KEY) return params.body || "Текст письма не сгенерирован.";

  const tone = params.tone === "urgent" ? "срочном и настоятельном" : params.tone === "neutral" ? "нейтральном деловом" : "официальном";
  const recipient = params.template_type === "letter_client" ? "заказчику" : "субподрядчику";
  
  const prompt = `Напиши деловое письмо ${recipient} в ${tone} тоне.

Контекст:
- Объект: ${params.project_name || "строительный объект"}
- Тема: ${params.subject || "текущие вопросы"}
- Ключевые моменты: ${params.key_points || "—"}
- Отправитель: ${params.sender_name || ""}, ${params.sender_position || ""}

Требования:
- Формат: текст без заголовка (заголовок уже есть)
- Стиль: профессиональный строительный
- Длина: 3-5 абзацев
- Без приветствия и подписи (они уже есть)`;

  try {
    const resp = await fetch("https://inference.do-ai.run/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DO_MODEL_ACCESS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai-gpt-5-mini",
        messages: [
          { role: "system", content: "Ты — опытный РП на стройке. Пишешь деловые письма кратко, по существу." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || params.body || "";
    }
  } catch (e) {
    console.error("AI letter generation failed:", e);
  }
  return params.body || "Текст письма.";
}

// ── Main handler ──

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await authenticate(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { templateType, params = {} } = await req.json();
    if (!templateType) throw new Error("templateType is required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // For letter templates, generate AI content first
    if ((templateType === "letter_client" || templateType === "letter_subcontractor") && !params.ai_content) {
      params.ai_content = await generateLetterAI({ ...params, template_type: templateType });
    }

    const result = await generateTemplate(templateType, params, supabase);

    // Upload to storage
    const storagePath = `${user.id}/${crypto.randomUUID()}-${result.filename}`;
    const { error: uploadError } = await supabase.storage
      .from("generated-documents")
      .upload(storagePath, result.data, { contentType: result.contentType });

    if (uploadError) throw uploadError;

    // Create signed URL (1 hour)
    const { data: signedData } = await supabase.storage
      .from("generated-documents")
      .createSignedUrl(storagePath, 3600);

    // Save record
    await supabase.from("generated_documents").insert({
      project_id: params.project_id,
      template_type: templateType,
      title: result.filename,
      file_url: storagePath,
      file_type: result.fileType,
      params,
      ai_content: params.ai_content || null,
      created_by: user.id,
    });

    return new Response(JSON.stringify({
      success: true,
      filename: result.filename,
      file_url: signedData?.signedUrl,
      file_type: result.fileType,
      ai_content: params.ai_content || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
