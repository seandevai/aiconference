# Durata della stanza al posto della purga — design

Data: 04/10/2026. Nato dalla discussione sulla purga (slice 8, `BACKLOG.md`): invece di un
job che chiude le stanze senza presence, l'host fissa la durata alla creazione e la
proroga a comando. Sostituisce il «job di purga delle stanze abbandonate» del ciclo di vita
(spec v3 §4.9, `ARCHITECTURE.md` §10). Da registrare in ADR-0014.

## Obiettivo

Tre cose con un solo meccanismo:

1. **Ephemerality senza job:** una stanza abbandonata smette di esistere da sola, anche
   se l'host chiude il browser senza premere nulla.
2. **Controllo del tempo per l'host:** la riunione ha una durata, come una sala prenotata,
   con avviso e proroga.
3. **Tetto ai costi per riunione:** nessuna stanza vive oltre 3 ore; dopo la scadenza
   niente token, quindi niente minuti LiveKit, STT o chiamate all'agente.

Successo: dopo `ends_at` + margine nessuna route emette token né accetta richieste per la
stanza; lo stato in KV scade da solo; l'host vede il tempo, riceve l'avviso a −5 minuti e
proroga con un click; allo zero la call si chiude per tutti senza intervento.

## Decisioni prese con Sean (04/10)

| Tema | Scelta |
|---|---|
| Scopo | ephemerality, controllo del tempo e tetto ai costi insieme |
| Durata alla creazione | 30, 45, 60, 90 minuti; predefinito 60 |
| Proroga | +15 o +30 minuti, solo l'host |
| Tetto assoluto | 3 ore dall'inizio, proroghe comprese |
| Avviso | host a −5 minuti (pannello non bloccante); ospiti a −1 minuto (banner) |
| Allo zero, host presente | il suo browser chiude la stanza (e, dalla slice 8, compone prima il pacchetto) |
| Allo zero, host assente | la stanza scade lato server, senza pacchetto |
| Applicazione lato server | scadenza pigra: le route leggono `ends_at`; nessun cron |
| Cron di riserva | non ora; in `BACKLOG.md` |
| Crediti a minuto | no: l'economia è rinviata a dopo l'MVP |

Il timer parte **al primo ingresso**, non alla creazione: le riunioni si creano in
anticipo dall'Agenda.

## 1. Modello dati

Migrazione `0006_room_timer.sql`, con le policy nella stessa migrazione.

| Colonna | Tipo | Note |
|---|---|---|
| `rooms.planned_minutes` | integer not null default 60 | check `in (30, 45, 60, 90)` |
| `rooms.ends_at` | timestamptz | nullo finché la stanza è CREATA |

- La policy «member creates rooms in own workspaces» aggiunge `ends_at is null`: il client
  sceglie la durata, non la scadenza.
- Nessuna policy di update, come oggi: `ends_at` e `status` li cambia solo il server
  (service role).
- `ROOM_MAX_MINUTES = 180` e `ROOM_EXPIRY_GRACE_SECONDS = 120` sono costanti nel codice,
  non nel database: si cambiano senza migrazione.

## 2. Ciclo di vita

```
CREATA        riga in rooms, planned_minutes scelto, ends_at nullo
ATTIVA        primo token: started_at = now, ends_at = now + planned_minutes
              stato in KV con TTL fino a ends_at + margine
IN CHIUSURA   host termina (o zero con host presente): dalla slice 8 il browser
              compone, cifra e carica il pacchetto
CHIUSA        route close: status = closed, ended_at, KV cancellato, stanza LiveKit chiusa
SCADUTA       now > ends_at + margine senza close: trattata come chiusa da ogni route;
              KV già scaduto per TTL; LiveKit chiude la stanza vuota (emptyTimeout)
```

`purged` resta ammesso nel check di `status` per compatibilità, ma questa slice non lo
scrive. Lo stato `active` con `ends_at` passato è uno stato legittimo: «scaduta».

