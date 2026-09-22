# ADR-0001 — Il confine dei dati: metadati persistenti, contenuti effimeri

**Data:** 22/09/2026 · **Stato:** accettato · **Sostituisce:** nulla

## Contesto

I due documenti sorgente si contraddicono. Il Build Brief prevede Supabase con
snapshot della whiteboard, `room_events`, `whiteboard_operations` e "salvataggio
stato della room". Il PRD dichiara Zero-Data Retention: niente resta sui server, la
stanza si autodistrugge, i log di sessione muoiono entro 10 minuti.

Non si può avere entrambi alla lettera. Ma servono entrambi per motivi diversi:
senza persistenza non esistono auth, fatturazione e accounting dei costi; senza
ephemerality sparisce il principale argomento di vendita del prodotto.

## Decisione

Il confine non passa fra "salvare" e "non salvare", passa fra **metadati** e
**contenuti**.

Persiste in Postgres ciò che serve per far funzionare il business: identità,
appartenenza, esistenza di una stanza, quanto è costata una chiamata AI, crediti,
abbonamenti, lead raccolti.

Non persiste mai ciò che è stato detto o prodotto dentro la riunione: audio, video,
trascrizioni, prompt, output in chiaro, hand landmark.

Vive in KV con TTL pari alla sessione lo stato della stanza attiva. Vivono in object
storage con TTL di 7 giorni gli asset e il Final Bundle.

Le righe della tabella `ai_requests` registrano provider, modello, tipo di
operazione, token, latenza, costo ed esito. Non registrano il testo.

## Conseguenze

Positive: l'affermazione "non conserviamo i contenuti delle vostre riunioni" resta
vera e difendibile davanti a un cliente e a un DPO. Il database resta piccolo. Le
richieste di cancellazione sono banali da soddisfare.

Negative: il debug in produzione perde lo strumento più comodo, cioè rileggere cosa
è successo. Serve telemetria strutturale che dica quale passo è fallito senza dire
cosa conteneva. Non si possono offrire funzioni di rilettura o ricerca nello storico
delle riunioni senza cambiare questo ADR e il contratto con i clienti.

## Alternative scartate

**Persistenza piena come nel Brief.** Prodotto più ricco, ma perde il
differenziatore e fa entrare il progetto in competizione frontale con Zoom e Meet
dove non può vincere.

**Ephemerality assoluta come nel PRD.** Impossibile: senza account persistenti non
c'è abbonamento, e senza ledger non si conosce il costo marginale, che il Brief
indica come il vero obiettivo economico.
