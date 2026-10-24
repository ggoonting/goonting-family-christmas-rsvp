create extension if not exists pgcrypto;

create type public.family_member_kind as enum ('primary', 'spouse', 'child', 'infant');
create type public.rsvp_status as enum ('pending', 'yes', 'no');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code_hash text not null unique,
  meal_note text not null default '' check (char_length(meal_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind public.family_member_kind not null,
  infant_details text,
  rsvp public.rsvp_status not null default 'pending',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint infant_details_only_for_infants check (kind = 'infant' or infant_details is null)
);

create index household_members_household_id_idx on public.household_members(household_id, sort_order);
alter table public.households enable row level security;
alter table public.household_members enable row level security;
-- No anon/authenticated table policies: the Edge Function is the only public interface.

create or replace function public.touch_household_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger households_touch_updated_at before update on public.households
for each row execute function public.touch_household_updated_at();

-- Generate a household invite code in a trusted admin environment, then store
-- encode(digest(lower(code), 'sha256'), 'hex') in invite_code_hash.
