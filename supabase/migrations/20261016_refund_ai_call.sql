create or replace function public.refund_ai_call(uid uuid)
returns void language sql security definer set search_path = public as $$
  update ai_usage set calls = calls - 1 where user_id = uid and day = current_date and calls > 0;
$$;
revoke all on function public.refund_ai_call(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_call(uuid) to service_role;
