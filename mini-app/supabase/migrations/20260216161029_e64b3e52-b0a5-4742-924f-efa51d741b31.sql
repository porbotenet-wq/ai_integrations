
-- Create storage bucket for photo reports
INSERT INTO storage.buckets (id, name, public) VALUES ('photo-reports', 'photo-reports', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can view photos
CREATE POLICY "Photo reports are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'photo-reports');

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload photo reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photo-reports');

-- RLS: authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete photo reports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'photo-reports');

-- Add photo_urls column to floors table if not exists
ALTER TABLE public.floors ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';

-- alerts already has no photo_urls, add it
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';

-- plan_fact already has photo_urls column
