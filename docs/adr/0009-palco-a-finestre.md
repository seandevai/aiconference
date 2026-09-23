# ADR-0009 — Il canvas è un palco di finestre a slot magnetici

**Data:** 23/09/2026 · **Stato:** accettato · **Sostituisce:** ADR-0007

## Contesto

ADR-0007 faceva del canvas una lista ordinata di schede, con varianti da scorrere.
Era il modello più semplice che desse senso alle gesture.

Rispiegando l'idea, Sean ha descritto un'esperienza più spaziale: finestre nello
spazio come whiteboard, create con un gesto, su cui si trascinano con un pinch i
contenuti che l'agente produce. Serve un modello che regga questo senza diventare
una scrivania disordinata, e che funzioni anche per chi guarda da un telefono.

Tre forme valutate con mockup: scrivania libera, palco a slot magnetici, carosello
in profondità.

## Decisione

**Palco a slot magnetici.** Una finestra grande in primo piano e fino a tre piccole
a lato. Le finestre si spostano liberamente e si agganciano allo slot più vicino.

Tre oggetti:

- **Finestra**: superficie con titolo e slot, contiene contenuti. Vuota è una
  whiteboard.
- **Contenuto**: grafico, testo, tabella, immagine, file. È ciò che l'agente produce.
- **Vassoio**: dove arriva ogni contenuto prodotto, e dove torna ciò che si archivia.

Tutti vedono lo stesso palco, solo l'host scrive. Un solo scrittore alla volta, con
`version` monotona e comandi trasmessi via DataChannel; snapshot in KV per chi
entra tardi. Nessun CRDT.

Le varianti di ADR-0007 escono: lo swipe ora cambia la finestra in primo piano.

## Conseguenze

Positive: ordine leggibile per chi guarda, sensazione spaziale per chi conduce. Lo
stesso modello diventa una pila scorrevole su mobile. Un solo scrittore rende la
sincronizzazione banale. `packages/canvas` continua a ricevere comandi senza sapere
da dove arrivano.

Negative: meno libertà di una scrivania vera; un utente potrebbe volere più di
quattro finestre visibili. La negoziazione (spec §2.6) introduce un secondo
scrittore temporaneo, gestito con un turno e non con merge.

## Alternative scartate

**Scrivania libera.** Massimo effetto Jarvis, ma tende al disordine, è illeggibile
per chi guarda e su mobile va ridisegnata da zero.

**Carosello in profondità.** Scenografico, ma mostra bene una cosa sola alla volta:
male per confrontare.

**Lista di schede (ADR-0007).** Semplice, ma non restituisce l'idea di spazio che è
il cuore dell'esperienza.
