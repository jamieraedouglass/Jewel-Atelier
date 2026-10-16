-- Prices on client links: what the jeweller quotes for each piece (in rupees) and the currency the client sees them in.
-- See src/lib/studio/pricing.ts. Reached only through the server, like the rest of client_links.
alter table public.client_links add column if not exists pricing jsonb not null default '{}'::jsonb;
