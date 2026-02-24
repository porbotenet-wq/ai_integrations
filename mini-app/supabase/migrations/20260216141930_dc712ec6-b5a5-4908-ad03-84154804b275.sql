
-- Allow anyone to insert projects (app uses PIN auth, not Supabase Auth)
CREATE POLICY "anyone_insert_projects"
ON public.projects
FOR INSERT
WITH CHECK (true);

-- Also allow anyone to update projects
CREATE POLICY "anyone_update_projects"
ON public.projects
FOR UPDATE
USING (true);

-- Allow anonymous uploads to project-documents bucket
CREATE POLICY "anyone_upload_project_docs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'project-documents');

-- Allow reading project documents
CREATE POLICY "anyone_read_project_docs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'project-documents');
