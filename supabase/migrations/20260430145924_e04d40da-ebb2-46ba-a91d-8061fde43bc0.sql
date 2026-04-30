
-- Revoke public execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Re-grant has_role to authenticated only (used by RLS policies — needed)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Tighten dispatch_log policies: require authenticated user role check
DROP POLICY IF EXISTS "Staff insert dispatch" ON public.dispatch_log;
DROP POLICY IF EXISTS "Staff update dispatch" ON public.dispatch_log;

CREATE POLICY "Staff insert dispatch" ON public.dispatch_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Staff update dispatch" ON public.dispatch_log FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));
