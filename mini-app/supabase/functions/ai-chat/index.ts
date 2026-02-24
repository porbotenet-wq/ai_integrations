import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate } from "../_shared/authMiddleware.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/corsHeaders.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `Ты — STSphera AI, интеллектуальный ассистент для управления строительными фасадными проектами. 
Ты работаешь в системе STSphera и помогаешь руководителям проектов, прорабам, снабженцам и другим специалистам.

Твои компетенции:
- Управление фасадным строительством (СПК системы, кронштейны, герметизация)
- Логика взаимодействия отделов: Договорной → Запуск → Проектирование → Снабжение → Производство → Монтаж → ПТО → Контроль
- Рабочие процессы: ГПР, План-Факт, бригады, снабжение, документация
- Анализ отставаний и рисков
- Формирование сводок и отчётов

Правила:
- Отвечай кратко и по делу, как опытный РП
- Используй строительную терминологию
- Если спрашивают про конкретные цифры которых у тебя нет — скажи что нужно свериться с актуальными данными в системе
- Отвечай на русском языке`;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

async function searchNorms(query: string, apiKey: string): Promise<any[]> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if norm_documents has data
    const { count } = await supabase
      .from("norm_documents")
      .select("id", { count: "exact", head: true });

    if (!count || count === 0) return [];

    // Try embedding search
    try {
      const embResp = await fetch("https://inference.do-ai.run/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: query }),
      });

      if (embResp.ok) {
        const embData = await embResp.json();
        const embedding = embData.data?.[0]?.embedding;
        if (embedding) {
          const { data } = await supabase.rpc("search_norm_chunks", {
            query_embedding: JSON.stringify(embedding),
            match_threshold: 0.75,
            match_count: 5,
          });
          if (data?.length) return data;
        }
      }
    } catch (e) {
      console.error("Embedding search failed:", e);
    }

    // Fallback: text search
    const terms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    if (terms.length > 0) {
      const { data } = await supabase
        .from("norm_chunks")
        .select("id, document_id, section, content, norm_documents!inner(title, code, source_url)")
        .textSearch("content", terms.join(" & "))
        .limit(5);
      if (data) {
        return data.map((r: any) => ({
          chunk_id: r.id,
          document_id: r.document_id,
          document_title: r.norm_documents?.title,
          document_code: r.norm_documents?.code,
          section: r.section,
          content: r.content,
          score: 0.5,
          source_url: r.norm_documents?.source_url,
        }));
      }
    }
    return [];
  } catch (e) {
    console.error("searchNorms error:", e);
    return [];
  }
}

function buildNormContext(chunks: any[]): string {
  if (!chunks.length) return "";
  let ctx = "\n\n## Нормативная база (релевантные фрагменты)\n\n";
  for (const c of chunks) {
    ctx += `### ${c.document_code || "Документ"}`;
    if (c.section) ctx += `, ${c.section}`;
    ctx += `\n${c.content}\n\n`;
  }
  ctx += "---\nИспользуй эти фрагменты для ответа. Указывай номер документа и пункт при цитировании.\nЕсли информации недостаточно — скажи об этом, не выдумывай.\n";
  return ctx;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const user = await authenticate(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { allowed, remaining, retryAfterMs } = checkRateLimit(
    `ai-chat:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS,
  );
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: {
        ...corsHeaders, "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
      },
    });
  }

  try {
    const { messages, projectName, userRole, systemPrompt, mode = "all" } = await req.json();
    const DO_MODEL_ACCESS_KEY = Deno.env.get("DO_MODEL_ACCESS_KEY");
    if (!DO_MODEL_ACCESS_KEY) throw new Error("DO_MODEL_ACCESS_KEY is not configured");

    const contextNote = `Контекст: Проект "${projectName || "Неизвестный"}". Роль пользователя: ${userRole || "не указана"}.`;
    let finalSystemPrompt = systemPrompt || (SYSTEM_PROMPT + "\n\n" + contextNote);

    // RAG: search norms if mode is "norms" or "all"
    let normChunks: any[] = [];
    if (mode === "norms" || mode === "all") {
      const lastUserMsg = [...(messages || [])].reverse().find((m: any) => m.role === "user");
      if (lastUserMsg?.content) {
        normChunks = await searchNorms(lastUserMsg.content, DO_MODEL_ACCESS_KEY);
        if (normChunks.length > 0) {
          finalSystemPrompt += buildNormContext(normChunks);
        }
      }
    }

    // Build citations from norm chunks
    const citations = normChunks
      .filter((c) => c.document_code)
      .map((c) => ({
        document_code: c.document_code,
        section: c.section,
        document_id: c.document_id,
        source_url: c.source_url,
      }));

    const response = await fetch("https://inference.do-ai.run/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DO_MODEL_ACCESS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai-gpt-5-mini",
        messages: [
          { role: "system", content: finalSystemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI gateway rate limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepend citations as SSE event before streaming
    const citationsEvent = citations.length > 0
      ? `data: ${JSON.stringify({ citations })}\n\n`
      : "";

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Write citations first, then pipe AI stream
    (async () => {
      try {
        if (citationsEvent) {
          await writer.write(encoder.encode(citationsEvent));
        }
        const reader = response.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-RateLimit-Remaining": String(remaining),
      },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
