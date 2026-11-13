-- Who on the team owns (will contact) each lead. Null = unassigned.
alter table public.leads add column if not exists responsavel text references public.team_members(email) on update cascade on delete set null;
create index if not exists leads_responsavel_idx on public.leads (responsavel);
