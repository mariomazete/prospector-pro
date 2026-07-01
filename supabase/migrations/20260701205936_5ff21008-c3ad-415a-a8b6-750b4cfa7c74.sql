
-- Drop old tables
DROP TABLE IF EXISTS public.lead_events CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TYPE IF EXISTS public.lead_status CASCADE;
DROP TYPE IF EXISTS public.timeline_kind CASCADE;

-- Enums
CREATE TYPE public.company_status AS ENUM (
  'never_prospected','prospecting','contacted','replied',
  'meeting','proposal','negotiating','client','lost','archived'
);

CREATE TYPE public.timeline_kind AS ENUM (
  'note','status_change','followup','call','email','whatsapp','meeting','pitch','discovery','update'
);

-- ============ COMPANIES (GLOBAL) ============
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  country TEXT,
  state TEXT,
  city TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  linkedin TEXT,
  email TEXT,
  maps_url TEXT,
  rating NUMERIC,
  reviews_count INTEGER,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  hours JSONB,
  utc_offset_minutes INTEGER,
  open_now BOOLEAN,
  opportunity_score INTEGER,
  conversion_chance INTEGER,
  temperature TEXT,
  ai_summary TEXT,
  attack_plan JSONB,
  pitches JSONB,
  reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_appearances INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX companies_country_idx ON public.companies (country);
CREATE INDEX companies_city_idx ON public.companies (city);
CREATE INDEX companies_category_idx ON public.companies (category);
CREATE INDEX companies_score_idx ON public.companies (opportunity_score DESC);

GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update companies" ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER companies_touch BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ USER COMPANY STATE ============
CREATE TABLE public.user_company_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status public.company_status NOT NULL DEFAULT 'never_prospected',
  in_pipeline BOOLEAN NOT NULL DEFAULT false,
  favorite BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  next_followup_at TIMESTAMPTZ,
  pipeline_added_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);
CREATE INDEX ucs_user_pipeline_idx ON public.user_company_state (user_id, in_pipeline);
CREATE INDEX ucs_user_status_idx ON public.user_company_state (user_id, status);
CREATE INDEX ucs_user_favorite_idx ON public.user_company_state (user_id, favorite);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_company_state TO authenticated;
GRANT ALL ON public.user_company_state TO service_role;
ALTER TABLE public.user_company_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ucs" ON public.user_company_state FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ucs_touch BEFORE UPDATE ON public.user_company_state
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COMPANY EVENTS (timeline per user) ============
CREATE TABLE public.company_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind public.timeline_kind NOT NULL,
  content TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ce_company_idx ON public.company_events (company_id, created_at DESC);
CREATE INDEX ce_user_idx ON public.company_events (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_events TO authenticated;
GRANT ALL ON public.company_events TO service_role;
ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company_events" ON public.company_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ COMPANY SEARCHES (append-only history) ============
CREATE TABLE public.company_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,
  niche TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  found_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cs_company_idx ON public.company_searches (company_id, found_at DESC);

GRANT SELECT, INSERT ON public.company_searches TO authenticated;
GRANT ALL ON public.company_searches TO service_role;
ALTER TABLE public.company_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read searches" ON public.company_searches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert searches" ON public.company_searches FOR INSERT TO authenticated WITH CHECK (true);
