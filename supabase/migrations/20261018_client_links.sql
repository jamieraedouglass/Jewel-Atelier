-- Client links: the studio sends designs to clients as unguessable links. Clients don't sign in, so these tables are
-- only reached through the server (service role), which checks the link's token every time. Row-level security is on
-- with no policies, so nobody can read them directly with the public key.

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
