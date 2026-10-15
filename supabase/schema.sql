-- Jewel Atelier schema. Paste into Supabase → SQL Editor → Run.

-- Saved ring designs ---------------------------------------------------------
create table if not exists public.designs (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null default 'Untitled ring',
  data           jsonb not null,
  thumbnail_path text,
  is_public      boolean not null default false,  -- private until the owner shares a link
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists designs_owner_idx on public.designs(owner, updated_at desc);

alter table public.designs enable row level security;
create policy "read own or public designs" on public.designs for select using (is_public or owner = auth.uid());
create policy "insert own designs" on public.designs for insert with check (owner = auth.uid());
create policy "update own designs" on public.designs for update using (owner = auth.uid());
create policy "delete own designs" on public.designs for delete using (owner = auth.uid());

-- Daily AI usage per person (stone analysis + design chat) ------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  calls   int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy "see own usage" on public.ai_usage for select using (user_id = auth.uid());

-- Atomically counts one AI call for the signed-in user; returns false once today's limit is reached.
create or replace function public.use_ai_call(daily_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare used int;
begin
  insert into ai_usage (user_id, day, calls) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set calls = ai_usage.calls + 1
  where ai_usage.calls < daily_limit
  returning calls into used;
  return used is not null;
end $$;
revoke all on function public.use_ai_call(int) from public;
grant execute on function public.use_ai_call(int) to authenticated;

-- One style profile per person ------------------------------------------------
create table if not exists public.style_profiles (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  icons       text[] not null default '{}',      -- e.g. {"Sofia Richie Grainge","Grace Kelly"}
  notes       text not null default '',          -- free-text taste notes
  image_paths text[] not null default '{}',      -- inspiration photos in the "inspiration" bucket
  updated_at  timestamptz not null default now()
);
alter table public.style_profiles enable row level security;
create policy "own style profile" on public.style_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage buckets --------------------------------------------------------------
-- stones:      private stone photos / video frames sent for analysis
-- inspiration: private style photos
-- thumbnails:  public renders shown in galleries and share links
insert into storage.buckets (id, name, public) values
  ('stones', 'stones', false),
  ('inspiration', 'inspiration', false),
  ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Each person may only write inside a folder named with their user id: <uid>/file.jpg
create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('stones','inspiration','thumbnails') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own files" on storage.objects for update to authenticated
  using (bucket_id in ('stones','inspiration','thumbnails') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('stones','inspiration','thumbnails') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own private files" on storage.objects for select to authenticated
  using (bucket_id in ('stones','inspiration','thumbnails') and (storage.foldername(name))[1] = auth.uid()::text);

-- Saved versions of each design (every save keeps a copy; newest 40 kept) ---------
create table if not exists public.design_versions (
  id         uuid primary key default gen_random_uuid(),
  design_id  uuid not null references public.designs(id) on delete cascade,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists design_versions_idx on public.design_versions(design_id, created_at desc);
alter table public.design_versions enable row level security;
create policy "read own versions" on public.design_versions for select using (owner = auth.uid());
create policy "insert own versions" on public.design_versions for insert with check (owner = auth.uid() and exists (select 1 from public.designs d where d.id = design_id and d.owner = auth.uid()));
create policy "delete own versions" on public.design_versions for delete using (owner = auth.uid());
