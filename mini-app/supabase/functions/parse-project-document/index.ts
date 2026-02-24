import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/authMiddleware.ts";
import { getCorsHeaders } from "../_shared/corsHeaders.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const user = await authenticate(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const DO_MODEL_ACCESS_KEY = Deno.env.get("DO_MODEL_ACCESS_KEY");
    if (!DO_MODEL_ACCESS_KEY) throw new Error("DO_MODEL_ACCESS_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { file_path } = await req.json();
    if (!file_path) throw new Error("file_path is required");

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-documents")
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let base64Content = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      base64Content += String.fromCharCode(...uint8.slice(i, i + chunkSize));
    }
    base64Content = btoa(base64Content);

    const isPdf = file_path.toLowerCase().endsWith(".pdf");
    const mimeType = isPdf ? "application/pdf" : file_path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    const systemPrompt = `Ты — AI-ассистент для создания строительных проектов. Из загруженного документа (договор, спецификация, КП, техническое задание, чертёж) извлеки данные для карточки объекта.

Верни ТОЛЬКО валидный JSON (без markdown-обёртки) со следующей структурой:
{
  "name": "Название объекта/проекта",
  "code": "Код проекта (аббревиатура)",
  "address": "Адрес объекта",
  "city": "Город",
  "client_name": "Наименование заказчика/компании",
  "client_inn": "ИНН заказчика",
  "client_director": "Генеральный директор",
  "client_phone": "Телефон",
  "client_email": "Email",
  "client_legal_address": "Юридический адрес",
  "client_actual_address": "Фактический адрес",
  "client_bank": "Банк",
  "client_account": "Расчётный счёт",
  "work_type": "nvf" или "spk" или "both",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "contacts": [{"role": "Роль", "name": "ФИО", "phone": "Телефон", "email": "Email"}]
}

Если поле не найдено в документе — оставь пустую строку "". Для work_type определи по содержимому: НВФ = "nvf", СПК/светопрозрачные = "spk", оба = "both". Если не определяется — "spk".
Для contacts заполни найденных людей. Если не найдены — верни пустой массив.`;

    const userContent: any[] = [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64Content}`,
        },
      },
      {
        type: "text",
        text: "Извлеки все данные для создания карточки строительного объекта из этого документа.",
      },
    ];

    const response = await fetch("https://inference.do-ai.run/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DO_MODEL_ACCESS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai-gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Слишком много запросов, попробуйте позже" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Необходимо пополнить баланс AI" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI error [${response.status}]`);
    }

    const aiData = await response.json();
    const rawText = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle possible markdown wrapping)
    let projectData: Record<string, any> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        projectData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Raw:", rawText);
      throw new Error("Не удалось распознать данные из документа");
    }

    return new Response(
      JSON.stringify({ success: true, project: projectData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("parse-project-document error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