## 3. Server

### 3.1 Funzioni pure (`apps/web/src/lib/rooms/timer.ts`)

- `isRoomOver(room: { status, endsAt }, now): boolean` — vero se lo stato è in
  `ENDED_STATUSES` oppure se `endsAt` non è nullo e `now > endsAt + margine`.
- `activationEndsAt(startedAt, plannedMinutes): Date`.
- `extendEndsAt({ startedAt, endsAt }, minutes, now)` →
  `{ ok: true, endsAt, remainingExtendMinutes } | { ok: false, reason: 'cap_reached' | 'expired' }`.
  `expired` se `now >= endsAt`; `cap_reached` se il nuovo `endsAt` supera
  `startedAt + ROOM_MAX_MINUTES`.
- `kvTtlSeconds(endsAt, now): number` — secondi fino a `endsAt + margine`, minimo 60.

### 3.2 Modifiche alle route esistenti

- `createRoomForUser` accetta `plannedMinutes` (zod: uno dei 4 valori; assente = 60).
- `issueRoomToken`: la update CREATA → ATTIVA scrive anche `ends_at`, nella stessa update
  condizionata su `status = 'created'` (resta idempotente). Il risultato `ok` aggiunge
  `endsAt` e `serverNow` (ISO).
- `join-room.ts` e `resolve-participant.ts` leggono `ends_at` e usano `isRoomOver` al posto
  di `ENDED_STATUSES.has(...)`. Ogni route che passa da `resolveParticipant`, agente
  compreso, risponde `410 room_ended` dopo la scadenza.
- I TTL del KV (palco, `STAGE_TTL_SECONDS`; ospite, `GUEST_TOKEN_TTL_SECONDS`) diventano
  `kvTtlSeconds(endsAt, now)`, ricalcolati a ogni scrittura.

### 3.3 Route nuove

**`POST /api/rooms/[id]/extend`** — corpo `{ minutes: 15 | 30 }`.

| Caso | Risposta |
|---|---|
| non autenticato o non host della stanza | 403 `not_the_host` |
| stanza inesistente | 404 `room_not_found` |
| stanza chiusa, scaduta o `now >= ends_at` | 410 `room_ended` |
| oltre il tetto | 409 `cap_reached` |
| ok | 200 `{ endsAt, serverNow, remainingExtendMinutes }` |

La scrittura è condizionata sul vecchio `ends_at` (`eq('ends_at', previous)`): due click
contemporanei non sommano due proroghe; il secondo rilegge e risponde con lo stato
corrente. Dopo la scrittura allunga il TTL delle chiavi KV della stanza. Nessun costo,
nessun ledger.

**`POST /api/rooms/[id]/close`** — solo l'host.

- Update condizionata su `status = 'active'`: `status = closed`, `ended_at = now`.
  Idempotente: se la stanza è già chiusa risponde 200 senza effetti.
