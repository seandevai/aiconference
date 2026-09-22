---
description: Avvia una slice verticale — legge spec, ADR e piano, crea il branch, elenca i task
argument-hint: <numero slice>
---

Avvia il lavoro sulla slice $1 di OmniCanvas AI.

Nell'ordine, senza saltare passi:

1. Leggi `docs/specs/2026-09-22-omnicanvas-mvp-design.md`, sezione 8, e riporta la
   Definition of Done della slice $1.
2. Leggi tutti gli ADR in `docs/adr/` e segnala quelli che vincolano questa slice.
3. Leggi `docs/WORKFLOW.md` e `CLAUDE.md`.
4. Cerca un piano in `docs/plans/` per questa slice. Se non esiste, fermati e
   scrivilo prima di toccare codice, usando la skill `superpowers:writing-plans`.
5. Verifica che il working tree sia pulito e che main sia aggiornato.
6. Crea il branch `slice/$1-<nome-breve>`.
7. Elenca i task del piano con una stima e chiedi da quale partire.

Non scrivere codice applicativo in questo comando. Serve solo a preparare il campo.
