# ADR-0014 — Durata della stanza al posto della purga per presence

Data: 04/10/2026. Stato: accettata.

## Contesto

Il ciclo di vita prevedeva un job che purgava le stanze senza presence da N minuti
(spec v3 §4.9). Serviva una presence in KV che nessun codice scrive, un cron frequente
(Vercel Hobby lo esegue una volta al giorno) e non dava all'host alcun controllo sul
tempo, né un tetto ai costi per riunione.

## Decisione

L'host sceglie la durata alla creazione (30, 45, 60, 90 minuti). Al primo ingresso il
server fissa `rooms.ends_at`. A −5 minuti l'host può prorogare di 15 o 30 minuti, fino a
3 ore dall'inizio. Allo zero il browser dell'host chiude la stanza; se l'host manca, la
stanza scade: ogni route tratta `now > ends_at + 2 minuti` come chiusa, il KV scade per
TTL, LiveKit chiude la stanza vuota.

## Conseguenze

- Nessun cron, nessuna presence in KV.
- Un client modificato può restare connesso a una stanza LiveKit scaduta fino
  all'`emptyTimeout`: nessun dato di sessione resta sui nostri server. Il cron di riserva
  con `closeRoom` è in backlog.
- Le stanze scadute senza chiusura restano `active` in Postgres: lo stato reale si legge
  con `isRoomOver`.
- Niente crediti a minuto: l'economia resta rinviata a dopo l'MVP.
