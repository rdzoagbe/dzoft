-- Harden Data API function permissions while preserving the client portal's
-- explicitly required RPCs. Safe to re-run; it does not touch client data.
BEGIN;

-- New functions must be granted deliberately to the API roles that use them.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;

-- Remove current broad grants, including inherited PUBLIC execution.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Admin authorization check and public review listing.
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_reviews() TO anon, authenticated;

-- Capability-link portal RPCs. The token itself is the authorization check.
GRANT EXECUTE ON FUNCTION public.portal_get(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_message(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_validate(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_accept_signed(uuid, uuid, text, text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_review(uuid, uuid, integer, text, text, text, boolean) TO anon, authenticated;

-- Account-based client RPCs.
GRANT EXECUTE ON FUNCTION public.my_space() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_validate(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_accept_signed(uuid, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_review(uuid, integer, text, text, text, boolean) TO authenticated;

-- client_* helpers, portal_data, my_client, my_accept and portal_accept
-- intentionally remain unavailable through the Data API.
COMMIT;

