alter table public.designs add column if not exists status    text not null default 'idea' check (status in ('idea', 'workshop', 'made'));
alter table public.designs add column if not exists made_at   timestamptz;
alter table public.designs add column if not exists inventory jsonb not null default '{}'::jsonb;
create index if not exists designs_owner_status_idx on public.designs(owner, status);

alter table public.style_profiles add column if not exists dismissed      jsonb not null default '[]'::jsonb;
alter table public.style_profiles add column if not exists photo_read     text  not null default '';
alter table public.style_profiles add column if not exists photo_read_key text  not null default '';

create table if not exists public.design_chats (
  design_id  uuid primary key references public.designs(id) on delete cascade,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  messages   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.design_chats enable row level security;
drop policy if exists "own design chats" on public.design_chats;
create policy "own design chats" on public.design_chats for all
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from public.designs d where d.id = design_id and d.owner = auth.uid()));
