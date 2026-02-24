
CREATE OR REPLACE FUNCTION public.search_norm_chunks(
  query_embedding extensions.vector,
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_code text,
  section text,
  content text,
  score float,
  source_url text
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.id,
    nc.document_id,
    nd.title,
    nd.code,
    nc.section,
    nc.content,
    (1 - (nc.embedding <=> query_embedding))::float,
    nd.source_url
  FROM public.norm_chunks nc
  JOIN public.norm_documents nd ON nd.id = nc.document_id
  WHERE (1 - (nc.embedding <=> query_embedding)) > match_threshold
  ORDER BY nc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
