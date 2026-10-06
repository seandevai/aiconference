# Laboratorio gesture

Pagina `/dev/gesture-lab`: si vede la mano, si tarano le gesture, si registrano e si
rigiocano. Spec: `docs/specs/2026-10-05-gesture-lab-design.md` e
`docs/specs/2026-10-06-gesture-lab-staging-design.md`.

## Dove si apre

- **In locale** (`npm run dev`): sempre. Con login di un admin compaiono Registra, Archivio
  e Preset.
- **Su staging**: solo con `GESTURE_LAB_ENABLED=true` (variabili Preview su Vercel) e per un
  admin loggato. Per chiunque altro è un 404. Prima si entra da `/login`, poi si apre
  `https://omnicanvas-staging.vercel.app/dev/gesture-lab`.
- **In produzione**: mai (la variabile non c'è).

## Aggiungere un admin

1. La persona si registra dal login di staging.
2. Nel SQL editor del progetto Supabase `aiconference`:

   ```sql
   insert into public.gesture_lab_admins (user_id)
   select id from auth.users where email = 'email@esempio.it';
   ```

Per toglierlo: `delete from public.gesture_lab_admins where user_id = (select id from auth.users where email = '…');`

## Dalle registrazioni al codice

- **Taratura**: «Copia come codice» e incollare nei predefiniti di `packages/gesture`, con un test.
- **Gesture nota riconosciuta male**: scaricare il JSON e metterlo in
  `tests/fixtures/gestures/`: diventa un test.
- **Gesture nuova** (`expect: null`): gli esempi servono a scrivere il riconoscitore. Il test
  delle fixture le salta; quando il riconoscitore esiste, si cambia `expect` nel file.

## Dati

Solo landmark della mano e testo scritto dall'admin. Mai immagini, audio o riunioni.
