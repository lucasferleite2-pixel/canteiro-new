ALTER TABLE public.rdo_foto
  ADD COLUMN IF NOT EXISTS captured_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latitude            NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude           NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS accuracy_meters     NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS address             TEXT,
  ADD COLUMN IF NOT EXISTS weather_description TEXT,
  ADD COLUMN IF NOT EXISTS device_info         TEXT;
