# Laboratorio gesture su staging — design

Data: 06/10/2026. Segue `2026-10-05-gesture-lab-design.md`. Sean non ha una webcam: il
laboratorio deve girare su staging per un amico che ce l'ha, con permessi di admin, così che
lui registri e tari le gesture e Sean rigiochi il suo lavoro senza webcam e lo porti nel
codice.

## Obiettivo

1. **Accesso protetto su staging:** `/dev/gesture-lab` raggiungibile su Vercel solo dagli
   admin del laboratorio; per tutti gli altri non esiste.
2. **Registrare sul server:** l'admin registra esempi di gesture note o nuove, con nome e
   descrizione, e li salva.
3. **Rigiocare senza webcam:** Sean apre l'archivio, carica una registrazione e la rigioca
   con la taratura corrente.
4. **Condividere tarature:** preset con un nome, salvati sul server e applicabili da chiunque
   sia admin.

Successo: l'amico di Sean registra su staging; Sean, senza webcam, rigioca quelle
registrazioni, prova tarature, e porta nel codice valori («Copia come codice») e nuovi
riconoscitori verificati sulle registrazioni. La call non cambia.

## Decisioni prese con Sean (06/10)

| Tema | Scelta |
|---|---|
| Risultato del lavoro dell'amico | registrazioni e tarature salvate sul server; Sean rigioca |
| «Aggiungere» una gesture | l'amico registra esempi con nome libero; il riconoscitore lo scriviamo noi |
| Chi è admin | tabella `gesture_lab_admins` su Supabase, modificata solo via SQL |
| Dove si apre | locale sempre; su Vercel solo con `GESTURE_LAB_ENABLED=true` e utente admin |
| Impaginazione | palco, mano ed eventi a sinistra; comandi a destra con scroll proprio (fatto in PR #21) |

## 1. Accesso

### 1.1 Chi vede la pagina

`page.tsx` diventa una pagina server che decide prima di rendere. La decisione è una
funzione pura, testata da sola:

```ts
type LabAccess = 'open' | 'admin' | 'hidden';
labAccess({ nodeEnv, enabled, isAdmin }): LabAccess
```

| Ambiente | `GESTURE_LAB_ENABLED` | Utente | Esito |
|---|---|---|---|
| `development` | qualsiasi | nessuno o non admin | `open`: laboratorio di oggi, senza pannelli server |
| `development` | qualsiasi | admin | `admin`: con Registra, Archivio, Preset |
| `production` (Vercel) | assente o diverso da `true` | qualsiasi | `hidden` |
| `production` (Vercel) | `true` | nessuno o non admin | `hidden` |
| `production` (Vercel) | `true` | admin | `admin` |

`hidden` chiama `notFound()`: un 404, non un redirect al login, così la pagina non rivela
di esistere. In produzione la variabile non c'è, quindi resta 404 per tutti.

`GESTURE_LAB_ENABLED` è solo server (mai `NEXT_PUBLIC_`), opzionale nello schema di
`env-schema.ts`, impostata solo su Preview.

### 1.2 Chi è admin

Funzione SQL `public.is_gesture_lab_admin()` (`security definer`, `stable`,
`search_path` fissato) che risponde se `auth.uid()` sta in `gesture_lab_admins`. La usano
la pagina (via `rpc`), le server action e le policy RLS: un solo controllo.

Per aggiungere un admin: l'amico si registra dal login normale di staging, poi Sean esegue
nel SQL editor di Supabase la riga documentata in `docs/GESTURE-LAB.md`:

```sql
insert into public.gesture_lab_admins (user_id)
select id from auth.users where email = '<email>';
```

## 2. Dati — migrazione `0006_gesture_lab.sql`

Tabelle e policy nella stessa migrazione. RLS attiva su tutte, deny by default.

### 2.1 `gesture_lab_admins`

| Colonna | Tipo |
|---|---|
| `user_id` | `uuid` pk, → `auth.users` on delete cascade |
| `created_at` | `timestamptz` default `now()` |

Nessuna policy: né lettura né scrittura dal client. La legge solo `is_gesture_lab_admin()`.

### 2.2 `gesture_recordings`

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | `uuid` pk default `gen_random_uuid()` | |
| `author_id` | `uuid` → `auth.users` on delete cascade | |
| `author_name` | `text` | nome del profilo al salvataggio, scritto dal server |
| `label` | `text` | 1-60 caratteri |
| `expect` | `text` null | evento noto del riconoscitore; `null` = gesture nuova |
| `description` | `text` | 0-500 caratteri |
| `armed` | `boolean` | |
| `frames` | `jsonb` | array; `pg_column_size(frames) <= 2 MB` |
| `created_at` | `timestamptz` default `now()` | |

Policy:

- `select`: `is_gesture_lab_admin()`
- `insert`: `is_gesture_lab_admin() and author_id = auth.uid()`
- `delete`: `is_gesture_lab_admin() and author_id = auth.uid()`
- nessun `update`

Una registrazione di 4 s a 30 fps pesa circa 200 KB: il tetto di 2 MB lascia margine e sta
sotto il limite di 4,5 MB del corpo di una richiesta Vercel.

_Nota: il tetto implementato è 1 MB (app 900.000 byte, database `octet_length` ≤ 1.048.576), come negli scostamenti del piano._

### 2.3 `gesture_lab_presets`

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | `uuid` pk | |
| `author_id` | `uuid` → `auth.users` on delete cascade | |
| `author_name` | `text` | come sopra |
| `name` | `text` | 1-60 caratteri |
| `settings` | `jsonb` | `LabSettings`: taratura, dizionario, interruttori |
| `created_at` | `timestamptz` default `now()` | |

Stesse policy delle registrazioni.

### 2.4 Regola 1

Solo numeri dei landmark della mano e testo scritto dall'admin. Mai immagini, audio o
collegamenti a stanze e riunioni: sono dati di prova dello strumento, non contenuti di
riunione. Lo dicono il commento della migrazione e `DATA-MODEL.md`.

## 3. Interfaccia

Nella colonna destra, solo con accesso `admin`, tre pannelli in più. Con accesso `open` il
laboratorio è quello di oggi.

### 3.1 Registra

- Campi: **nome** (testo libero), **evento atteso** (un evento noto oppure «Gesture nuova»),
  **descrizione**.
- «Registra» è attivo solo con la webcam accesa: conto alla rovescia 3-2-1, poi 4 s di
  frame grezzi dalla stessa pipeline del laboratorio (nessuna seconda webcam).
- `armed` vale `false` solo se l'evento atteso è `GESTURES_TOGGLE`, come nel registratore.
- Finita la registrazione, la clip va nel Rigioco. Tre scelte: **Salva** (server),
  **Scarica JSON** (stesso formato di `/dev/gesture-recorder`), **Scarta**.

### 3.2 Archivio

- Elenco: nome, evento atteso o «nuova», autore (`author_name`), data. Il più recente in
  cima. L'autore si copia al salvataggio perché la policy di `profiles` lascia leggere solo
  il proprio profilo, e non va allargata per questo.
- Click su una voce: `getRecording(id)` scarica i frame e la carica nel Rigioco. L'elenco
  non contiene i frame.
- «Elimina» solo sulle proprie, con conferma.

Percorso di Sean: apre l'archivio, carica una registrazione dell'amico, la rigioca, cambia
la taratura e guarda se il gesto scatta.

### 3.3 Preset

- «Salva taratura come…» con un nome: salva le `LabSettings` correnti.
- Elenco dei preset con **Applica**: sostituisce le impostazioni correnti, che restano anche
  in `localStorage` come copia di lavoro.
- «Copia come codice» resta il passaggio verso il codice.

### 3.4 Rigioco

Il caricamento di un file JSON resta. Il Rigioco accetta anche registrazioni con
`expect: null`: mostra gli eventi scattati senza confronto con un atteso.

Tutti i nuovi controlli sono bottoni e campi: le gesture non li toccano (regola 6).

## 4. Server

Server action in `apps/web/src/app/dev/gesture-lab/actions.ts`:

| Action | Fa |
|---|---|
| `saveRecording(input)` | valida, inserisce, restituisce la voce d'elenco |
| `getRecording(id)` | restituisce la registrazione completa |
| `deleteRecording(id)` | elimina la propria |
| `savePreset(input)` | valida, inserisce, restituisce il preset |
| `deletePreset(id)` | elimina il proprio |

Ognuna ricontrolla `is_gesture_lab_admin()` prima di agire e usa il client Supabase
dell'utente: l'RLS resta la seconda barriera. Nessun service role. In produzione con
`GESTURE_LAB_ENABLED` diverso da `true` le action rispondono come «non autorizzato».

Validazione con zod in `apps/web/src/lib/gesture-lab/recording-schema.ts`: forma dei frame
(tempo e landmark numerici), testi entro i limiti, dimensione serializzata entro 2 MB,
evento atteso fra quelli noti o `null`.

_Nota: il tetto implementato è 1 MB (app 900.000 byte, database `octet_length` ≤ 1.048.576), come negli scostamenti del piano._

Gli elenchi di registrazioni e preset li carica la pagina server e li passa al client; dopo
un salvataggio o un'eliminazione il client aggiorna il proprio stato con la risposta.

## 5. Casi limite

| Caso | Comportamento |
|---|---|
| Salvataggio fallito (rete, RLS, troppo grande) | messaggio in italiano; la clip resta in memoria con «Scarica JSON» |
| Frame non validi | rifiutati dalla validazione con il motivo |
| Registrazione eliminata da un altro mentre la si apre | «Registrazione non più disponibile», elenco aggiornato |
| Admin rimosso a sessione aperta | le action rispondono «non autorizzato»; al ricaricamento 404 |
| Webcam spenta | «Registra» disattivo; Archivio e Preset funzionano |
| Locale senza Supabase | accesso `open`, nessun pannello server, nessun errore |

## 6. Test (prima del codice)

- **DB** (`tests/db`, girano nel job `db` della CI):
  - un utente non admin non legge e non scrive registrazioni e preset;
  - un admin legge, scrive e cancella le proprie, ma non quelle degli altri;
  - `insert` con `author_id` altrui rifiutato;
  - `gesture_lab_admins` non leggibile né scrivibile dal client;
  - `is_gesture_lab_admin()` vera solo per gli admin.
- **Unit:**
  - `labAccess`: tutta la tabella del §1.1;
  - schema della registrazione: valida, frame rovinati, testi lunghi, troppo grande,
    `expect` sconosciuto;
  - pannelli Registra, Archivio, Preset con action finte: salva, errore con scaricamento,
    carica nel Rigioco, elimina solo le proprie, applica un preset;
  - Rigioco con `expect: null`.
- **Action:** con client Supabase finto, nessuna scrittura se l'utente non è admin.

## 7. Messa in staging

Passi esterni, ognuno confermato con Sean al momento:

1. `npx supabase db push` della migrazione `0006` sul progetto `aiconference`.
2. `GESTURE_LAB_ENABLED=true` sulle variabili Preview del progetto Vercel `omnicanvas`.
3. Deploy e `alias set` su `omnicanvas-staging.vercel.app`.
4. Sean aggiunge l'amico con la riga SQL del §1.2.

## 8. Documenti

- `docs/GESTURE-LAB.md`: a cosa serve, come si apre in locale e su staging, come si
  aggiunge un admin, come si porta una registrazione nei test (`tests/fixtures/gestures/`).
- `docs/ENVIRONMENT.md`: `GESTURE_LAB_ENABLED`.
- `docs/DATA-MODEL.md`: le tre tabelle.
- `CLAUDE.md`, stato attuale: una riga.

## Fuori scope

- Riconoscere forme nuove senza codice (classificatore addestrato sulle registrazioni).
- Usare un preset direttamente nella call.
- Modificare una registrazione dopo averla salvata.
- Gestire gli admin da interfaccia.
