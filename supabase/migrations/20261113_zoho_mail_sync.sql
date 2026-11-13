-- Zoho Mail → CRM sync (see src/app/api/cron/zoho/route.ts).

-- Which Zoho email a stored message came from; one row per (lead, email).
alter table public.messages add column if not exists zoho_id text;
create unique index if not exists messages_lead_zoho_unique on public.messages (lead_id, zoho_id);

-- Per-mailbox progress. Only the service role (the sync job) touches it: RLS on, no policies.
create table if not exists public.mail_sync (
  mailbox text primary key,
  cursor_ms bigint not null,
  locked_until timestamptz,
  last_run_at timestamptz,
  last_result jsonb
);
alter table public.mail_sync enable row level security;

-- No seed row: the first sync run creates it and starts from "now" (no backfill).

-- Shared token between the scheduler and the endpoint, generated here and kept in Vault:
-- it never appears in code, chat or Vercel.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'mail_sync_token')
where not exists (select 1 from vault.secrets where name = 'mail_sync_token');

create or replace function public.mail_sync_token_ok(token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'mail_sync_token' and decrypted_secret = token
  );
$$;
revoke all on function public.mail_sync_token_ok(text) from public, anon, authenticated;
grant execute on function public.mail_sync_token_ok(text) to service_role;

-- Every 10 minutes (point the URL at your deployment).
-- select cron.schedule('zoho-mail-sync', '*/10 * * * *', $cron$
--   select net.http_get(
--     url := 'https://cartise-crm.vercel.app/api/cron/zoho',
--     headers := jsonb_build_object('Authorization', 'Bearer ' ||
--       (select decrypted_secret from vault.decrypted_secrets where name = 'mail_sync_token')),
--     timeout_milliseconds := 60000
--   );
-- $cron$);

-- Morning email, 8:30 Lisbon all year: runs at 7:30 and 8:30 UTC, the route sends only
-- when it's 8h in Lisbon. Same Vault token as the mail sync.
-- select cron.schedule('daily-digest', '30 7,8 * * *', $cron$
--   select net.http_get(
--     url := 'https://cartise-crm.vercel.app/api/cron/digest',
--     headers := jsonb_build_object('Authorization', 'Bearer ' ||
--       (select decrypted_secret from vault.decrypted_secrets where name = 'mail_sync_token')),
--     timeout_milliseconds := 60000
--   );
-- $cron$);
