# ADR-0011 — STT con Deepgram Nova-3, modello monolingue per partecipante

**Data:** 26/09/2026 · **Stato:** accettato · **Sostituisce:** nulla (completa ADR-0006)

## Contesto

ADR-0006 ha deciso *come* si trascrive: vendor in streaming, chiamato dal browser di
ciascun partecipante con token a vita breve, DPA zero-retention. Lasciava aperto
*quale* vendor (spec §12). La slice 4B (agente a voce) e la slice 6 (sottotitoli) non
partono senza.

Criteri della spec: qualità dell'italiano in streaming, prezzo reale, zero retention
per contratto, token temporanei per il browser, investimento iniziale minimo.
Confronto completo in `docs/decisions/2026-09-26-proposta-voce-4b.md`, approvato da
Sean il 26/09/2026.

## Decisione

Il vendor STT è **Deepgram Nova-3**, in streaming, chiamato dal browser con token
temporanei emessi dal nostro server dopo il controllo di appartenenza alla stanza.

Ogni partecipante usa il **modello monolingue della propria lingua** (~0,0077 $/min),
non quello multilingue (~0,0092 $/min): la lingua è nota dal profilo o dalla scelta
all'ingresso.

Ordine di grandezza: un'ora di sottotitoli con 2 persone ≈ 0,92 $; una richiesta
all'agente (≈10 s di audio) ≈ 0,0013 $. Ogni minuto passa dal ledger come gli altri
costi.

Il vendor resta dietro `packages/stt`: nessun altro package importa l'SDK Deepgram.

## Conseguenze

Positive: italiano in streaming disponibile oggi, prezzo basso e prevedibile,
`DEEPGRAM_API_KEY` già nel contratto env, token temporanei nativi (ADR-0006 regge
senza adattamenti).

Negative: dipendiamo da un solo vendor statunitense per l'audio di tutte le
riunioni. Lo zero retention non è ancora scritto: **nessun cliente vero in call
prima del DPA firmato** (BACKLOG, «Debito e rischi»). Il modello monolingue sbaglia
se un partecipante cambia lingua a metà frase; il multilingue costa il 20% in più e
resta l'uscita se succede spesso. Il costo cresce con i minuti di sottotitoli, non
con l'uso dell'agente: la slice 6 è quella che lo rende rilevante.

## Alternative scartate

**AssemblyAI streaming.** Prezzo simile, ma l'italiano in streaming era da
verificare; nessun vantaggio che giustifichi il dubbio.

**Speechmatics.** Italiano forte, prezzo più alto: contraddice l'investimento
minimo finché la qualità di Deepgram basta.

**Modello multilingue per tutti.** Più semplice, ma costa di più su ogni minuto per
un caso (cambio di lingua in frase) che nelle riunioni previste è raro.
