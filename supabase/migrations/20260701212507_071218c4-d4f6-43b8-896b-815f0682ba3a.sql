DROP POLICY IF EXISTS "backend manage companies" ON public.companies;
DROP POLICY IF EXISTS "backend manage company searches" ON public.company_searches;
DROP POLICY IF EXISTS "backend manage prospector cache" ON public.prospector_cache;

CREATE POLICY "backend manage companies"
ON public.companies
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "backend manage company searches"
ON public.company_searches
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "backend manage prospector cache"
ON public.prospector_cache
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');