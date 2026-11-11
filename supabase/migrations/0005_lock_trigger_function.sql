-- Trigger function tidak boleh dipanggil lewat /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
