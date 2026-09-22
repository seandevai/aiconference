# Modello dati — OmniCanvas AI

Vale la regola di ADR-0001: qui stanno solo metadati. Nessuna colonna di questo
schema contiene il contenuto di una riunione.

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
Unità di fatturazione e di quota. Ogni utente ne ha almeno uno, creato alla
registrazione.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| name | text | |
| owner_id | uuid FK profiles | |
| plan | text | `free`, `solo`, `studio` |
| credits_balance | integer | crediti AI residui |
| hours_included | integer | ore di stanza incluse nel piano, per periodo |
| logo_url | text | nullable, stampato sul PDF. Vuoto sul piano free → watermark |
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
| workspace_id | uuid FK | |
| created_by | uuid FK profiles | |
| title | text | inserito dall'utente, è metadato non contenuto |
| join_code | text unique | codice corto per il link di invito |
| status | text | `created`, `active`, `closing`, `closed`, `purged` |
| started_at, ended_at, purged_at | timestamptz | nullable |
| created_at, updated_at | timestamptz | |

Indice su `join_code`. Indice su `(status, started_at)` per il job di purga.

### room_participants
Chi è entrato e per quanto. Serve per il costo per sessione, non per lo storico
sociale.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| room_id | uuid FK | |
| user_id | uuid FK profiles | nullable per ospiti |
| joined_at, left_at | timestamptz | |
| duration_seconds | integer | calcolato alla chiusura |

### ai_requests
Il ledger dei costi. Nessun testo.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| workspace_id, room_id, user_id | uuid FK | |
| provider | text | `anthropic`, `openai`, `fal`, `deepgram` |
| model | text | |
| operation | text | `summarize`, `image`, `classify_intent`, `transcribe` |
| input_tokens, output_tokens | integer | nullable |
| latency_ms | integer | |
| success | boolean | |
| error_code | text | nullable, codice del provider, non il messaggio |
| cost_usd_estimated | numeric(10,6) | |
| created_at | timestamptz | |

Indice su `(workspace_id, created_at)` e su `(room_id)`.

### credit_ledger
Append-only. Il saldo su `workspaces.credits_balance` è una cache, la verità è la
somma di questa tabella.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | |
| delta | integer | negativo per consumo, positivo per ricarica |
| reason | text | `ai_request`, `subscription_grant`, `manual_adjust` |
| ai_request_id | uuid FK | nullable |
| created_at | timestamptz | |

### subscriptions

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | |
| stripe_customer_id, stripe_subscription_id | text | |
| plan, status | text | |
| current_period_end | timestamptz | |

### bundle_leads
Email raccolte dal gate di download. È un dato personale: serve base giuridica,
consenso esplicito e cancellazione self-service.

| colonna | tipo | note |
|---|---|---|
| id | uuid PK | |
| room_id | uuid FK | |
| email | text | |
| consent_marketing | boolean | default false, non preselezionato |
| created_at | timestamptz | |

## Stato effimero, mai in Postgres

Chiavi KV con TTL pari alla durata della sessione più un margine.

```
room:{id}:cards              lista ordinata di schede (ADR-0007), incluse le bozze
room:{id}:presence           partecipanti connessi, TTL breve con refresh
room:{id}:transcript_window  ultime N frasi per speaker, TTL 5 minuti
room:{id}:assets             riferimenti agli oggetti R2 generati nella sessione
```

Il testo trascritto vive **solo** in `transcript_window`, con TTL di 5 minuti e
nessuna scrittura su disco. Le bozze dentro `cards` hanno un `expiresAt` proprio e
spariscono anche prima della fine della sessione.

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

`ai_requests` e `credit_ledger` sono in sola lettura per i membri e scrivibili solo
dal service role. Un client non deve poter inserire righe nel ledger.

## Verifica obbligatoria

Ogni migrazione che tocca RLS arriva con un test che prova ad accedere come utente
non autorizzato e si aspetta zero righe. Una policy senza quel test non è provata.
