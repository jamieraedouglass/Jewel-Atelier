-- What people correct after the photo reading: per group of stones, how many it found, how many were added or taken
-- away, and roughly where the added ones were. Counts and positions only, no photos. Read on the server (service
-- role) to tell future readings what tends to be missed.
create table if not exists public.reading_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  piece text not null default '',
  groups jsonb not null default '[]'::jsonb
);
alter table public.reading_corrections enable row level security;
create policy "insert own corrections" on public.reading_corrections for insert to authenticated with check (user_id = (select auth.uid()));
create index if not exists reading_corrections_created on public.reading_corrections (created_at desc);
