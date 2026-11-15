begin;

alter table public.businesses
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists settings_version integer not null default 0;

alter table public.appointments
  add column if not exists request_key uuid,
  add column if not exists request_fingerprint text;
create unique index if not exists appointments_request_key_idx
  on public.appointments (business_id, request_key) where request_key is not null;

-- Owners update settings only through the authenticated backend.
revoke all on public.businesses from service_role;
grant select on public.businesses to service_role;
grant update (name, timezone, settings, settings_version)
  on public.businesses to service_role;
revoke all on public.businesses from public, anon, authenticated;

create table if not exists public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  conversation_id uuid not null,
  source text not null check (source in ('cloudflare', 'rules', 'fallback')),
  created_at timestamptz not null default now()
);
create index if not exists conversation_events_business_created_idx
  on public.conversation_events (business_id, created_at);
alter table public.conversation_events enable row level security;
revoke all on public.conversation_events from public, anon, authenticated;
revoke all on public.conversation_events from service_role;
grant select, insert on public.conversation_events to service_role;

-- Count events without copying customer messages or phone numbers.
create or replace function public.business_chat_stats(p_business_id uuid)
returns table (messages bigint, conversations bigint, fallback_messages bigint)
language sql stable security invoker set search_path = ''
as $$
  select count(*), count(distinct conversation_id),
    count(*) filter (where source = 'fallback')
  from public.conversation_events where business_id = p_business_id;
$$;
revoke all on function public.business_chat_stats(uuid) from public, anon, authenticated;
grant execute on function public.business_chat_stats(uuid) to service_role;

commit;
notify pgrst, 'reload schema';

select name, settings_version from public.businesses
where slug = 'pearl-dental-care';
