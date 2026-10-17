-- Tidying from Supabase's own advisor:
-- 1. Visitors who aren't signed in can't call the daily AI counter (it only ever counted for a signed-in user anyway).
-- 2. Row rules ask "who is signed in?" once per query instead of once per row (same rules, faster as tables grow).
-- 3. Indexes for links between tables that had none.

revoke execute on function public.use_ai_call(integer) from anon, public;
grant execute on function public.use_ai_call(integer) to authenticated, service_role;

alter policy "see own usage" on public.ai_usage using (user_id = (select auth.uid()));
alter policy "own design chats" on public.design_chats using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and exists (select 1 from public.designs d where d.id = design_chats.design_id and d.owner = (select auth.uid())));
alter policy "delete own versions" on public.design_versions using (owner = (select auth.uid()));
alter policy "insert own versions" on public.design_versions
  with check (owner = (select auth.uid()) and exists (select 1 from public.designs d where d.id = design_versions.design_id and d.owner = (select auth.uid())));
alter policy "read own versions" on public.design_versions using (owner = (select auth.uid()));
alter policy "delete own designs" on public.designs using (owner = (select auth.uid()));
alter policy "insert own designs" on public.designs with check (owner = (select auth.uid()));
alter policy "read own or public designs" on public.designs using (is_public or owner = (select auth.uid()));
alter policy "update own designs" on public.designs using (owner = (select auth.uid()));
alter policy "own style profile" on public.style_profiles using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index if not exists client_versions_design_idx on public.client_versions(design_id);
create index if not exists design_chats_owner_idx on public.design_chats(owner);
create index if not exists design_versions_owner_idx on public.design_versions(owner);
