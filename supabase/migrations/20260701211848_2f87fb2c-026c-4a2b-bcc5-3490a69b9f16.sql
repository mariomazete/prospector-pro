GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

GRANT SELECT, INSERT ON public.company_searches TO authenticated;
GRANT ALL ON public.company_searches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_company_state TO authenticated;
GRANT ALL ON public.user_company_state TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_events TO authenticated;
GRANT ALL ON public.company_events TO service_role;