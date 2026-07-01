CREATE POLICY "backend manage companies"
ON public.companies
FOR ALL
TO service_role
USING (current_user = 'service_role')
WITH CHECK (current_user = 'service_role');

CREATE POLICY "backend manage company searches"
ON public.company_searches
FOR ALL
TO service_role
USING (current_user = 'service_role')
WITH CHECK (current_user = 'service_role');

CREATE POLICY "backend manage prospector cache"
ON public.prospector_cache
FOR ALL
TO service_role
USING (current_user = 'service_role')
WITH CHECK (current_user = 'service_role');