-- Create a storage bucket for business logos (if it doesn't exist yet)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152, -- 2MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop policies if they exist so we can recreate them safely
DROP POLICY IF EXISTS "Users can upload their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Logos are publicly readable" ON storage.objects;

-- RLS: Allow authenticated users to upload/update their own logo
CREATE POLICY "Users can upload their own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to read logos (they appear on public invoices/quotes)
CREATE POLICY "Logos are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');
