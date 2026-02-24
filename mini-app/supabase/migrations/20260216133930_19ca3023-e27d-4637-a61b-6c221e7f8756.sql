
-- Create storage bucket for project documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-documents', 'project-documents', false, 20971520, ARRAY['application/pdf', 'image/png', 'image/jpeg']);

-- Storage policies
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete their documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-documents' AND auth.uid() IS NOT NULL);
