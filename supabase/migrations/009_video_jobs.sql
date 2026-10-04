-- Video generation jobs queue.
-- Vercel API writes jobs here; a persistent worker (VM) polls and processes them.

CREATE TABLE IF NOT EXISTS video_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  step TEXT NOT NULL DEFAULT 'Queued…',
  elapsed_sec INT NOT NULL DEFAULT 0,
  estimated_sec_total INT NOT NULL DEFAULT 60,
  params JSONB NOT NULL DEFAULT '{}',
  video_url TEXT,
  duration_sec FLOAT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status, created_at);

-- Enable RLS
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own video jobs"
  ON video_jobs FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Service role bypasses RLS for worker updates
