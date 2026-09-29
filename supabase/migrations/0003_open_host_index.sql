-- Un solo host presente per stanza, non uno per sempre: l'host che esce deve poter
-- rientrare con una riga nuova. Nessuna tabella nuova, le policy RLS restano quelle
-- della 0002.
drop index public.room_participants_one_host_idx;

create unique index room_participants_one_open_host_idx
  on public.room_participants (room_id)
  where role = 'host' and left_at is null;
