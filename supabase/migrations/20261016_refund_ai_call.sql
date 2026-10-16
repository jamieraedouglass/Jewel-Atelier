-- Give back one AI call when the request it paid for failed (Claude errored or sent back something unusable).
-- Only the server may call this, with the service_role key: people can't refund their own calls to get past the limit.
create or replace function public.refund_ai_call(uid uuid)
returns void language sql security definer set search_path = public as $$
  update ai_usage set calls = calls - 1 where user_id = uid and day = current_date and calls > 0;
$$;
revoke all on function public.refund_ai_call(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_call(uuid) to service_role;
