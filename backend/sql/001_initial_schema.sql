begin;
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'Asia/Karachi',
  is_demo boolean not null default true
);
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 100),
  phone text not null check (char_length(trim(phone)) between 7 and 30),
  service text not null check (char_length(trim(service)) between 1 and 100),
  preferred_date date not null,
  preferred_time time not null,
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'New' check (status in ('New','Contacted','Confirmed','Completed','Cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists appointments_business_created_idx on public.appointments (business_id, created_at desc);
alter table public.businesses enable row level security;
alter table public.appointments enable row level security;
revoke all on public.businesses, public.appointments from public, anon, authenticated;
grant select on public.businesses to service_role;
grant select, insert, update on public.appointments to service_role;
insert into public.businesses (slug,name) values ('pearl-dental-care','Pearl Dental Care, Karachi') on conflict (slug) do nothing;
commit;
