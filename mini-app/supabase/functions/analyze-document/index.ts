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

    const { file_path, document_id, prompt } = await req.json();

    if (!file_path) throw new Error("file_path is required");

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-documents")
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Chunk-based base64 encoding to avoid OOM on large files
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

    const systemPrompt = `Ты — эксперт по анализу строительной документации. Анализируй загруженный документ и извлекай:
1. Тип документа (чертёж, спецификация, ведомость, акт и т.д.)
2. Ключевые данные: размеры, объёмы, материалы, количества
3. Таблицы и их содержимое
4. Важные примечания и требования
5. Рекомендации для планирования работ

Отвечай структурированно на русском языке. Используй markdown для форматирования.`;

    const userPrompt = prompt || "Проанализируй этот документ. Извлеки все ключевые данные, таблицы и спецификации.";

    // Call DO OpenAI-compatible API
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
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Content}`,
                },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content || "Анализ не удался";

    // Save analysis to documents table if document_id provided
    if (document_id) {
      await supabase
        .from("documents")
        .update({ ai_summary: analysisText, parsed_text: analysisText })
        .eq("id", document_id);
    }

    return new Response(
      JSON.stringify({ success: true, analysis: analysisText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("analyze-document error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
