CREATE OR REPLACE FUNCTION public.debug_auth_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.role();
$$;

GRANT EXECUTE ON FUNCTION public.debug_auth_role() TO anon, authenticated, service_role;