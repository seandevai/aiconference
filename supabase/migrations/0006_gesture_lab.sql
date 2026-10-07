-- Laboratorio gesture su staging (spec 2026-10-06). Dati di prova dello strumento:
-- landmark numerici della mano e testo scritto dall'admin. Mai immagini, audio, stanze o
-- riunioni (regola 1).

create table public.gesture_lab_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Nessuna policy: la tabella la toccano solo il SQL editor e il service role.
alter table public.gesture_lab_admins enable row level security;

create function public.is_gesture_lab_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.gesture_lab_admins where user_id = auth.uid());
$$;

revoke execute on function public.is_gesture_lab_admin() from public, anon;
grant execute on function public.is_gesture_lab_admin() to authenticated;

create table public.gesture_recordings (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  label text not null check (char_length(label) between 1 and 60),
  expect text check (
    expect is null or expect in (
      'GESTURES_TOGGLE', 'AGENT_ACTIVATE', 'CONFIRM', 'REJECT', 'FOCUS_NEXT', 'FOCUS_PREV',
      'WINDOW_ARCHIVE', 'WINDOW_CREATE', 'GRAB', 'MOVE', 'DROP'
    )
  ),
  description text not null default '' check (char_length(description) <= 500),
  armed boolean not null,
  -- octet_length sul testo, non pg_column_size: quest'ultimo misura il dato compresso.
  frames jsonb not null check (
    jsonb_typeof(frames) = 'array' and octet_length(frames::text) <= 1048576
  ),
  created_at timestamptz not null default now()
);

create index gesture_recordings_created_idx on public.gesture_recordings (created_at desc);

create table public.gesture_lab_presets (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  name text not null check (char_length(name) between 1 and 60),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now()
);

create index gesture_lab_presets_created_idx on public.gesture_lab_presets (created_at desc);

alter table public.gesture_recordings enable row level security;
alter table public.gesture_lab_presets enable row level security;

-- Leggono e scrivono solo gli admin del laboratorio; si scrive solo a proprio nome,
-- si elimina solo il proprio. Nessun update.
create policy "lab admins read recordings"
  on public.gesture_recordings for select to authenticated
  using (public.is_gesture_lab_admin());

create policy "lab admins add own recordings"
  on public.gesture_recordings for insert to authenticated
  with check (public.is_gesture_lab_admin() and author_id = auth.uid());

create policy "lab admins delete own recordings"
  on public.gesture_recordings for delete to authenticated
  using (public.is_gesture_lab_admin() and author_id = auth.uid());

create policy "lab admins read presets"
  on public.gesture_lab_presets for select to authenticated
  using (public.is_gesture_lab_admin());

create policy "lab admins add own presets"
  on public.gesture_lab_presets for insert to authenticated
  with check (public.is_gesture_lab_admin() and author_id = auth.uid());

create policy "lab admins delete own presets"
  on public.gesture_lab_presets for delete to authenticated
  using (public.is_gesture_lab_admin() and author_id = auth.uid());
