# ADR-0013 — Immagini con fal.ai FLUX schnell, dietro conferma esplicita

**Data:** 26/09/2026 · **Stato:** accettato · **Sostituisce:** nulla

## Contesto

L'agente produce anche immagini. La spec (§2.3) le mette dietro conferma esplicita
(pollice su o ✓) perché costano e sono lente, ma non sceglie il provider. Il
contratto env conteneva sia `FAL_KEY` sia `OPENAI_API_KEY` (in `ENVIRONMENT.md`
quest'ultima è indicata per la generazione immagini).

Confronto in `docs/decisions/2026-09-26-proposta-voce-4b.md`, approvato da Sean il
26/09/2026.

## Decisione

Il provider immagini è **fal.ai con FLUX schnell** (~0,003–0,025 $/immagine,
latenza 1-3 s), come adapter di `AIService` in `packages/ai`: quota controllata
prima della chiamata, costo scritto sul ledger.

La generazione parte solo dopo `CONFIRM` (gesto o ✓). I byte dell'immagine seguono
il percorso già esistente: arrivano al browser dell'host e viaggiano sul byte
stream, mai sul nostro storage (ARCHITECTURE, trasferimento immagini).

`OPENAI_API_KEY` esce dal contratto env se nessun'altra funzione la usa; la
rimozione è un task della slice 4B, non di questo ADR.

## Conseguenze

Positive: costo per immagine basso, latenza compatibile con una conversazione,
`FAL_KEY` già nel contratto env. Un vendor in meno se OpenAI esce.

Negative: FLUX schnell privilegia la velocità sulla qualità; per immagini
dettagliate o con testo leggibile il risultato può deludere. fal.ai è un
aggregatore: termini di retention e DPA vanno verificati come per gli altri vendor
prima dei clienti veri. Anche i prompt delle immagini sono contenuto di riunione:
non vanno nei log (regola 1).

## Alternative scartate

**OpenAI immagini.** Qualità buona, ma più cara e più lenta: peggiora proprio i due
criteri per cui le immagini stanno dietro conferma.

**Modello più grande su fal.ai (FLUX dev/pro).** Rinviato: si valuta solo se la
qualità di schnell non regge nei test, con un costo per immagine più alto da
mettere a quota.
