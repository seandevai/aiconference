-- Avvisi di sicurezza e prestazioni di Supabase su staging (07/10). Nessuna tabella nuova,
-- nessun cambio di logica nelle policy: privilegi, search_path, indici.
--
-- Avvisi lasciati come sono, di proposito:
-- - is_workspace_member e is_gesture_lab_admin eseguibili da authenticated: le policy RLS le
--   chiamano con i privilegi di chi interroga, e l'app chiama is_gesture_lab_admin via RPC.
--   Entrambe dicono qualcosa solo su chi le chiama.
-- - gesture_lab_admins con RLS e senza policy: tabella chiusa, la legge solo il service role.
-- - protezione dalle password trapelate: impostazione di Supabase Auth, non da migrazione.

-- Funzioni del ledger: search_path fisso, così un oggetto omonimo in un altro schema non
-- può intercettarle. I corpi usano nomi non qualificati, quindi public e non ''.
alter function public.ai_reserve_credits(uuid, integer) set search_path = public;
alter function public.ai_record_request(uuid, uuid, uuid, text, text, text, integer, integer, integer, boolean, text, numeric, integer, integer) set search_path = public;
alter function public.grant_credits(uuid, integer, text) set search_path = public;

-- Funzione del trigger sui nuovi utenti: il trigger continua a scattare, ma non è più
-- chiamabile da /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- rls_auto_enable è dell'event trigger ensure_rls di Supabase e non esiste nel database
-- locale: si tocca solo dove c'è. Gli event trigger non controllano execute quando scattano.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

-- Policy: auth.uid() valutata una volta per query invece che per riga. Stessa logica.
drop policy "user reads own profile" on public.profiles;
create policy "user reads own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy "user updates own profile" on public.profiles;
create policy "user updates own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy "member creates rooms in own workspaces" on public.rooms;
create policy "member creates rooms in own workspaces"
  on public.rooms for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and status = 'created'
    and guest_credit_cap is null
    and ends_at is null
  );

drop policy "lab admins add own recordings" on public.gesture_recordings;
create policy "lab admins add own recordings"
  on public.gesture_recordings for insert to authenticated
  with check (public.is_gesture_lab_admin() and author_id = (select auth.uid()));

drop policy "lab admins delete own recordings" on public.gesture_recordings;
create policy "lab admins delete own recordings"
  on public.gesture_recordings for delete to authenticated
  using (public.is_gesture_lab_admin() and author_id = (select auth.uid()));

drop policy "lab admins add own presets" on public.gesture_lab_presets;
create policy "lab admins add own presets"
  on public.gesture_lab_presets for insert to authenticated
  with check (public.is_gesture_lab_admin() and author_id = (select auth.uid()));

drop policy "lab admins delete own presets" on public.gesture_lab_presets;
create policy "lab admins delete own presets"
  on public.gesture_lab_presets for delete to authenticated
  using (public.is_gesture_lab_admin() and author_id = (select auth.uid()));

-- Indici sulle chiavi esterne: join e cancellazioni a cascata senza scansioni complete.
create index credit_ledger_ai_request_id_idx on public.credit_ledger (ai_request_id);
create index gesture_lab_presets_author_id_idx on public.gesture_lab_presets (author_id);
create index gesture_recordings_author_id_idx on public.gesture_recordings (author_id);
create index room_participants_user_id_idx on public.room_participants (user_id);
create index rooms_created_by_idx on public.rooms (created_by);
create index rooms_workspace_id_idx on public.rooms (workspace_id);
create index workspaces_owner_id_idx on public.workspaces (owner_id);
