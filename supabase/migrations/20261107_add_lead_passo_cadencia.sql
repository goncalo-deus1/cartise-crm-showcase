-- How many outreach touches (email / LinkedIn / call) since the cadence (re)started.
-- Bumped atomically by the app; reset to 0 when the stage changes.
alter table public.leads add column if not exists passo_cadencia integer not null default 0 check (passo_cadencia >= 0);
