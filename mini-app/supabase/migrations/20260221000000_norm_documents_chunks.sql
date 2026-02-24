-- Normative base: documents + chunks with embeddings
CREATE TABLE IF NOT EXISTS norm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,            -- 'cntd' | 'gost' | 'minstroy'
  code text NOT NULL,              -- e.g. 'СП 28.13330.2017'
  title text NOT NULL,
  url text,
  category text,                   -- 'НВФ' | 'СПК' | 'алюминий' | 'общее'
  doc_type text,                   -- 'СП' | 'ГОСТ' | 'СТО' | 'СНиП' | 'МДС'
  status text DEFAULT 'pending',   -- 'pending' | 'parsed' | 'embedded' | 'error'
  raw_text text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source, code)
);

CREATE TABLE IF NOT EXISTS norm_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES norm_documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  section_title text,
  embedding vector(384),
  token_count int,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_norm_chunks_document ON norm_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_norm_chunks_embedding ON norm_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
CREATE INDEX IF NOT EXISTS idx_norm_documents_code ON norm_documents(code);
CREATE INDEX IF NOT EXISTS idx_norm_documents_category ON norm_documents(category);

-- RLS
ALTER TABLE norm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE norm_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "norm_documents_read" ON norm_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "norm_chunks_read" ON norm_chunks FOR SELECT TO authenticated USING (true);

-- Search function
CREATE OR REPLACE FUNCTION match_norm_chunks(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_category text DEFAULT NULL,
  filter_doc_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  section_title text,
  similarity float,
  doc_code text,
  doc_title text,
  doc_category text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.id,
    nc.document_id,
    nc.content,
    nc.section_title,
    1 - (nc.embedding <=> query_embedding) AS similarity,
    nd.code AS doc_code,
    nd.title AS doc_title,
    nd.category AS doc_category
  FROM norm_chunks nc
  JOIN norm_documents nd ON nd.id = nc.document_id
  WHERE nd.status = 'embedded'
    AND (filter_category IS NULL OR nd.category = filter_category)
    AND (filter_doc_type IS NULL OR nd.doc_type = filter_doc_type)
    AND 1 - (nc.embedding <=> query_embedding) > match_threshold
  ORDER BY nc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
