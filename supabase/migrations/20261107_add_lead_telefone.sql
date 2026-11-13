-- Phone number for calls / WhatsApp. Empty string = unknown (same convention as the other text columns).
alter table public.leads add column if not exists telefone text not null default '';
