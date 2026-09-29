-- Nome del profilo mai vuoto: un nome di soli spazi arrivava come ''. Si usa il prefisso
-- dell'email e si tiene entro i 40 caratteri, lo stesso limite dei partecipanti (0002).
-- Solo la funzione del trigger e un vincolo: nessuna tabella nuova, RLS invariata.

create or replace function public.handle_new_user()
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
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      40
    )
  );

  insert into public.workspaces (name, owner_id)
  values ('Il mio workspace', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

-- Le righe già vuote o troppo lunghe si sistemano prima del vincolo.
update public.profiles p
set display_name = left(
  coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1)),
  40
)
from auth.users u
where u.id = p.id
  and (p.display_name is null
       or trim(p.display_name) = ''
       or char_length(p.display_name) > 40
       or p.display_name <> trim(p.display_name));

alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) between 1 and 40);
