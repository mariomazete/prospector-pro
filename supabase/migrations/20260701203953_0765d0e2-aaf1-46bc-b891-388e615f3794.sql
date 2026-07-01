
-- Leads (CRM)
CREATE TYPE public.lead_status AS ENUM ('new','contacted','negotiating','won','lost');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id text NOT NULL,
  name text NOT NULL,
  category text,
  country text,
  city text,
  address text,
  phone text,
  website text,
  rating numeric,
  reviews_count int,
  maps_url text,
  status public.lead_status NOT NULL DEFAULT 'new',
  tags text[] NOT NULL DEFAULT '{}',
  next_followup_at timestamptz,
  notes text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own leads" ON public.leads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX leads_user_status_idx ON public.leads(user_id, status);
CREATE INDEX leads_next_followup_idx ON public.leads(user_id, next_followup_at);

-- Timeline
CREATE TYPE public.timeline_kind AS ENUM ('note','status_change','followup','call','email','whatsapp','meeting','pitch');

CREATE TABLE public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.timeline_kind NOT NULL,
  content text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_events TO authenticated;
GRANT ALL ON public.lead_events TO service_role;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON public.lead_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX lead_events_lead_idx ON public.lead_events(lead_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
