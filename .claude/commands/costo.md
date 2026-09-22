---
description: Verifica che ogni percorso che costa soldi sia tracciato e limitato
---

Controlla la disciplina economica del codice. Il principio del progetto: ogni
azione deve sapere quanto costa, e nessun utente deve poter generare costo
illimitato per errore.

**1. Trova tutto ciò che costa.** Cerca nel repository ogni chiamata in uscita verso
un provider a pagamento: modelli LLM, generazione immagini, trascrizione, emissione
token realtime, upload su object storage.

**2. Per ognuna verifica:**

- passa da `AIService` in `packages/ai`, senza scorciatoie
- controlla la quota **prima** di chiamare il provider, non dopo
- ha un rate limit per utente e per workspace
- scrive una riga su `ai_requests` anche quando fallisce
- scala i crediti su `credit_ledger`
- registra provider, modello, operazione, token, latenza, esito, costo stimato
- **non** registra il contenuto

**3. Confronta con il modello economico.** La spec stima 0,92 $ l'ora per una stanza
da quattro persone: 0,12 WebRTC, 0,45 trascrizione e agente, 0,30 immagini, 0,05
bundle. Se il codice attuale può superare quella cifra senza che una quota lo fermi,
è un difetto da riportare.

**4. Riporta:** elenco dei percorsi a pagamento trovati, quali rispettano tutti i
punti, quali no, e il costo massimo che un singolo utente può generare in un'ora
nello stato attuale del codice.
