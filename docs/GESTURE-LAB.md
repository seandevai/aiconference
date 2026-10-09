# Laboratorio gesture

Pagina `/dev/gesture-lab`: si vede la mano, si tarano le gesture, si registrano e si
rigiocano. Spec: `docs/specs/2026-10-05-gesture-lab-design.md` e
`docs/specs/2026-10-06-gesture-lab-staging-design.md`; disposizione semplice e da telefono in
`docs/specs/2026-10-06-gesture-lab-redesign-design.md`.

## Dove si apre

- **In locale** (`npm run dev`): sempre. Con login di un admin compaiono Registra, Rigioca
  e, in Avanzate, i Preset.
- **Su staging**: solo con `GESTURE_LAB_ENABLED=true` (variabili Preview su Vercel) e per un
  admin loggato. Per chiunque altro è un 404. Prima si entra da `/login`, poi si apre
  `https://omnicanvas-staging.vercel.app/dev/gesture-lab`.
- **In produzione**: mai (la variabile non c'è).

## Come si usa

La pagina iniziale offre quattro scelte su computer e tre su telefono; ognuna ha il suo
indirizzo, quindi il tasto indietro del telefono torna alla scelta prima. Lo scheletro della
mano è sempre disegnato: grigio il grezzo, lime il filtrato.

- **Prova le gesture** (`?vista=prova`): fotocamera, mano col nome del gesto riconosciuto,
  palco con due finestre.
- **Banco di prova** (`?vista=banco`, solo computer): scheletro sopra e tre riquadri sotto.
  **Posa**: grezza e stabile, armato o in pausa, pausa residua, avanzamento dell'hold.
  **Dita**: una barra per dito e una per il pinch; le tacche sono le soglie di `tuning.pose`
  (piegato ed esteso, pinch). **Eventi**: gli ultimi, il più recente in alto. Serve a capire
  perché un gesto scatta o no. Al passo «Mettiti in posizione» di Registra, su computer, c'è
  lo stesso banco al posto del palco. Aperto da telefono torna alla pagina iniziale.
- **Registra un gesto** (`?vista=registra`, solo admin): si sceglie il gesto, ci si mette in
  posizione, 3-2-1 e 4 secondi di registrazione, poi l'esito. Il nome si compone da solo; la
  nota è facoltativa.
- **Rigioca dall'archivio** (`?vista=rigioca`, solo admin): elenco filtrabile per gesto;
  aprendo una registrazione l'esito si legge subito, «Rigioca» la riproduce sul palco. Il link
  `?vista=rigioca&id=…` apre direttamente quella registrazione: si può mandare a un altro
  admin.

Il tecnico (taratura, correzioni, dizionario, preset, diagnostica, «Copia come codice») sta
in **Avanzate**, col ⚙ in Prova, al passo «Mettiti in posizione» e nel rigioco. Su telefono
verticale sale dal basso: toccare la maniglia lo porta a schermo intero e indietro.

Su telefono Prova, Registra e Rigioca mostrano la mano a tutto spazio; «Mostra il palco» apre
il palco al suo posto. Il palco resta attivo anche nascosto: una gesture fatta col palco chiuso
si vede aprendolo. Ogni schermata riparte con la mano.

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
