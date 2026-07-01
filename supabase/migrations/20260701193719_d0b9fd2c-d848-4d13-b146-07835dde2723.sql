CREATE TABLE public.prospector_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  niche TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days')
);
CREATE INDEX idx_prospector_cache_key ON public.prospector_cache(cache_key);
CREATE INDEX idx_prospector_cache_expires ON public.prospector_cache(expires_at);
GRANT ALL ON public.prospector_cache TO service_role;
ALTER TABLE public.prospector_cache ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (server-side) accesses this cache.