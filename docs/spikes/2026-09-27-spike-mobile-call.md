# Spike call da telefono — orizzontale, tutto schermo, fotocamera, PiP

Spec: `docs/specs/2026-09-27-mobile-call-design.md`. Preview: `omnicanvas-staging.vercel.app`.
Da fare su un iPhone (Safari) e un Android (Chrome), host da desktop.

| # | azione | atteso | iPhone | Android |
|---|---|---|---|---|
| 1 | ruota in orizzontale | header nascosto, palco a sinistra, volti a destra, «Esci» visibile | | |
| 2 | torna in verticale | layout di prima | | |
| 3 | tocca il volto dell'host | host a tutto schermo, tuo riquadro in alto, controlli sotto | | |
| 4 | ruota con lo spotlight aperto | resta aperto e leggibile | | |
| 5 | «✕» | torna alla vista normale | | |
| 6 | «Gira fotocamera» | l'host ti vede con la fotocamera posteriore | | |
| 7 | «Disattiva camera», «Gira fotocamera», «Attiva camera» | riparte con l'altra fotocamera | | |
| 8 | «Riquadro» | finestrella con l'host | | |
| 9 | vai alla home con la call aperta | PiP automatico con l'host (se no: annotare) | | |
| 10 | in PiP, parla un altro ospite | il PiP passa a lui | | |
| 11 | in PiP 30 s, poi rientra | la call è ancora connessa; l'host ti ha sentito | | |

## Risultati

Modello, versione del sistema, browser, data, esiti. Ogni controllo fallito diventa una
voce nel BACKLOG con il sintomo esatto.
