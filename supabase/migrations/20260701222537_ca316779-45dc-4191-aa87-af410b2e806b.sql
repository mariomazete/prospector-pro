CREATE TABLE public.search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  place_ids TEXT[] NOT NULL DEFAULT '{}',
  result_count INT NOT NULL DEFAULT 0,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX search_history_user_query_uniq
  ON public.search_history (user_id, niche, country, COALESCE(city, ''));
CREATE INDEX search_history_user_recent_idx
  ON public.search_history (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_history TO authenticated;
GRANT ALL ON public.search_history TO service_role;

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own search history"
  ON public.search_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER search_history_touch_updated_at
  BEFORE UPDATE ON public.search_history
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();