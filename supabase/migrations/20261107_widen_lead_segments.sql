-- Allow the extra segments used by the new CRM (existing values stay valid).
-- Applied 2026-11-07 before any app code that writes the new values.
begin;
alter table public.leads drop constraint if exists leads_segmento_check;
alter table public.leads add constraint leads_segmento_check check (segmento = any (array[
  'marca_nacional','ginasio','clinica','clinica_dentaria','imobiliaria','agencia','frota',
  'educacao','oficina','bem_estar','outro'
]::text[]));
commit;
