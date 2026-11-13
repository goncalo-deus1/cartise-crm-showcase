-- One lead per email (case-insensitive). Leads without an email are not affected.
create unique index if not exists leads_email_unique on public.leads (lower(email)) where email <> '';
