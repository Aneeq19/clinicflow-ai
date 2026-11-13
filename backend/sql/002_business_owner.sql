begin;

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  primary key (business_id, user_id)
);

alter table public.business_members enable row level security;

revoke all on public.business_members from public, anon, authenticated;
grant select on public.business_members to service_role;

-- Replace YOUR_OWNER_EMAIL with the email of your created Supabase Auth user.
insert into public.business_members (business_id, user_id, role)
select business.id, auth_user.id, 'owner'
from public.businesses as business
cross join auth.users as auth_user
where business.slug = 'pearl-dental-care'
  and lower(auth_user.email) = lower('YOUR_OWNER_EMAIL')
on conflict (business_id, user_id) do nothing;

commit;

select business.name, member.role
from public.business_members as member
join public.businesses as business on business.id = member.business_id
join auth.users as auth_user on auth_user.id = member.user_id
where business.slug = 'pearl-dental-care'
  and lower(auth_user.email) = lower('YOUR_OWNER_EMAIL');
