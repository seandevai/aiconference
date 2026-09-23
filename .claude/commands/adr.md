---
description: Registra una decisione architetturale contestata come ADR numerato
argument-hint: <titolo breve della decisione>
---

Scrivi un ADR per: $ARGUMENTS

1. Leggi `docs/adr/` e trova il primo numero libero.
2. Crea `docs/adr/NNNN-<slug-del-titolo>.md` con questa struttura:

```markdown
# ADR-NNNN — <titolo>

**Data:** <oggi> · **Stato:** proposto · **Sostituisce:** <ADR precedente o nulla>

## Contesto
Il fatto che costringe a decidere. Cosa dicono le fonti in conflitto, se ce ne sono.

## Decisione
Cosa si fa, all'indicativo presente. Specifica, non generica.

## Conseguenze
Cosa migliora e cosa peggiora. Le negative vanno scritte davvero, non addolcite.

## Alternative scartate
Ognuna con il motivo dello scarto.
```

3. Se l'ADR cambia qualcosa di già scritto nella spec, aggiorna la tabella dei
   conflitti nella sezione 1 di `docs/specs/2026-09-23-omnicanvas-mvp-design.md`.
4. Se rende obsoleto un ADR precedente, marca quello vecchio come sostituito.

Un ADR serve solo per decisioni contestate o costose da invertire. Le scelte ovvie
non ne hanno bisogno.
