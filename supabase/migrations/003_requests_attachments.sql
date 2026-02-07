-- =============================================
-- Migration 003: Attachments for requests
-- Ajoute le support pieces jointes aux demandes
-- Execute in Supabase Dashboard > SQL Editor
-- =============================================

-- Ajouter colonnes pour piece jointe
ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Creer le bucket storage (a executer dans Storage > New bucket aussi)
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-attachments', 'request-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: upload par service_role (via API route)
-- Le bucket est prive, les fichiers sont accedes via signed URLs
CREATE POLICY "Service role can manage attachments"
  ON storage.objects FOR ALL
  USING (bucket_id = 'request-attachments')
  WITH CHECK (bucket_id = 'request-attachments');