- Cancella le chiavi KV della stanza.
- Chiude la stanza LiveKit tramite `packages/realtime/server` (nuova funzione
  `closeRoom(roomId, credentials)` che incapsula `deleteRoom`). Se LiveKit non risponde:
  log con soli metadati (id stanza, codice d'errore) e risposta 200; la stanza vuota la
  chiude l'`emptyTimeout`.

## 4. Client

### 4.1 Orario condiviso

- La risposta del token porta `endsAt` e `serverNow`; il client calcola
  `offset = serverNow − Date.now()` al momento della risposta.
- Dopo una proroga l'host invia `sendData('room-timer', { endsAt })` a tutti; chi si
  riconnette riceve `endsAt` dal token.
- `useRoomTimer(endsAt, offset)` → `{ remainingSeconds, phase }` con
  `phase: 'normal' | 'warning' | 'last-minute' | 'over'` (warning da −300 s, last-minute da
  −60 s). La logica sta in una funzione pura `timerPhase(remainingSeconds)`.

### 4.2 Host

- Tempo rimasto nella barra della call, discreto («42 min»; sotto i 5 minuti «4:12»).
- A −5 minuti: pannello non bloccante «La riunione termina fra 4:59» con «+15 min»,
  «+30 min», «Termina ora». Un pulsante di proroga che supererebbe il tetto non compare;
  se non ne resta nessuno il testo dice «Hai raggiunto il massimo di 3 ore».
- Allo zero: chiamata a `close`, poi la schermata di riunione terminata. Se `close`
  fallisce il client si disconnette comunque.

### 4.3 Ospite

- Nulla fino a −1 minuto; poi banner «La riunione sta per terminare» con il conto alla
  rovescia.
- Allo zero si disconnette da solo e mostra la schermata di riunione terminata.

### 4.4 Creazione e dashboard

- `new-meeting.tsx`: selettore a 4 opzioni (30/45/60/90), predefinito 60.
- `groupRooms`: una stanza `active` con `ends_at` passato va fra le passate (usa
  `isRoomOver`, oltre alla finestra di 12 ore esistente per le stanze senza `ends_at`).

Tutto è cliccabile; nessun gesto nuovo (regola 6). Su mobile l'ospite vede solo il banner;
l'host non è da mobile.

## 5. Casi limite

| Caso | Comportamento |
|---|---|
| host si riconnette durante l'avviso | il token restituisce `endsAt`, il pannello ricompare |
| due schede dell'host allo zero | `close` idempotente |
| proroga dopo lo zero, dentro il margine | 410: il margine assorbe solo gli scarti d'orologio |
| `close` fallisce in rete | client disconnesso; la scadenza pigra chiude per tutti |
| stanza mai aperta | resta CREATA senza scadenza (pulizia in backlog) |
| LiveKit giù durante `close` | log di soli metadati, 200, emptyTimeout |
| client modificato resta connesso dopo lo zero | resta in una stanza LiveKit senza dati sui nostri server, fino all'emptyTimeout o al cron di riserva futuro |
| orologio del PC sbagliato | corretto da `offset` |

## 6. Test (prima del codice)

- **Unit:** `isRoomOver` (stato terminato, nel margine, oltre il margine, `endsAt` nullo);
  `extendEndsAt` (ok, tetto, scaduta, `remainingExtendMinutes`); `kvTtlSeconds`;
  `timerPhase`; `groupRooms` con stanza `active` scaduta.
- **Integrazione su database** (job `db`): insert con `planned_minutes` non ammesso
  rifiutato; insert con `ends_at` rifiutato dalla RLS; attivazione che scrive `ends_at`;
  `extend` (host ok, ospite 403, tetto 409, doppio click senza doppia somma); `close`
  (solo host, idempotente); token negato dopo la scadenza.
- **Componenti:** pannello host a −5 minuti; pulsante assente al tetto; banner ospite a
  −1 minuto; disconnessione allo zero (orologio finto).
- **E2E:** smoke esistente aggiornato col selettore di durata; nessuna attesa reale.

## 7. Documenti

- ADR-0014 «Durata della stanza al posto della purga per presence».
- `ARCHITECTURE.md` §10 e spec v3 §4.9: ciclo di vita con la scadenza.
- `DATA-MODEL.md`: le due colonne.
- `BACKLOG.md`: tolti «job di purga» e «test dopo la purga»; aggiunti cron di riserva con
  `closeRoom` sulle stanze scadute, pulizia delle stanze CREATE abbandonate, aggancio del
  pacchetto prima di `close` (slice 8), `room:{id}:presence` in KV da rimuovere se nessuno
  la usa.

## Fuori scope

Crediti a minuto, durata libera, proroga da parte degli ospiti, cron di riserva, pacchetto
(slice 8), gesto per la proroga.

Branch: `slice/timer-stanza`, prima della slice 8.
