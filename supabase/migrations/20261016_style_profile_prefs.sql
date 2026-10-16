-- Structured style preferences (metals, gems, shapes, scale, sizes…) and a short memory of the design suggestions
-- someone applied, so the design consultant can tune its advice to them.
alter table public.style_profiles add column if not exists prefs   jsonb not null default '{}'::jsonb;
alter table public.style_profiles add column if not exists applied jsonb not null default '[]'::jsonb;
