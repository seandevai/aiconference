# Modello dati — OmniCanvas AI

Vale la regola di ADR-0001: qui stanno solo metadati. Nessuna colonna di questo
schema contiene il contenuto di una riunione, né la chiave di un pacchetto
(ADR-0008).

Riferimento di prodotto: `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (v3).

## Tabelle persistenti

### profiles
Estende `auth.users` di Supabase. Mai duplicare email e password.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | uguale a `auth.users.id` |
| display_name | text | |
| avatar_url | text | nullable |
| created_at, updated_at | timestamptz | default `now()` |

### workspaces
Unità di quota e, dopo l'MVP, di fatturazione. Ogni utente ne ha almeno uno, creato
alla registrazione.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| name | text | |
| owner_id | uuid FK profiles | |
| plan | text | `free` nell'MVP; gli altri piani si decidono dopo (spec §6) |
| credits_balance | integer | cache del saldo, la verità è `credit_ledger` |
| logo_url | text | nullable, stampato sul PDF riassuntivo |
| created_at, updated_at | timestamptz | |

### workspace_members

| colonna | tipo | note |
|---|---|---|
| workspace_id | uuid FK | PK composita con user_id |
| user_id | uuid FK profiles | |
| role | text | `owner`, `admin`, `member` |
| created_at | timestamptz | |

### rooms

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | workspace dell'host |
| created_by | uuid FK profiles | l'host |
| title | text | inserito dall'host, è metadato non contenuto |
| join_code | text unique | codice corto per il link di invito |
| status | text | `created`, `active`, `closing`, `closed`, `purged` |
| guest_credit_cap | integer | nullable. Valorizzato = «offro io» attivo, tetto per ospite |
| started_at, ended_at, purged_at | timestamptz | nullable |
| created_at, updated_at | timestamptz | |

Indice su `join_code`. Indice su `(status, started_at)` per il job di purga.

### room_participants
Chi è entrato, con che ruolo e per quanto. Serve per i permessi, per il pagante e
per il costo per sessione.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | è l'identità dell'ospite senza account dentro la stanza |
| room_id | uuid FK | |
| user_id | uuid FK profiles | nullable: null = ospite senza account |
| role | text | `host`, `guest` |
| display_name | text | nome scelto all'ingresso, metadato |
| language | text | lingua dei sottotitoli, es. `it`, `en` |
| joined_at, left_at | timestamptz | |
| duration_seconds | integer | calcolato all'uscita |

Vincolo: un solo `host` presente per stanza (indice unico parziale su `room_id where role = 'host' and left_at is null`, migrazione 0003). L'host che esce rientra con una riga nuova.

### ai_requests
Il registro dei costi. Nessun testo.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| room_id | uuid FK | |
| participant_id | uuid FK room_participants | chi ha fatto la richiesta |
| payer_workspace_id | uuid FK workspaces | chi paga: host, ospite registrato, o host per «offro io» |
| on_behalf_of_guest | boolean | true se pagata dall'host per un ospite |
| provider | text | es. `anthropic`, `deepgram`, `fal` |
| model | text | |
| operation | text | `agent_generate`, `image`, `translate`, `companion_eval`, `summarize_pdf`, `stt_session` |
| input_tokens, output_tokens | integer | nullable |
| units | numeric | nullable: secondi di audio, caratteri tradotti, immagini |
| latency_ms | integer | |
| success | boolean | |
| error_code | text | nullable, codice del provider, non il messaggio |
| cost_usd_estimated | numeric(10,6) | |
| created_at | timestamptz | |

Indici su `(payer_workspace_id, created_at)`, `(room_id)` e
`(room_id, participant_id) where on_behalf_of_guest` per il tetto di «offro io».

I tre contatori visibili all'host (agente, sottotitoli, PDF) sono somme su
`operation`, non colonne.

### credit_ledger
Append-only. Il saldo su `workspaces.credits_balance` è una cache, la verità è la
somma di questa tabella.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | |
| delta | integer | negativo per consumo, positivo per ricarica |
| reason | text | `ai_request`, `manual_grant`, `manual_adjust` |
| ai_request_id | uuid FK | nullable |
| created_at | timestamptz | |

Funzioni `ai_reserve_credits`, `ai_record_request`, `grant_credits`: eseguibili solo dal
service role (migrazione 0004). Nell'MVP i crediti si caricano a mano (`manual_grant`). I motivi legati ai piani
arrivano con Stripe.

### gesture_lab_admins
Elenco degli admin del laboratorio gesture (migrazione 0006). Dati di prova del
laboratorio gesture: solo landmark e testo dell'admin, mai contenuti di riunione.

| colonna | tipo | note |
|---|---|---|
| user_id | uuid PK | FK a `auth.users`, cascade |
| created_at | timestamptz | |

Si popola dal SQL editor o dal service role. Funzione `is_gesture_lab_admin()`:
eseguibile solo da `authenticated`.

### gesture_recordings
Dati di prova del laboratorio gesture: solo landmark e testo dell'admin, mai contenuti
di riunione.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| author_id | uuid FK | `auth.users`, cascade |
| author_name | text | 1-80 caratteri |
| label | text | 1-60 caratteri |
| expect | text | nullable, un evento noto del riconoscitore |
| description | text | massimo 500 caratteri |
| armed | boolean | |
| frames | jsonb | array, massimo 1 MiB di testo |
| created_at | timestamptz | |

### gesture_lab_presets
Dati di prova del laboratorio gesture: solo landmark e testo dell'admin, mai contenuti
di riunione.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| author_id | uuid FK | `auth.users`, cascade |
| author_name | text | 1-80 caratteri |
| name | text | 1-60 caratteri |
| settings | jsonb | oggetto |
| created_at | timestamptz | |

### bundles
Il record del pacchetto. Metadati soli: il contenuto è un blob cifrato su R2 e la
chiave non esiste lato server.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | compare nel link `/p/<id>` |
| room_id | uuid FK | |
| workspace_id | uuid FK | workspace dell'host |
| object_key | text | chiave dell'oggetto su R2 |
| size_bytes | bigint | |
| includes_pdf | boolean | conta per la quota PDF del periodo |
| status | text | `pending`, `uploaded`, `expired` |
| expires_at | timestamptz | default `created_at + 7 giorni` |
| created_at, updated_at | timestamptz | |

La quota PDF (es. 2 al mese nel piano gratuito) si calcola contando le righe con
`includes_pdf` nel periodo.

**Mai** una colonna per la chiave, per l'URL completo o per nomi di file interni al
pacchetto.

## Stato effimero, mai in Postgres

Chiavi KV con TTL pari alla durata della sessione più un margine.

```
room:{id}:stage              snapshot del palco (ADR-0009), senza byte delle immagini
room:{id}:presence           partecipanti connessi, TTL breve con refresh
room:{id}:transcript_window  ultime righe per speaker, TTL 5 minuti
```

Il testo trascritto vive **solo** in `transcript_window`, con TTL di 5 minuti e
nessuna scrittura su disco. Esiste solo se sono attivi sottotitoli o modalità
companion.

Lo snapshot del palco include la negoziazione in corso (snapshot dell'originale,
modifiche residue). Sparisce con la stanza.

## Policy RLS

Deny by default su ogni tabella. Le policy si scrivono nella stessa migrazione che
crea la tabella, mai in una successiva.

Forma ricorrente: un utente vede una riga se è membro del workspace a cui la riga
appartiene.

```sql
create policy "membri leggono le stanze del proprio workspace"
on rooms for select
using (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = rooms.workspace_id
      and m.user_id = auth.uid()
  )
);
```

- `ai_requests` e `credit_ledger`: sola lettura per i membri del workspace pagante,
  scrittura solo dal service role. Un client non deve poter inserire righe nel
  ledger.
- `room_participants`: scrittura solo dal service role (join via route server).
  Lettura per i membri del workspace della stanza.
- `bundles`: scrittura solo dal service role. La pagina di download legge via route
  server per id, senza sessione: il possesso del link è l'autorizzazione, la chiave
  è la protezione.
- `gesture_lab_admins`: chiusa a ogni client, nessuna policy (RLS attiva); la toccano
  solo il SQL editor e il service role.
- `gesture_recordings`: gli admin del laboratorio leggono tutto, scrivono solo a proprio
  nome e cancellano solo le proprie righe. Nessun update.
- `gesture_lab_presets`: come `gesture_recordings`.
- Gli ospiti senza account non hanno sessione Supabase: non leggono mai Postgres
  direttamente.

## Verifica obbligatoria

Ogni migrazione che tocca RLS arriva con un test che prova ad accedere come utente
non autorizzato e si aspetta zero righe. Una policy senza quel test non è provata.
