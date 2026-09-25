# Spike iOS Safari — audio, video e DataChannel su iPhone reale

Spec §11, rischio 5. Serve la preview Vercel con LiveKit Cloud.

## Preparazione

1. Progetto LiveKit Cloud (free tier). In Vercel, ambiente Preview:
   `NEXT_PUBLIC_LIVEKIT_URL` (wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
2. Deploy di preview del branch `slice/2-call`.
3. Host da desktop crea una stanza e manda il link all'iPhone.

## Controlli

| # | azione sull'iPhone | atteso | esito |
|---|---|---|---|
| 1 | apri il link in Safari, entra come ospite | form, poi la stanza | |
| 2 | consenti camera e microfono | la tua tessera mostra il video | |
| 3 | l'host parla | lo senti; se no, compare «Attiva l'audio» e dopo il tocco lo senti | |
| 4 | parli tu | l'host ti sente | |
| 5 | «Disattiva microfono» | sull'host la tessera dice «microfono spento» | |
| 6 | blocca lo schermo 30 s, poi riapri | «Connessione persa, riprovo…» e poi di nuovo in call | |
| 7 | passa da Wi-Fi a 4G durante la call | si ricollega entro 30 s | |
| 8 | ruota il telefono | layout leggibile, nessuno scroll orizzontale | |
| 9 | «Esci» | «Sei uscito dalla riunione.», l'host vede una tessera in meno | |

## Risultati

Modello, versione iOS, data, esiti e note. Ogni controllo fallito diventa una voce
nel BACKLOG con il sintomo esatto.
