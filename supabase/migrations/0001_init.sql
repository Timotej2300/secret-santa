-- SECRET SANTA – úvodná schéma
create extension if not exists pgcrypto;

-- ENUMy
create type system_role as enum ('owner', 'system_admin', 'support', 'organizer');
create type group_status as enum ('draft', 'registration_open', 'registration_closed', 'drawn', 'archived');
create type draw_status as enum ('not_drawn', 'drawn', 'needs_redraw');
create type participant_status as enum ('invited', 'registered', 'left', 'removed');
create type delivery_method as enum ('in_person', 'address', 'via_person');
create type gift_state as enum ('pending', 'awaiting_confirmation', 'confirmed', 'problem');
create type email_status as enum ('sent', 'delivered', 'opened', 'registered', 'expired', 'failed');
create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type ticket_type as enum ('gift', 'organizer', 'registration', 'login', 'technical', 'other');

-- Pomocné
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- PROFILES
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

-- SYSTEM ROLES (zapisuje iba service role)
create table system_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role system_role not null,
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create unique index only_one_owner on system_roles (role) where role = 'owner';
create index system_roles_user_idx on system_roles(user_id);

-- GROUPS
create table groups (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references profiles(id),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  max_participants int not null default 20 check (max_participants between 4 and 30),
  min_gift_value numeric(8,2) not null default 15 check (min_gift_value >= 0),
  gift_deadline timestamptz,
  rules text not null default '',
  status group_status not null default 'registration_open',
  draw_status draw_status not null default 'not_drawn',
  draw_round int not null default 0,
  drawn_at timestamptz,
  phone_required boolean not null default false,
  delivery_locked boolean not null default false,
  organizer_participates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index groups_organizer_idx on groups(organizer_id);
create trigger groups_updated before update on groups for each row execute function set_updated_at();

create table group_settings (
  group_id uuid primary key references groups(id) on delete cascade,
  registration_enabled boolean not null default true,
  notify_on_rules_change boolean not null default true,
  reminder_days_before int not null default 3 check (reminder_days_before between 0 and 30),
  reminder_sent_at timestamptz
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'organizer' check (role in ('organizer')),
  primary key (group_id, user_id)
);

create table group_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index group_qr_group_idx on group_qr_tokens(group_id);

-- PARTICIPANTS
create table participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  email text not null,
  phone text,
  status participant_status not null default 'invited',
  source text not null default 'manual' check (source in ('manual', 'qr', 'organizer_self')),
  gift_value_confirmed_at timestamptz,
  leave_requested_at timestamptz,
  registered_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index participants_group_email_active on participants (group_id, lower(email)) where status in ('invited', 'registered');
create index participants_group_idx on participants(group_id);
create index participants_user_idx on participants(user_id);

-- INVITATIONS (iba hash tokenu)
create table invitations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  organizer_user_id uuid references profiles(id) on delete cascade,
  email text not null,
  kind text not null default 'participant' check (kind in ('participant', 'organizer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  email_status email_status not null default 'sent',
  resend_message_id text,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  check (participant_id is not null or organizer_user_id is not null)
);
create index invitations_participant_idx on invitations(participant_id);
create index invitations_msg_idx on invitations(resend_message_id);

-- ASSIGNMENTS (iba server / service role)
create table assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  round int not null,
  giver_id uuid not null references participants(id) on delete cascade,
  receiver_id uuid not null references participants(id) on delete cascade,
  is_active boolean not null default true,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  check (giver_id <> receiver_id)
);
create unique index assignments_active_giver on assignments (group_id, giver_id) where is_active;
create unique index assignments_active_receiver on assignments (group_id, receiver_id) where is_active;
create index assignments_group_idx on assignments(group_id);

-- WISHLISTS
create table wishlists (
  participant_id uuid primary key references participants(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text,
  url text check (url is null or url ~* '^https?://'),
  image_url text check (image_url is null or image_url ~* '^https://'),
  note text,
  clothing_size text,
  favorite_color text,
  created_at timestamptz not null default now()
);
create index wishlist_items_participant_idx on wishlist_items(participant_id);

-- DELIVERY (súkromné)
create table delivery_details (
  participant_id uuid primary key references participants(id) on delete cascade,
  method delivery_method not null,
  note text,
  meeting_place text,
  address_line text,
  city text,
  postal_code text,
  country text,
  via_person_name text,
  updated_at timestamptz not null default now()
);
create trigger delivery_updated before update on delivery_details for each row execute function set_updated_at();

-- GIFTS
create table gift_statuses (
  assignment_id uuid primary key references assignments(id) on delete cascade,
  status gift_state not null default 'pending',
  given_at timestamptz,
  given_late boolean not null default false,
  received_at timestamptz,
  problem_note text,
  updated_at timestamptz not null default now()
);
create trigger gift_statuses_updated before update on gift_statuses for each row execute function set_updated_at();

create table gift_confirmations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  kind text not null check (kind in ('given', 'received')),
  confirmed_by uuid not null references profiles(id),
  confirmed_at timestamptz not null default now(),
  unique (assignment_id, kind)
);

-- SUPPORT
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  type ticket_type not null,
  subject text not null check (char_length(subject) between 3 and 140),
  description text not null check (char_length(description) between 3 and 4000),
  status ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on support_tickets(user_id);
create trigger tickets_updated before update on support_tickets for each row execute function set_updated_at();

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on support_messages(ticket_id);

-- LOGY
create table email_logs (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  group_id uuid references groups(id) on delete set null,
  status text not null default 'sent',
  error text,
  resend_message_id text,
  created_at timestamptz not null default now()
);
create index email_logs_group_idx on email_logs(group_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  group_id uuid references groups(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs(created_at desc);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);

-- Trigger: nový auth user -> profil (bez roly)
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, first_name, last_name, phone)
  values (new.id, lower(new.email),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Transakčné losovanie: jeden uzavretý cyklus (A->B->C->...->A)
create or replace function apply_draw(p_group uuid, p_order uuid[], p_actor uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := coalesce(array_length(p_order, 1), 0);
  v_round int;
  v_cap int;
  v_cnt int;
  i int;
  v_assign uuid;
begin
  select max_participants, draw_round into v_cap, v_round from groups where id = p_group for update;
  if not found then raise exception 'group_not_found'; end if;
  if n < 4 then raise exception 'min_4_participants'; end if;
  if n % 2 <> 0 then raise exception 'odd_participants'; end if;
  if n > v_cap then raise exception 'over_capacity'; end if;
  if (select count(distinct x) from unnest(p_order) x) <> n then raise exception 'duplicate_ids'; end if;

  select count(*) into v_cnt from participants
    where group_id = p_group and status = 'registered' and id = any(p_order);
  if v_cnt <> n then raise exception 'invalid_participants'; end if;
  if (select count(*) from participants where group_id = p_group and status = 'registered') <> n then
    raise exception 'participant_set_mismatch';
  end if;

  update assignments set is_active = false where group_id = p_group and is_active;
  v_round := v_round + 1;

  for i in 1..n loop
    insert into assignments (group_id, round, giver_id, receiver_id)
    values (p_group, v_round, p_order[i], p_order[(i % n) + 1])
    returning id into v_assign;
    insert into gift_statuses (assignment_id) values (v_assign);
  end loop;

  update groups set draw_round = v_round, draw_status = 'drawn', status = 'drawn', drawn_at = now() where id = p_group;
  insert into audit_logs (actor_id, action, entity, entity_id, group_id, meta)
    values (p_actor, 'draw.performed', 'group', p_group::text, p_group, jsonb_build_object('round', v_round, 'count', n));
  return v_round;
end $$;
revoke all on function apply_draw(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function apply_draw(uuid, uuid[], uuid) to service_role;

-- Rate limit (atomické)
create or replace function check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  h int;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into h;
  delete from rate_limits where window_start < now() - interval '1 day';
  return h <= p_max;
end $$;
revoke all on function check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function check_rate_limit(text, int, int) to service_role;

-- Pomocné funkcie pre RLS
create or replace function has_system_role(r system_role[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from system_roles where user_id = auth.uid() and role = any(r));
$$;
create or replace function is_group_organizer(g uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = g and organizer_id = auth.uid())
      or exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;
create or replace function my_participant_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select id from participants where user_id = auth.uid() and status in ('invited', 'registered');
$$;

-- RLS
alter table profiles enable row level security;
alter table system_roles enable row level security;
alter table groups enable row level security;
alter table group_settings enable row level security;
alter table group_members enable row level security;
alter table group_qr_tokens enable row level security;
alter table participants enable row level security;
alter table invitations enable row level security;
alter table assignments enable row level security;
alter table wishlists enable row level security;
alter table wishlist_items enable row level security;
alter table delivery_details enable row level security;
alter table gift_statuses enable row level security;
alter table gift_confirmations enable row level security;
alter table support_tickets enable row level security;
alter table support_messages enable row level security;
alter table email_logs enable row level security;
alter table audit_logs enable row level security;
alter table rate_limits enable row level security;

-- profiles: vlastný profil, bez zmeny citlivých polí cez klienta
create policy profiles_self_select on profiles for select using (id = auth.uid() or has_system_role(array['owner','system_admin','support']::system_role[]));
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (first_name, last_name, phone) on profiles to authenticated;

-- system_roles: čítať vlastné; zápis iba service role
create policy roles_self_select on system_roles for select using (user_id = auth.uid() or has_system_role(array['owner','system_admin']::system_role[]));

-- groups
create policy groups_select on groups for select using (
  is_group_organizer(id)
  or exists (select 1 from participants p where p.group_id = groups.id and p.user_id = auth.uid() and p.status = 'registered')
  or has_system_role(array['owner','system_admin']::system_role[])
);
create policy groups_org_update on groups for update using (is_group_organizer(id) and draw_status <> 'drawn' or has_system_role(array['owner']::system_role[]));

create policy group_settings_select on group_settings for select using (is_group_organizer(group_id) or has_system_role(array['owner','system_admin']::system_role[]));
create policy group_members_select on group_members for select using (user_id = auth.uid() or is_group_organizer(group_id));
create policy qr_select on group_qr_tokens for select using (is_group_organizer(group_id) or has_system_role(array['owner']::system_role[]));

-- participants: ostatní účastníci nevidia emaily/telefóny
create policy participants_select on participants for select using (
  user_id = auth.uid() or is_group_organizer(group_id) or has_system_role(array['owner','system_admin']::system_role[])
);

create policy invitations_select on invitations for select using (
  exists (select 1 from participants p where p.id = participant_id and is_group_organizer(p.group_id))
  or has_system_role(array['owner']::system_role[])
);

-- assignments / gift_confirmations / rate_limits: žiadna klientska politika (iba server)

-- wishlist
create policy wishlists_own on wishlists for all using (participant_id in (select my_participant_ids())) with check (participant_id in (select my_participant_ids()));
create policy wishlist_items_own on wishlist_items for all using (participant_id in (select my_participant_ids())) with check (participant_id in (select my_participant_ids()));

-- delivery: vlastné údaje; čítanie darcom/organizátorom ide cez server
create policy delivery_own on delivery_details for all using (participant_id in (select my_participant_ids())) with check (participant_id in (select my_participant_ids()));
create policy delivery_org_select on delivery_details for select using (
  exists (select 1 from participants p where p.id = participant_id and is_group_organizer(p.group_id))
  or has_system_role(array['owner']::system_role[])
);

create policy gifts_select on gift_statuses for select using (
  exists (select 1 from assignments a where a.id = assignment_id and (
    a.giver_id in (select my_participant_ids()) or a.receiver_id in (select my_participant_ids()) or is_group_organizer(a.group_id)))
  or has_system_role(array['owner']::system_role[])
);

-- support
create policy tickets_select on support_tickets for select using (user_id = auth.uid() or has_system_role(array['owner','system_admin','support']::system_role[]));
create policy tickets_insert on support_tickets for insert with check (user_id = auth.uid());
create policy tmsg_select on support_messages for select using (
  exists (select 1 from support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or has_system_role(array['owner','system_admin','support']::system_role[])))
);
create policy tmsg_insert on support_messages for insert with check (
  author_id = auth.uid() and exists (select 1 from support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or has_system_role(array['owner','system_admin','support']::system_role[])))
);

-- logy: čítanie iba owner / admin
create policy email_logs_select on email_logs for select using (has_system_role(array['owner','system_admin']::system_role[]));
create policy audit_select on audit_logs for select using (has_system_role(array['owner','system_admin']::system_role[]));
