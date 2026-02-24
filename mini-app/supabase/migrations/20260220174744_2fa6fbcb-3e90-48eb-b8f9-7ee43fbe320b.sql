
-- Drop existing policies first
DROP POLICY IF EXISTS "norm_docs_manage" ON norm_documents;
DROP POLICY IF EXISTS "norm_docs_read" ON norm_documents;
DROP POLICY IF EXISTS "norm_chunks_manage" ON norm_chunks;
DROP POLICY IF EXISTS "norm_chunks_read" ON norm_chunks;

-- Drop existing tables (cascade to remove FK refs)
DROP TABLE IF EXISTS norm_chunks CASCADE;
DROP TABLE IF EXISTS norm_documents CASCADE;

-- Ensure vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create norm_documents with full schema
CREATE TABLE norm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  url text,
  category text,
  doc_type text,
  status text DEFAULT 'pending',
  raw_text text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source, code)
);

-- Create norm_chunks with 384 dims
CREATE TABLE norm_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES norm_documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  section_title text,
  embedding extensions.vector(384),
  token_count int,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_norm_chunks_document ON norm_chunks(document_id);
CREATE INDEX idx_norm_documents_code ON norm_documents(code);
CREATE INDEX idx_norm_documents_category ON norm_documents(category);

-- RLS
ALTER TABLE norm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE norm_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "norm_documents_read" ON norm_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "norm_chunks_read" ON norm_chunks FOR SELECT TO authenticated USING (true);

-- Note: IVFFlat index needs data first, will add after seeding
