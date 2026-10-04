-- Per-user cloud library: each user's generated files (voiceovers, images, QR codes, PDFs, videos)
-- RLS ensures users can only see/manage their own files.

CREATE TABLE IF NOT EXISTS user_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('voiceover', 'qr', 'image', 'pdf', 'video')),
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-user listing
CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_kind ON user_library(user_id, kind);

-- Enable RLS
ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;

-- Users can only read their own files
CREATE POLICY "Users can view own library"
  ON user_library FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own files
CREATE POLICY "Users can add to own library"
  ON user_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "Users can delete own library items"
  ON user_library FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for user files (create via Supabase dashboard or API)
-- Bucket name: user-library
-- Policies: authenticated users can upload/read/delete their own folder (user_id/filename)
