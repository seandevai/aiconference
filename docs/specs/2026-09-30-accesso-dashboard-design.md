# Accesso e dashboard nella veste Nod — design

Data: 30/09/2026. Terzo sotto-progetto del redesign (spec `2026-09-29-redesign-call-design.md`,
«Scomposizione»), anticipato da Sean prima del test con i consulenti: oggi il consulente
entra da pagine grigie da prototipo («OmniCanvas», `neutral-950`) e solo dopo trova la call
in veste Nod. Scelte fatte con il visual companion (mockup in
`.superpowers/brainstorm/475-1790763669/`).

## Obiettivo

Il consulente che apre Nod trova subito come partire con una riunione, ritrova quelle
fatte e sa quanti crediti gli restano, in pagine coerenti con la call.

Successo: nel test con i consulenti nessuno chiede «dove creo la riunione» o «dove mando il
link»; gli e2e esistenti passano con i soli nomi dei pulsanti aggiornati; login,
registrazione e dashboard hanno la veste Nod su desktop e telefono.

## Decisioni prese con Sean (30/09)

| Tema | Scelta |
|---|---|
| Accesso | stesso metodo (email e password), solo veste Nod |
| Pagina di accesso | «Sobrio»: logo e modulo al centro |
| Dashboard | una sola pagina, impianto «Agenda» |
| Contenuti | nuova riunione, riunioni per stato, crediti, profilo (solo nome) |
| Partecipanti per riunione | non mostrati: servirebbe una policy RLS nuova |
| Pagina `/` | reindirizzamento, nessuna vetrina |
| Riunioni mai chiuse | «In corso» solo se iniziate da meno di 12 ore, poi fra le passate |

## 1. Percorsi

| Percorso | Comportamento |
|---|---|
| `/` | senza sessione → `/login`; con sessione → `/dashboard` |
| `/login`, `/signup` | modulo «Sobrio»; `next` protetto da `safeNextPath` come oggi |
| `/dashboard` | «Agenda»; senza sessione → `/login?next=/dashboard` come oggi |

Invariati: URL, server action esistenti (`signIn`, `signUp`, `signOut`, `createRoomAction`),
RLS, schema. Nessuna migrazione.

## 2. Accesso e registrazione

- Fondo `bg`, colonna centrale larga al massimo 24rem: `Logo`, titolo («Accedi» o «Crea un
  account»), campi, pulsante `accent` a tutta larghezza, collegamento all'altra pagina.
- Campi con `TextField`: Nome (solo registrazione, 1-40 caratteri), Email, Password (minimo
  8). Etichette sempre visibili, niente segnaposto al posto dell'etichetta.
