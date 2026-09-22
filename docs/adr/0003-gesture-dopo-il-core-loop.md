# ADR-0003 — Le gesture arrivano dopo il core loop

**Data:** 22/09/2026 · **Stato:** sostituito da ADR-0005

## Contesto

Il PRD mette il gesture engine dentro lo scope MVP con un dizionario di gesti
(SWIPE_LEFT, SWIPE_RIGHT, PINCH). Il Build Brief è esplicito in senso opposto:
implementare dopo il core collaboration loop, e non bloccare l'MVP su funzioni
avanzate di computer vision.

## Decisione

Le gesture sono la slice 6, dopo che auth, stanza, video, canvas AI, usage e bundle
funzionano. Il Brief vince perché è il documento più recente e perché è quello
operativo.

Tutto il riconoscimento resta nel browser, come dice il PRD. Le gesture sono
configurabili e disattivabili dall'utente. Non esiste nessun percorso in cui il
frame della webcam o i landmark lascino il dispositivo.

## Conseguenze

Positive: l'MVP è dimostrabile settimane prima. La computer vision non blocca il
percorso critico. Le gesture si possono tarare con il prodotto già funzionante.

Negative: la demo iniziale perde l'effetto "wow" che il PRD considera centrale.
Mitigazione: nella slice 6 la stessa azione deve essere raggiungibile con la
gesture e con un click, così il fallback esiste sempre e le gesture restano un
accessorio, non un requisito di accessibilità.
