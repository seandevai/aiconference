-- Metadati soli (ADR-0001). Nessuna colonna contiene contenuto di riunione.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  -- Solo 'free' nell'MVP: gli altri piani arrivano con Stripe (spec §6).
  plan text not null default 'free' check (plan in ('free')),
  -- Cache del saldo: la verità sarà credit_ledger (slice 4). Si parte da zero.
  credits_balance integer not null default 0 check (credits_balance >= 0),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- Una policy su workspace_members che interroga workspace_members va in ricorsione.
-- La funzione security definer legge senza RLS e spezza il ciclo.
create function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "user reads own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "user updates own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "member reads own workspaces"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

-- Nessuna policy di update su workspaces: piano e crediti li cambia solo il service role.

create policy "member reads memberships of own workspaces"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Alla registrazione: profilo, workspace personale, membership owner.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  insert into public.workspaces (name, owner_id)
  values ('Il mio workspace', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
