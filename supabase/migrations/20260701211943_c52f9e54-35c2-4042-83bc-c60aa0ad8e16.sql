DROP POLICY IF EXISTS "auth insert companies" ON public.companies;
DROP POLICY IF EXISTS "auth update companies" ON public.companies;
DROP POLICY IF EXISTS "auth insert searches" ON public.company_searches;

CREATE POLICY "auth insert valid companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND place_id IS NOT NULL AND name IS NOT NULL);

CREATE POLICY "auth update valid companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL AND place_id IS NOT NULL AND name IS NOT NULL);

CREATE POLICY "auth insert own or anonymous searches"
ON public.company_searches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.prospector_cache TO authenticated;
GRANT ALL ON public.prospector_cache TO service_role;

CREATE POLICY "auth read active cache"
ON public.prospector_cache
FOR SELECT
TO authenticated
USING (expires_at > now());

CREATE POLICY "auth insert valid cache"
ON public.prospector_cache
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND cache_key IS NOT NULL);

CREATE POLICY "auth update valid cache"
ON public.prospector_cache
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL AND cache_key IS NOT NULL);