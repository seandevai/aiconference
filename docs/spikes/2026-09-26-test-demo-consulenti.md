# Test della prima demo con 5 consulenti

Spec §11, rischio 1: la demo convince? Le gesture sono comode o solo scenografiche?
**Lo conduce Sean.** Serve la preview con Supabase Cloud, LiveKit Cloud, Upstash e
`AI_PROVIDER=anthropic` (task 0.5), e crediti caricati con `npm run credits:grant`.

## Chi

Cinque persone che fanno call con clienti per lavoro (consulenti, agenzie, studi). Non
colleghi del progetto.

## Come (40 minuti a persona)

1. 5 min — contesto in una frase: «una call dove un agente prepara materiale e tu lo
   disponi con le mani». Niente demo guidata prima.
2. 20 min — compiti, la persona è host, Sean fa il cliente da telefono:
   1. Crea una stanza e invita il cliente.
   2. Chiedi all'agente un grafico delle vendite per trimestre.
   3. Portalo sul palco col mouse, poi prova con le mani (palmo per attivare, pinch).
   4. Crea una seconda finestra e passa dall'una all'altra con uno swipe.
   5. Archivia una finestra.
   6. Chiudi la riunione.
3. 10 min — domande:
   - Quale parte useresti davvero con un tuo cliente la settimana prossima?
   - Le mani: più veloci del mouse, uguali o più lente? In quali momenti?
   - Che cosa ti ha fatto sentire a disagio davanti al cliente?
   - Pagheresti per questo? Quanto, al mese, rispetto a quello che usi oggi?
4. 5 min — Sean annota tempi e errori.

## Cosa si misura

| persona | ruolo | compiti riusciti (6) | tempo compito 3 mouse / mani | gesture fallite | «la userei» (1-5) | citazione |
|---|---|---|---|---|---|---|

## Soglie

- Passa se almeno 3 persone su 5 danno «la userei» ≥ 4 e almeno 3 completano i compiti
  2-5 senza aiuto.
- Le gesture restano nell'esperienza principale se almeno 3 le giudicano più veloci o
  uguali al mouse per il compito 3 o 4; altrimenti ADR che le rende opzionali.
