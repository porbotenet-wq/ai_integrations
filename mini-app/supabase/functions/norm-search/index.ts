import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate } from "../_shared/authMiddleware.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/corsHeaders.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DO_MODEL_ACCESS_KEY = Deno.env.get("DO_MODEL_ACCESS_KEY");

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

  const { allowed } = checkRateLimit(`norm-search:${user.id}`, 20, 60_000);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { query, limit = 5, threshold = 0.75 } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get embedding via Lovable AI Gateway (using a model that supports embeddings)
    // Fallback: use Gemini to generate a text summary and do keyword search
    // For now, use the search_norm_chunks RPC if embeddings exist,
    // or fall back to text search
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if norm_documents has any data
    const { count } = await supabase
      .from("norm_documents")
      .select("id", { count: "exact", head: true });

    if (!count || count === 0) {
      return new Response(JSON.stringify({ results: [], empty: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try embedding-based search first
    let results: any[] = [];

    // Get embedding from OpenAI-compatible endpoint
    if (DO_MODEL_ACCESS_KEY) {
      try {
        const embResp = await fetch("https://inference.do-ai.run/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${DO_MODEL_ACCESS_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: query,
          }),
        });

        if (embResp.ok) {
          const embData = await embResp.json();
          const embedding = embData.data?.[0]?.embedding;

          if (embedding) {
            const { data, error } = await supabase.rpc("search_norm_chunks", {
              query_embedding: JSON.stringify(embedding),
              match_threshold: threshold,
              match_count: limit,
            });

            if (!error && data) {
              results = data;
            }
          }
        }
      } catch (e) {
        console.error("Embedding search failed, falling back to text search:", e);
      }
    }

    // Fallback: text search if no embedding results
    if (results.length === 0) {
      const searchTerms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
      if (searchTerms.length > 0) {
        const { data } = await supabase
          .from("norm_chunks")
          .select(`
            id,
            document_id,
            section,
            content,
            norm_documents!inner(title, code, source_url)
          `)
          .textSearch("content", searchTerms.join(" & "))
          .limit(limit);

        if (data) {
          results = data.map((r: any) => ({
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
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("norm-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
