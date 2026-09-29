create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 120),
  join_code text not null unique,
  status text not null default 'created'
    check (status in ('created', 'active', 'closing', 'closed', 'purged')),
  -- Valorizzato = «offro io» attivo: tetto di crediti per ospite (spec §2.6, slice 7).
  guest_credit_cap integer check (guest_credit_cap is null or guest_credit_cap >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_status_started_at_idx on public.rooms (status, started_at);

create table public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  -- Null = ospite senza account.
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('host', 'guest')),
  display_name text not null check (char_length(display_name) between 1 and 40),
  language text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration_seconds integer
);

create index room_participants_room_id_idx on public.room_participants (room_id);
create unique index room_participants_one_host_idx
  on public.room_participants (room_id) where role = 'host';

alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;

create policy "member reads rooms of own workspaces"
  on public.rooms for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "member creates rooms in own workspaces"
  on public.rooms for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_workspace_member(workspace_id)
    and status = 'created'
    and guest_credit_cap is null
  );

-- Nessuna policy di update/delete su rooms: gli stati li cambia il server (service role).

create policy "member reads participants of own workspace rooms"
  on public.room_participants for select to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_participants.room_id and public.is_workspace_member(r.workspace_id)
    )
  );

-- Nessuna policy di insert/update su room_participants: l'ingresso passa dal server.
