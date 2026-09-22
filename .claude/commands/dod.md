---
description: Verifica la Definition of Done sul lavoro corrente prima di un commit o di un merge
---

Verifica la Definition of Done su quello che è cambiato ora. Esegui i comandi
davvero, non dedurre l'esito.

**Comandi da eseguire e riportare con l'output reale:**

```bash
git status --short
git diff --stat
npm run typecheck
npm run lint
npm test
```

**Controlli manuali sul diff:**

1. Nessun `any` senza un commento che spieghi perché è inevitabile.
2. Nessun segreto nel codice client. Nessuna chiave nuova sotto `NEXT_PUBLIC_`.
   Nessun uso di `SUPABASE_SERVICE_ROLE_KEY` fuori da una route server.
3. Nessun import di LiveKit fuori da `packages/realtime`.
4. Nessun import di un SDK di provider AI fuori da `packages/ai`.
5. Nessuna query al database dentro `packages/ui`.
6. Nessuna scrittura su Postgres nel percorso di presence o dei cursori.
7. Se c'è una tabella nuova: la policy RLS è nella stessa migrazione e c'è un test
   che prova l'accesso da utente non autorizzato e si aspetta zero righe.
8. Se c'è un endpoint nuovo che costa soldi: passa da `AIService`, ha rate limit e
   controlla la quota prima di chiamare il provider.
9. Nessun contenuto di riunione scritto in un log o in una colonna.
10. Se una variabile d'ambiente è nuova: è in `docs/ENVIRONMENT.md` e in
    `.env.example`.
11. La documentazione toccata dal cambiamento è aggiornata nello stesso diff.

**Riporta alla fine:** ogni punto con esito, la prova manuale riproducibile del
lavoro fatto, le limitazioni note, e se la Definition of Done è soddisfatta o no.
Se non lo è, dillo chiaramente invece di arrotondare.
