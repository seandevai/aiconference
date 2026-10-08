# ADR-0015 — Condivisione dello schermo, solo dell'host e dentro il palco

**Data:** 07/10/2026 · **Stato:** accettato · **Sostituisce:** nulla (precisa la spec MVP §2)

## Contesto

La spec MVP (§2) dice: «Non si condivide uno schermo: si costruisce insieme, dentro la
call». Era una scelta di posizionamento: Nod non vuole essere uno Zoom con un palco.

Dalle prove della videocall del 06/10 Sean chiede di poter condividere lo schermo. L'host
ha materiale che l'agente non produce (slide, PDF, siti, fogli di calcolo) e a volte deve
mostrare un software dal vivo. Senza questa funzione esce da Nod e apre un'altra call, cioè
il contrario di quello che vogliamo.

## Decisione

La condivisione dello schermo entra, con tre limiti che la tengono dentro la tesi del
prodotto:

1. **Solo l'host.** Lo impone il token LiveKit (sorgenti pubblicabili per ruolo), non solo
   la UI. È coerente con «solo l'host scrive sul palco».
2. **Solo dentro il palco.** Lo schermo è una finestra negli slot magnetici (ADR-0009), non
   una vista che sostituisce il palco: si dispone accanto a ciò che produce l'agente.
3. **Mai nel pacchetto.** A fine condivisione la finestra sparisce e lo schermo non viene
   salvato né cifrato. Conservarne un fotogramma sarà un gesto esplicito («Scatta», backlog).

Niente audio dello schermo nella prima versione.

## Conseguenze

- `RealtimeSession` cresce di cinque membri; il grant del token diventa per ruolo.
- Il modello del palco ha un tipo di contenuto dal vivo, `screen`, che porta solo
  un'identità: nessun contenuto di riunione su disco (regola 1).
- Il pacchetto deve escludere `screen`.
- La frase della spec §2 resta vera nel senso che conta: non si «passa» allo schermo
  condiviso, lo si porta sul palco.

Dettagli in `docs/specs/2026-10-07-condivisione-schermo-design.md`.
