alter table public.style_profiles add column if not exists prefs   jsonb not null default '{}'::jsonb;
alter table public.style_profiles add column if not exists applied jsonb not null default '[]'::jsonb;
