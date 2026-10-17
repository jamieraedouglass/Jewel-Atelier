-- Jewel Atelier schema. Paste into Supabase → SQL Editor → Run.

-- Saved ring designs ---------------------------------------------------------
create table if not exists public.designs (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null default 'Untitled ring',
  data           jsonb not null,
  thumbnail_path text,
  is_public      boolean not null default false,  -- private until the owner shares a link
  status         text not null default 'idea' check (status in ('idea', 'workshop', 'made')), -- idea → in the workshop → made
  made_at        timestamptz,
  inventory      jsonb not null default '{}'::jsonb, -- made pieces: reference, weight, price, availability (see src/lib/inventory.ts)
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

-- Gives back one call when the request it paid for failed. Server only (service_role): not callable by people,
-- so nobody can refund their own calls to get past the limit. Also in supabase/migrations/20261016_refund_ai_call.sql.
create or replace function public.refund_ai_call(uid uuid)
returns void language sql security definer set search_path = public as $$
  update ai_usage set calls = calls - 1 where user_id = uid and day = current_date and calls > 0;
$$;
revoke all on function public.refund_ai_call(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_call(uuid) to service_role;

-- One style profile per person ------------------------------------------------
create table if not exists public.style_profiles (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  icons       text[] not null default '{}',      -- e.g. {"Sofia Richie Grainge","Grace Kelly"}
  notes       text not null default '',          -- free-text taste notes
  image_paths text[] not null default '{}',      -- inspiration photos in the "inspiration" bucket
  prefs       jsonb  not null default '{}'::jsonb, -- structured preferences: metals, gems, shapes, scale, sizes (see src/lib/style/profile.ts)
  applied     jsonb  not null default '[]'::jsonb, -- the last design suggestions they applied, newest first
  dismissed   jsonb  not null default '[]'::jsonb, -- suggestions they turned down, newest first
  photo_read     text not null default '',        -- Claude's written read of the inspiration photos
  photo_read_key text not null default '',        -- which photos that read was made from
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

-- Each saved design's conversation with the designer ------------------------------
create table if not exists public.design_chats (
  design_id  uuid primary key references public.designs(id) on delete cascade,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  messages   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.design_chats enable row level security;
create policy "own design chats" on public.design_chats for all
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from public.designs d where d.id = design_id and d.owner = auth.uid()));

-- Client links (the studio sends designs to clients): see supabase/migrations/20261018_client_links.sql

create table if not exists public.client_links (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,                      -- the secret in the link (32 random bytes)
  owner           uuid not null references auth.users(id) on delete cascade, -- the jeweller who sent it
  client_name     text not null default '',
  note            text not null default '',                  -- a message shown to the client
  design_ids      uuid[] not null,                           -- the pieces, in tab order
  allow           jsonb not null default '{}'::jsonb,        -- what the client may change (src/lib/studio/links.ts)
  ai_daily_limit  int not null default 20,
  expires_at      timestamptz,
  revoked         boolean not null default false,
  created_at      timestamptz not null default now(),
  last_opened_at  timestamptz
);
create index if not exists client_links_owner_idx on public.client_links(owner, created_at desc);

-- each client's own copy of each piece, and their conversation about it
create table if not exists public.client_versions (
  link_id    uuid not null references public.client_links(id) on delete cascade,
  design_id  uuid not null references public.designs(id) on delete cascade,
  data       jsonb not null,
  chat       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (link_id, design_id)
);

-- what happened on each link: opened, changed, tried on, compared, asked the designer, asked the jeweller
create table if not exists public.link_events (
  id        bigint generated always as identity primary key,
  link_id   uuid not null references public.client_links(id) on delete cascade,
  design_id uuid,
  kind      text not null,
  detail    jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);
create index if not exists link_events_link_idx on public.link_events(link_id, at desc);

create table if not exists public.link_ai_usage (
  link_id uuid not null references public.client_links(id) on delete cascade,
  day     date not null default current_date,
  calls   int not null default 0,
  primary key (link_id, day)
);

alter table public.client_links    enable row level security;
alter table public.client_versions enable row level security;
alter table public.link_events     enable row level security;
alter table public.link_ai_usage   enable row level security;

-- one AI call on a link, within its daily allowance (server only)
create or replace function public.use_link_ai_call(lid uuid, daily_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare used int;
begin
  insert into link_ai_usage (link_id, day, calls) values (lid, current_date, 1)
  on conflict (link_id, day) do update set calls = link_ai_usage.calls + 1
  where link_ai_usage.calls < daily_limit
  returning calls into used;
  return used is not null;
end $$;
revoke all on function public.use_link_ai_call(uuid, int) from public, anon, authenticated;
grant execute on function public.use_link_ai_call(uuid, int) to service_role;

-- Prices on client links: what the jeweller quotes for each piece (in rupees) and the currency the client sees them in.
-- See src/lib/studio/pricing.ts. Reached only through the server, like the rest of client_links.
alter table public.client_links add column if not exists pricing jsonb not null default '{}'::jsonb;

-- Give back a client link's AI question when the AI fails or times out (server only), like refund_ai_call for accounts.
create or replace function public.refund_link_ai_call(lid uuid)
returns void language sql security definer set search_path = public as $$
  update link_ai_usage set calls = calls - 1 where link_id = lid and day = current_date and calls > 0;
$$;
revoke all on function public.refund_link_ai_call(uuid) from public, anon, authenticated;
grant execute on function public.refund_link_ai_call(uuid) to service_role;

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
