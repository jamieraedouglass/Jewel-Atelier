-- Give back a client link's AI question when the AI fails or times out (server only), like refund_ai_call for accounts.
create or replace function public.refund_link_ai_call(lid uuid)
returns void language sql security definer set search_path = public as $$
  update link_ai_usage set calls = calls - 1 where link_id = lid and day = current_date and calls > 0;
$$;
revoke all on function public.refund_link_ai_call(uuid) from public, anon, authenticated;
grant execute on function public.refund_link_ai_call(uuid) to service_role;
