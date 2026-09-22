# ADR-0002 — AI Canvas prima, whiteboard collaborativa dopo

**Data:** 22/09/2026 · **Stato:** accettato

## Contesto

Il Build Brief mette la whiteboard condivisa fra i must-have dell'MVP, con
operazioni condivise, snapshot periodici, undo/redo e risoluzione conflitti. Il PRD
non parla di whiteboard: parla di un AI Canvas che occupa il 25% destro dello
schermo e mostra moduli di testo e immagini generate dall'agente.

Sono due prodotti diversi. Una whiteboard collaborativa con CRDT o OT è da sola
diverse settimane di lavoro ed è un problema risolto bene da molti concorrenti.

## Decisione

L'MVP costruisce l'**AI Canvas**: un pannello che mostra asset generati
dall'agente, scorribili, selezionabili, ordinabili. Non è una superficie di disegno
libero e non ha bisogno di merge di operazioni concorrenti.

Lo stato del canvas è una lista ordinata di asset, sincronizzata via DataChannel e
tenuta in KV per la durata della sessione. Il conflitto si risolve con
last-write-wins sull'ordinamento più un id monotono per asset, che a questa
granularità basta.

La whiteboard a mano libera entra nella roadmap post-MVP, come fase 2.

## Conseguenze

Positive: settimane di lavoro risparmiate su un problema tecnico difficile e non
differenziante. Lo sforzo va sull'unica cosa che i concorrenti non hanno, cioè la
generazione contestuale. Niente CRDT da mantenere.

Negative: chi arriva dal Build Brief si aspetta una whiteboard e non la trova. La
demo deve raccontare bene perché il canvas generativo vale più di una lavagna.
Se in futuro serve il disegno libero, il modello dati del canvas va esteso da lista
di asset a documento con operazioni, e non è una modifica gratuita.
