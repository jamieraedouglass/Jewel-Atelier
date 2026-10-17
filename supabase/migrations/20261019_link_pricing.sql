alter table public.client_links add column if not exists pricing jsonb not null default '{}'::jsonb;