- Invio: pulsante disattivato con «Accesso…» o «Registrazione…».
- Errore del server: sotto il modulo con `role="alert"` (messaggi di `authErrorMessage`);
  l'errore del nome resta collegato al campo Nome. Conferma email: `StatusBanner` info con il
  testo attuale («Ti abbiamo mandato un'email…»).
- Sotto il pulsante, in `muted`, la promessa: «Niente di ciò che si dice in riunione resta
  sui nostri server.»

## 3. Dashboard «Agenda»

```
┌──────────────────────────────────────────────────────────────┐
│ ▢ nod                              [＋ Nuova riunione] [G ▾] │  barra
├────────────────────────────────────────────┬─────────────────┤
│ In corso                                   │ Saldo           │
│  ● Kickoff Ferretti   [Copia link][Rientra]│ 1.240 crediti   │
│ Pronte                                     │ 129 a settembre │
│  Revisione offerta    [Copia link] [Apri]  ├─────────────────┤
│ Passate                                    │ Profilo         │
│  Demo prodotto     29 set · 48 min · 36 cr │ Giulia Rinaldi ✎│
└────────────────────────────────────────────┴─────────────────┘
```

- **Barra**: `Logo`; «Nuova riunione» (`accent`) apre sotto la barra un modulo inline con
  `TextField` «Titolo» (obbligatorio, massimo 120, come oggi) e «Crea»; dopo la creazione si
  entra nella stanza. Menu del profilo (`Menu`): nome ed «Esci».
- **Colonna principale** (`surface`): tre gruppi nell'ordine In corso, Pronte, Passate; un
  gruppo vuoto non compare. Ogni riga: titolo, poi a destra
  - In corso: punto lime, «Copia link», «Rientra» (`accent`);
  - Pronte: «Copia link», «Apri»;
  - Passate: data, durata se nota, crediti usati se più di zero; nessuna azione.
- **Colonna destra** (larga circa 18rem): riquadro `stage` con saldo e consumo del mese;
  riquadro profilo con nome e «Modifica» che mostra `TextField` e «Salva» sul posto.
- **Telefono**: una colonna; saldo e profilo scendono sotto le riunioni. «Nuova riunione»
  resta nella barra.
- **Nessuna riunione**: al posto dei gruppi un riquadro «Prima riunione» con tre passi
  (crea la riunione, manda il link al cliente, chiedi all'agente) e il pulsante.

## 4. Dati

Letti lato server nella pagina con il client Supabase dell'utente: vale la RLS esistente,
mai la service role.

| Dato | Origine |
|---|---|
| Riunioni | `rooms`: `id, title, join_code, status, started_at, ended_at, created_at`, ultime 50 |
| Saldo | `workspaces.credits_balance` del workspace di cui l'utente è `owner`, scelto come in `createRoomForUser` |
| Consumo del mese | somma dei `delta` negativi di `credit_ledger` da inizio mese (UTC) |
| Crediti per riunione | `credit_ledger.delta` con `ai_requests.room_id`, per le riunioni mostrate |
| Nome | `profiles.display_name` |

Funzioni pure in `apps/web/src/lib/dashboard/`:

- `groupRooms(rooms, now)`: `created` → Pronte; `active` e `closing` iniziate da meno di
  12 ore (`started_at`) → In corso; `active` e `closing` più vecchie o senza `started_at`,
  `closed`, `purged` e stati sconosciuti → Passate; ordine per `created_at` decrescente
  dentro ogni gruppo. La soglia esiste perché oggi nessuno chiude una stanza: «Termina» e la
  purga arrivano con la slice 8 (`room-token.ts` porta la stanza ad `active`, niente la porta
  a `closed`). Dopo la slice 8 resta come rete per chi chiude la scheda senza terminare.
- `formatDuration(startedAt, endedAt)`: «48 min», «1 h 12»; `null` se manca un estremo o la
  durata è negativa.
- `creditsByRoom(rows)`: somma dei consumi per stanza, in positivo.
- `monthStart(now)`: primo istante del mese in UTC.

Scrittura: nuova server action `updateDisplayName` in `dashboard/actions.ts`. Controlla la
sessione lato server, valida con `parseDisplayName`, aggiorna `profiles.display_name` (policy
«user updates own profile» già presente), poi `revalidatePath('/dashboard')`.

«Copia link» usa `NEXT_PUBLIC_APP_URL/room/<join_code>`; conferma «Link copiato» per due
secondi. Se `navigator.clipboard` manca o rifiuta, mostra il link in un campo in sola lettura
già selezionato.

La pagina non si aggiorna in tempo reale: lo stato «in corso» si rinnova ricaricando.
Presence e tempo reale restano fuori da Postgres (CLAUDE.md, confini).

Nessun contenuto di riunione: solo titoli, stati, date e numeri (regola 1).

## 5. Componenti

In `packages/ui` (solo presentazione, nessun dato):

| Componente | Cosa fa |
|---|---|
| `TextField` | etichetta, input, errore collegato con `aria-describedby` e `aria-invalid`; bordo lime al focus |
| `Menu` | pulsante con `aria-expanded` e pannello; si chiude con Esc e con clic fuori |
| `Button` variante `icon` | tondo 44px, testo solo `sr-only`; usato anche per la ✕ dello spotlight |

`cx` resta una concatenazione: le varianti coprono i casi, niente classi in conflitto
passate da fuori.

In `apps/web/src/app/`: `page.tsx` (reindirizzamento), `(auth)/auth-form.tsx` riscritto,
`dashboard/page.tsx`, `dashboard/loading.tsx`, `dashboard/meeting-list.tsx`,
`dashboard/credits-card.tsx`, `dashboard/profile-card.tsx`, `dashboard/copy-link-button.tsx`,
`dashboard/new-meeting.tsx`. `create-room-form.tsx` viene assorbito da `new-meeting.tsx`.

## 6. Stati ed errori

| Stato | Resa |
|---|---|
| Caricamento | `loading.tsx` con la sagoma di barra, elenco e colonna |
| Nessuna riunione | riquadro «Prima riunione» |
| Errore di lettura riunioni | `StatusBanner` errore «Non riesco a caricare le riunioni. Ricarica la pagina.» |
| Errore di lettura crediti | saldo «—», nessun avviso bloccante |
| Errore creazione riunione | messaggio sotto il campo Titolo (messaggi di `createRoomAction`) |
| Errore nome | messaggio sotto il campo Nome, il valore resta |

## 7. Test

Scritti prima dell'implementazione.

- Unit: `groupRooms`, `formatDuration`, `creditsByRoom`, `monthStart`.
- Componenti (happy-dom): `TextField` (nome accessibile, errore annunciato), `Menu`
  (apertura, Esc), `Button` `icon` (nome accessibile dal testo nascosto), lista riunioni
  (gruppi vuoti nascosti, «Copia link» solo su In corso e Pronte), stato «Prima riunione».
- e2e: `/` porta a `/login`; dopo l'accesso `/` porta a `/dashboard`; creazione di una
  riunione dalla barra; modifica del nome nel profilo. Gli helper esistenti cambiano solo nei
  nomi dei pulsanti.
- Screenshot di revisione in `e2e/screenshots.spec.ts`: login, dashboard piena, dashboard
  vuota, dashboard su telefono.

## Fuori da questa spec

In `docs/BACKLOG.md`: link magico o codice monouso; numero di partecipanti per riunione
(policy di lettura su `room_participants`, migrazione dedicata); lingua predefinita nel
profilo (slice 6); sito vetrina; pacchetti nella dashboard (slice 8); vista SQL per i crediti
per riunione se le righe del ledger crescono; cambio visivo più marcato di call e palco
(sotto-progetto separato).
