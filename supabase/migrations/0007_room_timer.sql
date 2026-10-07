-- Durata della stanza (spec 2026-10-04, ADR-0014): l'host sceglie la durata alla creazione,
-- il server fissa la scadenza al primo ingresso e la sposta solo con una proroga.
-- Nessuna tabella nuova: cambia la policy di insert di rooms, che resta senza update.

alter table public.rooms
  add column planned_minutes integer not null default 60
    check (planned_minutes in (30, 45, 60, 90)),
  add column ends_at timestamptz;

-- Le stanze già aperte ricevono la durata predefinita: senza scadenza resterebbero aperte
-- per sempre, perché la purga per presence non esiste più.
update public.rooms
  set ends_at = started_at + interval '60 minutes'
  where status = 'active' and started_at is not null and ends_at is null;

-- Il client sceglie la durata, mai la scadenza: ends_at lo scrive solo il server.
drop policy "member creates rooms in own workspaces" on public.rooms;
create policy "member creates rooms in own workspaces"
  on public.rooms for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_workspace_member(workspace_id)
    and status = 'created'
    and guest_credit_cap is null
    and ends_at is null
  );
