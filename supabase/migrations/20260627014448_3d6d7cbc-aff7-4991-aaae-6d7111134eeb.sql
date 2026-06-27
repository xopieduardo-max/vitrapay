create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  last_message_at timestamptz not null default now(),
  unread_for_user int not null default 0,
  unread_for_admin int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_support_tickets_user on public.support_tickets(user_id, last_message_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets(status, last_message_at desc);
grant select, insert, update on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "users view own tickets" on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));
create policy "users create own tickets" on public.support_tickets for insert to authenticated with check (user_id = auth.uid());
create policy "users and admins update tickets" on public.support_tickets for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_support_messages_ticket on public.support_messages(ticket_id, created_at);
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
alter table public.support_messages enable row level security;
create policy "view messages of accessible tickets" on public.support_messages for select to authenticated using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role))));
create policy "send messages on accessible tickets" on public.support_messages for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role))));

create or replace function public.bump_support_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets
  set last_message_at = new.created_at,
      updated_at = now(),
      status = case when new.is_admin then 'pending' else 'open' end,
      unread_for_user = case when new.is_admin then unread_for_user + 1 else unread_for_user end,
      unread_for_admin = case when not new.is_admin then unread_for_admin + 1 else unread_for_admin end
  where id = new.ticket_id;
  return new;
end;
$$;
drop trigger if exists trg_bump_support_ticket on public.support_messages;
create trigger trg_bump_support_ticket after insert on public.support_messages for each row execute function public.bump_support_ticket();

create or replace function public.mark_support_ticket_read(_ticket_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  update public.support_tickets
  set unread_for_admin = case when v_is_admin then 0 else unread_for_admin end,
      unread_for_user = case when not v_is_admin and user_id = v_uid then 0 else unread_for_user end
  where id = _ticket_id and (user_id = v_uid or v_is_admin);
end;
$$;
grant execute on function public.mark_support_ticket_read(uuid) to authenticated;

alter publication supabase_realtime add table public.support_tickets;
alter publication supabase_realtime add table public.support_messages;