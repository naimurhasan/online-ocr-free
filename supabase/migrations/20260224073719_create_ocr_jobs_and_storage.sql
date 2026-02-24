-- OCR Jobs table
CREATE TABLE IF NOT EXISTS ocr_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending, processing, done, failed
  lang text NOT NULL DEFAULT 'eng+ben',
  engine text NOT NULL DEFAULT 'tesseract',
  options jsonb NOT NULL DEFAULT '{}',
  file_count int NOT NULL DEFAULT 0,
  files_processed int NOT NULL DEFAULT 0,
  error text,
  result_path text,                        -- path in ocr-results bucket
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_email ON ocr_jobs(email);

-- Job files table (tracks individual uploaded files per job)
CREATE TABLE IF NOT EXISTS ocr_job_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES ocr_jobs(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  storage_path text NOT NULL,              -- path in ocr-uploads bucket
  mimetype text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending, processing, done, failed
  result_text text,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocr_job_files_job ON ocr_job_files(job_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('ocr-uploads', 'ocr-uploads', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('ocr-results', 'ocr-results', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow service role full access (server-side only)
CREATE POLICY "Service role full access on ocr-uploads"
  ON storage.objects FOR ALL
  USING (bucket_id = 'ocr-uploads')
  WITH CHECK (bucket_id = 'ocr-uploads');

CREATE POLICY "Service role full access on ocr-results"
  ON storage.objects FOR ALL
  USING (bucket_id = 'ocr-results')
  WITH CHECK (bucket_id = 'ocr-results');
