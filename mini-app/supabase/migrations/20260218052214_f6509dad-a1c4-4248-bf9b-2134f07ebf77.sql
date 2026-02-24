
-- Allow authenticated users to insert document_folders
CREATE POLICY "auth_insert_folders"
ON public.document_folders
FOR INSERT
WITH CHECK (true);
