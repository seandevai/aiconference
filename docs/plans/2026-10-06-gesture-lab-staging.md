# Laboratorio gesture su staging — piano di implementazione

> **Per gli agenti:** SOTTO-SKILL OBBLIGATORIA: superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans, task per task. I passi usano le caselle
> (`- [ ]`) per tenere traccia.

**Obiettivo:** `/dev/gesture-lab` raggiungibile su staging solo dagli admin del laboratorio,
con registrazioni e preset salvati su Supabase e rigiocabili senza webcam.

**Architettura:** una funzione pura `labAccess` decide se la pagina si apre; una funzione SQL
`is_gesture_lab_admin()` decide chi è admin ed è usata da pagina, server action e RLS. Le
operazioni su Supabase stanno in `lib/gesture-lab/lab-store.ts` e ricevono il client
dell'utente (niente service role); le server action in `app/dev/gesture-lab/actions.ts`
sono sottili: controllo admin, validazione, chiamata allo store. Nel client, un contenitore
`ServerPanels` tiene gli elenchi e mostra i pannelli Registra, Archivio e Preset.

**Stack:** Next.js 16 (App Router, server action), Supabase (Postgres, RLS, `@supabase/ssr`),
React 19, Vitest + Testing Library (happy-dom), zod.

**Spec:** `docs/specs/2026-10-06-gesture-lab-staging-design.md`. Il piano parte dalla spec:
leggere entrambi.

**Branch:** `slice/gesture-lab-staging` (parte da `slice/gesture-lab`, PR #21).

## Vincoli globali

- Regola 1: nelle tabelle solo landmark numerici e testo scritto dall'admin; mai immagini,
  audio, stanze o riunioni.
- Regola 2: RLS deny by default più controllo admin in pagina e in ogni action.
- Regola 3: `GESTURE_LAB_ENABLED` solo server, mai `NEXT_PUBLIC_`; niente service role.
- Regola 5: test prima del codice, verificati rossi e poi verdi.
- Regola 6: ogni comando nuovo è un bottone o un campo.
- Nuova tabella ⇒ policy RLS nella stessa migrazione.
- Testi dell'interfaccia e commenti in italiano; codice, commit ed errori tecnici in inglese.
- Prima di ogni commit: `npx prettier --write` sui file toccati.

### Due scostamenti dalla spec, voluti

1. **Tetto dei frame: 1 MB, non 2 MB.** Le server action di Next accettano corpi fino a 1 MB
   per default. Una registrazione di 4 s pesa circa 350 KB: l'app rifiuta oltre 900.000 byte
   serializzati, il database oltre 1.048.576 (`octet_length(frames::text)`, non
   `pg_column_size`, che misura il dato compresso).
2. **`GESTURE_LAB_ENABLED` non passa da `serverEnv()`.** `serverEnv()` esige tutti i segreti
   del server, che in locale per il laboratorio non ci sono. La variabile si legge con
   `gestureLabEnabled()` in `lib/gesture-lab/access.ts` ed è documentata in
   `docs/ENVIRONMENT.md`.

## Attenzione in revisione

Casi che la spec implica e che conviene fissare con un test, nel task indicato:

1. **Registrazione di una gesture nuova (`expect: null`) copiata in `tests/fixtures/gestures/`**:
   il test delle fixture non deve fallire, la deve saltare (Task 3).
2. **Webcam fermata durante i 4 secondi, o mano mai in vista**: zero fotogrammi ⇒ messaggio,
   niente clip vuota da salvare (Task 7).
3. **In locale con un cookie di sessione vecchio e Supabase irraggiungibile**: `isLabAdmin`
   restituisce `false` senza eccezioni, la pagina si apre come oggi (Task 4).
4. **Eliminare una registrazione altrui, o già eliminata**: nessuna riga toccata ⇒
   `not_found`, l'elenco toglie la voce (Task 2, Task 8).
5. **Doppio click su «Salva»**: un solo inserimento (Task 7).

---

### Task 1: chi può aprire la pagina

**File:**
- Crea: `apps/web/src/lib/gesture-lab/access.ts`
- Test: `tests/unit/gesture-lab-access.test.ts`

**Interfacce:**
- Produce: `type LabAccess = 'open' | 'admin' | 'hidden'`;
  `labAccess(input: { nodeEnv: string | undefined; enabled: boolean; isAdmin: boolean }): LabAccess`;
  `gestureLabEnabled(env?: Record<string, string | undefined>): boolean`.

- [ ] **Passo 1: test che fallisce**

```ts
import { describe, expect, it } from 'vitest';
import { gestureLabEnabled, labAccess } from '@/lib/gesture-lab/access';

describe('labAccess', () => {
  it.each([
    ['development', false, false, 'open'],
    ['development', true, false, 'open'],
    ['development', false, true, 'admin'],
    ['production', false, false, 'hidden'],
    ['production', false, true, 'hidden'],
    ['production', true, false, 'hidden'],
    ['production', true, true, 'admin'],
    ['test', false, false, 'open'],
    [undefined, false, false, 'hidden'],
  ] as const)('nodeEnv %s, enabled %s, admin %s → %s', (nodeEnv, enabled, isAdmin, expected) => {
    expect(labAccess({ nodeEnv, enabled, isAdmin })).toBe(expected);
  });
});

describe('gestureLabEnabled', () => {
  it('is true only for the exact string "true"', () => {
    expect(gestureLabEnabled({ GESTURE_LAB_ENABLED: 'true' })).toBe(true);
    expect(gestureLabEnabled({ GESTURE_LAB_ENABLED: 'TRUE' })).toBe(false);
    expect(gestureLabEnabled({ GESTURE_LAB_ENABLED: '1' })).toBe(false);
    expect(gestureLabEnabled({})).toBe(false);
  });
});
```

- [ ] **Passo 2: verificare che fallisca**

Esegui: `npx vitest run tests/unit/gesture-lab-access.test.ts`
Atteso: FAIL, modulo `@/lib/gesture-lab/access` non trovato.

- [ ] **Passo 3: implementazione minima**

```ts
// Chi apre /dev/gesture-lab. In locale (development e test) il laboratorio è di tutti, e
// diventa «admin» se l'utente lo è. Altrove (Vercel) esiste solo con la variabile accesa e
// solo per un admin: per gli altri è un 404.
export type LabAccess = 'open' | 'admin' | 'hidden';

const LOCAL_ENVS = ['development', 'test'];

export function labAccess(input: {
  nodeEnv: string | undefined;
  enabled: boolean;
  isAdmin: boolean;
}): LabAccess {
  if (LOCAL_ENVS.includes(input.nodeEnv ?? '')) return input.isAdmin ? 'admin' : 'open';
  return input.enabled && input.isAdmin ? 'admin' : 'hidden';
}

// Letta a parte: serverEnv() esige tutti i segreti del server, che in locale qui non servono.
export function gestureLabEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.GESTURE_LAB_ENABLED === 'true';
}
```

- [ ] **Passo 4: verificare che passi**

Esegui: `npx vitest run tests/unit/gesture-lab-access.test.ts`
Atteso: PASS (10 test).

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/lib/gesture-lab/access.ts tests/unit/gesture-lab-access.test.ts
git commit -m "feat(gesture-lab): access rule for local and staging"
```

---

### Task 2: migrazione `0006_gesture_lab.sql`

**File:**
- Crea: `supabase/migrations/0006_gesture_lab.sql`
- Modifica: `packages/db/src/database.types.ts` (tre tabelle e una funzione)
- Modifica: `packages/db/src/index.ts` (esporta anche `Json`)
- Modifica: `docs/DATA-MODEL.md` (tre tabelle, sezione «Tabelle persistenti» e «Policy RLS»)
- Test: `tests/db/gesture-lab.test.ts`

**Interfacce:**
- Produce: tabelle `gesture_lab_admins`, `gesture_recordings`, `gesture_lab_presets`;
  funzione `public.is_gesture_lab_admin() returns boolean`; tipo `Json` da `@omnicanvas/db`.

I test DB non girano in locale (niente Docker): girano nel job `db` della CI e nel
Codespace (`npm run test:db`). Il passo «verificare che fallisca» si fa nel Codespace; se
non è disponibile, si annota e si verifica in CI dopo il push.

- [ ] **Passo 1: test che fallisce**

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

const frames = [{ t: 0, hands: [] }];
const recording = (authorId: string) => ({
  author_id: authorId,
  author_name: 'Test',
  label: 'due dita a V',
  expect: null,
  description: '',
  armed: true,
  frames,
});

describe('RLS on the gesture lab tables', () => {
  let labAdmin: TestUser;
  let otherAdmin: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    labAdmin = await createTestUser('lab-admin');
    otherAdmin = await createTestUser('lab-admin-2');
    stranger = await createTestUser('lab-stranger');
    const { error } = await admin
      .from('gesture_lab_admins')
      .insert([{ user_id: labAdmin.id }, { user_id: otherAdmin.id }]);
    if (error) throw error;
  });

  it('tells admins apart', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const asStranger = await signedInClient(stranger);
    expect((await asAdmin.rpc('is_gesture_lab_admin')).data).toBe(true);
    expect((await asStranger.rpc('is_gesture_lab_admin')).data).toBe(false);
  });

  it('lets an admin save and read recordings, and another admin read them', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { data, error } = await asAdmin
      .from('gesture_recordings')
      .insert(recording(labAdmin.id))
      .select('id')
      .single();
    expect(error).toBeNull();
    const asOther = await signedInClient(otherAdmin);
    const { data: seen } = await asOther.from('gesture_recordings').select('id').eq('id', data!.id);
    expect(seen).toHaveLength(1);
  });

  it('hides everything from a non-admin and refuses its writes', async () => {
    const asAdmin = await signedInClient(labAdmin);
    await asAdmin.from('gesture_recordings').insert(recording(labAdmin.id));
    const asStranger = await signedInClient(stranger);
    const { data } = await asStranger.from('gesture_recordings').select('id');
    expect(data).toEqual([]);
    const { error } = await asStranger.from('gesture_recordings').insert(recording(stranger.id));
    expect(error).not.toBeNull();
    const { error: presetError } = await asStranger
      .from('gesture_lab_presets')
      .insert({ author_id: stranger.id, author_name: 'x', name: 'p', settings: {} });
    expect(presetError).not.toBeNull();
  });

  it('refuses a recording written in the name of someone else', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { error } = await asAdmin.from('gesture_recordings').insert(recording(otherAdmin.id));
    expect(error).not.toBeNull();
  });

  it('lets only the author delete', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { data } = await asAdmin
      .from('gesture_recordings')
      .insert(recording(labAdmin.id))
      .select('id')
      .single();
    const asOther = await signedInClient(otherAdmin);
    const { data: deleted } = await asOther
      .from('gesture_recordings')
      .delete()
      .eq('id', data!.id)
      .select('id');
    expect(deleted).toEqual([]);
    const { data: still } = await admin.from('gesture_recordings').select('id').eq('id', data!.id);
    expect(still).toHaveLength(1);
    const { data: own } = await asAdmin
      .from('gesture_recordings')
      .delete()
      .eq('id', data!.id)
      .select('id');
    expect(own).toHaveLength(1);
  });

  it('keeps the admin list closed to every client', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { data } = await asAdmin.from('gesture_lab_admins').select('user_id');
    expect(data).toEqual([]);
    const { error } = await asAdmin.from('gesture_lab_admins').insert({ user_id: stranger.id });
    expect(error).not.toBeNull();
  });

  it('refuses frames over 1 MB', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const big = [{ t: 0, hands: [], pad: 'x'.repeat(1_100_000) }];
    const { error } = await asAdmin
      .from('gesture_recordings')
      .insert({ ...recording(labAdmin.id), frames: big });
    expect(error).not.toBeNull();
  });

  it('lets an admin save a preset that another admin reads', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { data, error } = await asAdmin
      .from('gesture_lab_presets')
      .insert({ author_id: labAdmin.id, author_name: 'Test', name: 'morbido', settings: {} })
      .select('id')
      .single();
    expect(error).toBeNull();
    const asOther = await signedInClient(otherAdmin);
    const { data: seen } = await asOther.from('gesture_lab_presets').select('id').eq('id', data!.id);
    expect(seen).toHaveLength(1);
  });
});
```

- [ ] **Passo 2: verificare che fallisca** (Codespace o CI)

Esegui: `npm run test:db -- tests/db/gesture-lab.test.ts`
Atteso: FAIL, `relation "public.gesture_lab_admins" does not exist`.

- [ ] **Passo 3: migrazione**

```sql
-- Laboratorio gesture su staging (spec 2026-10-06). Dati di prova dello strumento:
-- landmark numerici della mano e testo scritto dall'admin. Mai immagini, audio, stanze o
-- riunioni (regola 1).

create table public.gesture_lab_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Nessuna policy: la tabella la toccano solo il SQL editor e il service role.
alter table public.gesture_lab_admins enable row level security;

create function public.is_gesture_lab_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.gesture_lab_admins where user_id = auth.uid());
$$;

revoke execute on function public.is_gesture_lab_admin() from public, anon;
grant execute on function public.is_gesture_lab_admin() to authenticated;

create table public.gesture_recordings (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  label text not null check (char_length(label) between 1 and 60),
  expect text check (
    expect is null or expect in (
      'GESTURES_TOGGLE', 'AGENT_ACTIVATE', 'CONFIRM', 'REJECT', 'FOCUS_NEXT', 'FOCUS_PREV',
      'WINDOW_ARCHIVE', 'WINDOW_CREATE', 'GRAB', 'MOVE', 'DROP'
    )
  ),
  description text not null default '' check (char_length(description) <= 500),
  armed boolean not null,
  -- octet_length sul testo, non pg_column_size: quest'ultimo misura il dato compresso.
  frames jsonb not null check (
    jsonb_typeof(frames) = 'array' and octet_length(frames::text) <= 1048576
  ),
  created_at timestamptz not null default now()
);

create index gesture_recordings_created_idx on public.gesture_recordings (created_at desc);

create table public.gesture_lab_presets (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  name text not null check (char_length(name) between 1 and 60),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now()
);

create index gesture_lab_presets_created_idx on public.gesture_lab_presets (created_at desc);

alter table public.gesture_recordings enable row level security;
alter table public.gesture_lab_presets enable row level security;

-- Leggono e scrivono solo gli admin del laboratorio; si scrive solo a proprio nome,
-- si elimina solo il proprio. Nessun update.
create policy "lab admins read recordings"
  on public.gesture_recordings for select to authenticated
  using (public.is_gesture_lab_admin());

create policy "lab admins add own recordings"
  on public.gesture_recordings for insert to authenticated
  with check (public.is_gesture_lab_admin() and author_id = auth.uid());

create policy "lab admins delete own recordings"
  on public.gesture_recordings for delete to authenticated
  using (public.is_gesture_lab_admin() and author_id = auth.uid());

create policy "lab admins read presets"
  on public.gesture_lab_presets for select to authenticated
  using (public.is_gesture_lab_admin());

create policy "lab admins add own presets"
  on public.gesture_lab_presets for insert to authenticated
  with check (public.is_gesture_lab_admin() and author_id = auth.uid());

create policy "lab admins delete own presets"
  on public.gesture_lab_presets for delete to authenticated
  using (public.is_gesture_lab_admin() and author_id = auth.uid());
```

- [ ] **Passo 4: tipi**

Nel Codespace: `npm run db:types`. Senza Codespace, a mano in
`packages/db/src/database.types.ts`, in ordine alfabetico dentro `Tables`:

```ts
      gesture_lab_admins: {
        Row: { created_at: string; user_id: string };
        Insert: { created_at?: string; user_id: string };
        Update: { created_at?: string; user_id?: string };
        Relationships: [];
      };
      gesture_lab_presets: {
        Row: {
          author_id: string;
          author_name: string;
          created_at: string;
          id: string;
          name: string;
          settings: Json;
        };
        Insert: {
          author_id: string;
          author_name: string;
          created_at?: string;
          id?: string;
          name: string;
          settings: Json;
        };
        Update: {
          author_id?: string;
          author_name?: string;
          created_at?: string;
          id?: string;
          name?: string;
          settings?: Json;
        };
        Relationships: [];
      };
      gesture_recordings: {
        Row: {
          armed: boolean;
          author_id: string;
          author_name: string;
          created_at: string;
          description: string;
          expect: string | null;
          frames: Json;
          id: string;
          label: string;
        };
        Insert: {
          armed: boolean;
          author_id: string;
          author_name: string;
          created_at?: string;
          description?: string;
          expect?: string | null;
          frames: Json;
          id?: string;
          label: string;
        };
        Update: {
          armed?: boolean;
          author_id?: string;
          author_name?: string;
          created_at?: string;
          description?: string;
          expect?: string | null;
          frames?: Json;
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
```

e in `Functions`:

```ts
      is_gesture_lab_admin: { Args: never; Returns: boolean };
```

(Se il formato di `Args` delle funzioni senza argomenti nel file è diverso, ad esempio
`Record<PropertyKey, never>`, seguire quello.) In `packages/db/src/index.ts`:

```ts
export type { Database, Json } from './database.types';
```

- [ ] **Passo 5: `docs/DATA-MODEL.md`**

Aggiungere sotto «Tabelle persistenti» le sezioni `### gesture_lab_admins`,
`### gesture_recordings`, `### gesture_lab_presets` con le colonne della migrazione e la
frase: «Dati di prova del laboratorio gesture: solo landmark e testo dell'admin, mai
contenuti di riunione». Sotto «Policy RLS» una riga per tabella: admin in lettura, scrittura
e cancellazione solo proprie, `gesture_lab_admins` chiusa.

- [ ] **Passo 6: verificare**

Esegui: `npm run typecheck` (atteso: ok) e, nel Codespace dopo `npx supabase db reset`,
`npm run test:db -- tests/db/gesture-lab.test.ts` (atteso: PASS, 8 test).

- [ ] **Passo 7: commit**

```bash
git add supabase/migrations/0006_gesture_lab.sql packages/db/src tests/db/gesture-lab.test.ts docs/DATA-MODEL.md
git commit -m "feat(db): gesture lab admins, recordings and presets with RLS"
```

---

### Task 3: formato delle registrazioni e dei preset

**File:**
- Modifica: `apps/web/src/lib/gesture-lab/recording.ts`
- Modifica: `apps/web/src/lib/gesture-lab/settings.ts` (estrarre `parseLabSettings`)
- Crea: `apps/web/src/lib/gesture-lab/recording-schema.ts`
- Modifica: `apps/web/src/app/dev/gesture-lab/replay-panel.tsx:46`
- Modifica: `tests/unit/gesture-fixtures.test.ts`
- Test: `tests/unit/gesture-lab-recording.test.ts`, `tests/unit/gesture-lab-settings.test.ts`,
  `tests/unit/gesture-lab-schema.test.ts`, `tests/unit/gesture-lab-ui.test.tsx`

**Interfacce:**
- Produce:
  - `type Recording = { expect: GestureEvent['type'] | null; armed: boolean; frames: Frame[]; label?: string }`
  - `isGestureEventType(value: unknown): value is GestureEvent['type']`
  - `parseLabSettings(value: unknown): LabSettings`
  - `type RecordingInput = { label: string; expect: GestureEvent['type'] | null; description: string; armed: boolean; frames: Frame[] }`
  - `parseRecordingInput(value: unknown): RecordingInput | null`
  - `type PresetInput = { name: string; settings: LabSettings }`
  - `parsePresetInput(value: unknown): PresetInput | null`
  - `MAX_FRAMES_BYTES = 900_000`

- [ ] **Passo 1: test che falliscono**

In `tests/unit/gesture-lab-recording.test.ts`, dentro `describe('parseRecording')`:

```ts
  it('accepts a new gesture with no expected event, and keeps its label', () => {
    expect(parseRecording({ ...valid, expect: null, label: 'due dita a V' })).toEqual({
      ...valid,
      expect: null,
      label: 'due dita a V',
    });
  });
```

In `tests/unit/gesture-lab-settings.test.ts`:

```ts
import { DEFAULT_LAB_SETTINGS, parseLabSettings } from '@/lib/gesture-lab/settings';

describe('parseLabSettings', () => {
  it('falls back to the defaults for anything it does not understand', () => {
    expect(parseLabSettings(null)).toEqual(DEFAULT_LAB_SETTINGS);
    expect(parseLabSettings({ toggles: { feedback: 'yes' } })).toEqual(DEFAULT_LAB_SETTINGS);
  });

  it('keeps valid toggles', () => {
    const settings = parseLabSettings({ toggles: { feedback: true } });
    expect(settings.toggles.feedback).toBe(true);
  });
});
```

(gli import vanno uniti a quelli già presenti nel file.)

Nuovo `tests/unit/gesture-lab-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { parsePresetInput, parseRecordingInput } from '@/lib/gesture-lab/recording-schema';
import { hand } from '../fixtures/hands';

const input = {
  label: '  due dita a V  ',
  expect: null,
  description: 'indice e medio aperti',
  armed: true,
  frames: [{ t: 0, hands: [hand('fist')] }],
};

describe('parseRecordingInput', () => {
  it('accepts a valid recording and trims the texts', () => {
    expect(parseRecordingInput(input)).toEqual({ ...input, label: 'due dita a V' });
  });

  it('accepts a known expected event', () => {
    expect(parseRecordingInput({ ...input, expect: 'FOCUS_NEXT' })?.expect).toBe('FOCUS_NEXT');
  });

  it('refuses a missing or too long label, a long description, an unknown event', () => {
    expect(parseRecordingInput({ ...input, label: '   ' })).toBeNull();
    expect(parseRecordingInput({ ...input, label: 'x'.repeat(61) })).toBeNull();
    expect(parseRecordingInput({ ...input, description: 'x'.repeat(501) })).toBeNull();
    expect(parseRecordingInput({ ...input, expect: 'DANCE' })).toBeNull();
  });

  it('refuses broken frames', () => {
    expect(parseRecordingInput({ ...input, frames: [] })).toBeNull();
    expect(parseRecordingInput({ ...input, frames: [{ t: 'x', hands: [] }] })).toBeNull();
  });

  it('refuses frames heavier than the limit', () => {
    const frame = { t: 0, hands: [hand('fist'), hand('fist')] };
    const frames = Array.from({ length: 1_900 }, (_, i) => ({ ...frame, t: i }));
    expect(parseRecordingInput({ ...input, frames })).toBeNull();
  });
});

describe('parsePresetInput', () => {
  it('accepts a name and normalizes the settings', () => {
    expect(parsePresetInput({ name: ' morbido ', settings: {} })).toEqual({
      name: 'morbido',
      settings: DEFAULT_LAB_SETTINGS,
    });
  });

  it('refuses an empty or too long name', () => {
    expect(parsePresetInput({ name: '', settings: {} })).toBeNull();
    expect(parsePresetInput({ name: 'x'.repeat(61), settings: {} })).toBeNull();
  });
});
```

In `tests/unit/gesture-lab-ui.test.tsx`, dentro `describe('ReplayPanel')`:

```ts
  it('shows a new gesture without an expected event', () => {
    render(
      <ReplayPanel
        recording={{ expect: null, armed: true, frames: [], label: 'due dita a V' }}
        playing={false}
        fired={[]}
        onLoad={vi.fn()}
        onPlay={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByText('due dita a V')).toBeTruthy();
    expect(screen.getByText('Atteso: gesture nuova, nessun confronto')).toBeTruthy();
  });
```

- [ ] **Passo 2: verificare che falliscano**

Esegui: `npx vitest run tests/unit/gesture-lab-recording.test.ts tests/unit/gesture-lab-settings.test.ts tests/unit/gesture-lab-schema.test.ts tests/unit/gesture-lab-ui.test.tsx`
Atteso: FAIL (`expect: null` rifiutato, `parseLabSettings` e `recording-schema` mancanti,
testo del Rigioco diverso).

- [ ] **Passo 3: implementazione**

`recording.ts`: tipo e parsing.

```ts
export type Recording = {
  expect: GestureEvent['type'] | null;
  armed: boolean;
  frames: Frame[];
  label?: string;
};

export const isGestureEventType = (value: unknown): value is GestureEvent['type'] =>
  EVENT_TYPES.includes(value as GestureEvent['type']);
```

e in `parseRecording` sostituire il controllo su `expect` e il ritorno:

```ts
  const { expect, armed, frames, label } = value as Record<string, unknown>;
  // null = gesture nuova: si rigioca senza confronto con un evento atteso.
  if (expect !== null && !isGestureEventType(expect)) return null;
  ...
  if (!valid) return null;
  const recording: Recording = { expect, armed, frames: frames as Frame[] };
  return typeof label === 'string' ? { ...recording, label } : recording;
```

`settings.ts`: estrarre il corpo di `loadLabSettings` in `parseLabSettings`.

```ts
export function parseLabSettings(value: unknown): LabSettings {
  const parsed = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const toggles = (parsed.toggles ?? {}) as Record<string, unknown>;
  const d = DEFAULT_LAB_SETTINGS.toggles;
  return {
    tuning: clampTuning(parsed.tuning ?? DEFAULT_LAB_SETTINGS.tuning),
    dictionary: parseDictionary(parsed.dictionary),
    toggles: {
      smoothCursor: bool(toggles.smoothCursor, d.smoothCursor),
      feedback: bool(toggles.feedback, d.feedback),
      stablePoses: bool(toggles.stablePoses, d.stablePoses),
    },
  };
}

export function loadLabSettings(storage: Pick<Storage, 'getItem'> | null): LabSettings {
  try {
    const raw = storage?.getItem(LAB_STORAGE_KEY);
    return raw ? parseLabSettings(JSON.parse(raw)) : DEFAULT_LAB_SETTINGS;
  } catch {
    return DEFAULT_LAB_SETTINGS;
  }
}
```

Se `parseLabSettings({ toggles: { feedback: 'yes' } })` non dà `DEFAULT_LAB_SETTINGS` per
via di `clampTuning` (oggetto nuovo ma uguale), il test usa `toEqual`, che confronta i
valori: va bene così.

`recording-schema.ts`:

```ts
import { z } from 'zod';
import type { Frame, GestureEvent } from '@omnicanvas/gesture';
import { isGestureEventType, parseRecording } from './recording';
import { parseLabSettings, type LabSettings } from './settings';

// Quello che il server accetta dal laboratorio. Le server action di Next leggono al massimo
// 1 MB: i frame serializzati restano sotto 900.000 byte (il database ferma a 1 MB).
export const MAX_FRAMES_BYTES = 900_000;

export type RecordingInput = {
  label: string;
  expect: GestureEvent['type'] | null;
  description: string;
  armed: boolean;
  frames: Frame[];
};
export type PresetInput = { name: string; settings: LabSettings };

const texts = z.object({
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500),
  armed: z.boolean(),
});

export function parseRecordingInput(value: unknown): RecordingInput | null {
  const base = texts.safeParse(value);
  if (!base.success) return null;
  const { expect, frames } = value as { expect?: unknown; frames?: unknown };
  if (expect !== null && !isGestureEventType(expect)) return null;
  const recording = parseRecording({ expect, armed: base.data.armed, frames });
  if (!recording) return null;
  if (new TextEncoder().encode(JSON.stringify(recording.frames)).length > MAX_FRAMES_BYTES)
    return null;
  return { ...base.data, expect: recording.expect, frames: recording.frames };
}

const presetName = z.string().trim().min(1).max(60);

export function parsePresetInput(value: unknown): PresetInput | null {
  if (typeof value !== 'object' || value === null) return null;
  const { name, settings } = value as { name?: unknown; settings?: unknown };
  const parsed = presetName.safeParse(name);
  return parsed.success ? { name: parsed.data, settings: parseLabSettings(settings) } : null;
}
```

`replay-panel.tsx`, al posto della riga `Atteso: …`:

```tsx
          {recording.label && <p className="text-xs font-semibold">{recording.label}</p>}
          <p className="text-xs">
            {recording.expect
              ? `Atteso: ${recording.expect}`
              : 'Atteso: gesture nuova, nessun confronto'}
          </p>
```

`tests/unit/gesture-fixtures.test.ts`: le registrazioni di gesture nuove sono esempi per
scrivere un riconoscitore, non test.

```ts
type Recording = { expect: GestureEvent['type'] | null; armed: boolean; frames: Frame[] };

const read = (file: string) =>
  JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Recording;
// Le gesture nuove (expect null) sono esempi da cui scrivere un riconoscitore: non si verificano.
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => read(f).expect !== null);
```

e nel test usare `read(file)` (la riga `const dir` va spostata prima di `read`).

- [ ] **Passo 4: verificare che passino**

Esegui lo stesso comando del passo 2 più `npx vitest run tests/unit/gesture-fixtures.test.ts tests/unit/use-gesture-lab.test.tsx`
Atteso: PASS. Poi `npm run typecheck`: ok.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/lib/gesture-lab apps/web/src/app/dev/gesture-lab/replay-panel.tsx tests/unit
git commit -m "feat(gesture-lab): new-gesture recordings, server input schema, settings parser"
```

---

### Task 4: operazioni su Supabase

**File:**
- Crea: `apps/web/src/lib/gesture-lab/lab-store.ts`
- Test: `tests/unit/gesture-lab-store.test.ts`

**Interfacce:**
- Consuma: `parseRecording`, `isGestureEventType` (Task 3), `parseLabSettings`,
  `RecordingInput`, `PresetInput` (Task 3), `Database`, `Json` (Task 2).
- Produce:

```ts
export type LabClient = SupabaseClient<Database>;
export type Author = { id: string; name: string };
export type RecordingSummary = {
  id: string; label: string; expect: GestureEvent['type'] | null; description: string;
  authorId: string; authorName: string; createdAt: string;
};
export type PresetSummary = {
  id: string; name: string; settings: LabSettings; authorId: string; authorName: string; createdAt: string;
};
export type LabArchive = { userId: string; recordings: RecordingSummary[]; presets: PresetSummary[] };
export type LabError = 'not_allowed' | 'invalid' | 'not_found' | 'failed';
export type LabResult<T> = { ok: true; value: T } | { ok: false; error: LabError };

isLabAdmin(supabase: LabClient): Promise<boolean>
loadArchive(supabase: LabClient, userId: string): Promise<LabArchive>
insertRecording(supabase: LabClient, author: Author, input: RecordingInput): Promise<RecordingSummary | null>
fetchRecording(supabase: LabClient, id: string): Promise<Recording | null>
removeRecording(supabase: LabClient, id: string): Promise<boolean>
insertPreset(supabase: LabClient, author: Author, input: PresetInput): Promise<PresetSummary | null>
removePreset(supabase: LabClient, id: string): Promise<boolean>
toRecordingSummary(row): RecordingSummary
toPresetSummary(row): PresetSummary
```

- [ ] **Passo 1: test che fallisce**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  isLabAdmin,
  toPresetSummary,
  toRecordingSummary,
  type LabClient,
} from '@/lib/gesture-lab/lab-store';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';

const client = (rpc: () => unknown) => ({ rpc: vi.fn(rpc) }) as unknown as LabClient;

describe('isLabAdmin', () => {
  it('is true only when the database says so', async () => {
    expect(await isLabAdmin(client(async () => ({ data: true, error: null })))).toBe(true);
    expect(await isLabAdmin(client(async () => ({ data: false, error: null })))).toBe(false);
    expect(await isLabAdmin(client(async () => ({ data: null, error: { message: 'x' } })))).toBe(
      false,
    );
  });

  it('is false when Supabase cannot be reached', async () => {
    const unreachable = client(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await isLabAdmin(unreachable)).toBe(false);
  });
});

describe('row mapping', () => {
  it('maps a recording row and drops an unknown event', () => {
    const row = {
      id: 'r1',
      author_id: 'u1',
      author_name: 'Luca',
      label: 'V',
      expect: 'DANCE',
      description: '',
      created_at: '2026-10-06T10:00:00Z',
    };
    expect(toRecordingSummary(row)).toEqual({
      id: 'r1',
      authorId: 'u1',
      authorName: 'Luca',
      label: 'V',
      expect: null,
      description: '',
      createdAt: '2026-10-06T10:00:00Z',
    });
  });

  it('maps a preset row and normalizes its settings', () => {
    const row = {
      id: 'p1',
      author_id: 'u1',
      author_name: 'Luca',
      name: 'morbido',
      settings: {},
      created_at: '2026-10-06T10:00:00Z',
    };
    expect(toPresetSummary(row).settings).toEqual(DEFAULT_LAB_SETTINGS);
  });
});
```

- [ ] **Passo 2: verificare che fallisca**

Esegui: `npx vitest run tests/unit/gesture-lab-store.test.ts`
Atteso: FAIL, modulo mancante.

- [ ] **Passo 3: implementazione**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@omnicanvas/db';
import type { GestureEvent } from '@omnicanvas/gesture';
import { isGestureEventType, parseRecording, type Recording } from './recording';
import type { PresetInput, RecordingInput } from './recording-schema';
import { parseLabSettings, type LabSettings } from './settings';

// Archivio del laboratorio su Supabase. Riceve il client dell'utente: le policy RLS fanno da
// seconda barriera dopo il controllo admin delle server action.

export type LabClient = SupabaseClient<Database>;
export type Author = { id: string; name: string };
export type RecordingSummary = {
  id: string;
  label: string;
  expect: GestureEvent['type'] | null;
  description: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};
export type PresetSummary = {
  id: string;
  name: string;
  settings: LabSettings;
  authorId: string;
  authorName: string;
  createdAt: string;
};
export type LabArchive = {
  userId: string;
  recordings: RecordingSummary[];
  presets: PresetSummary[];
};
export type LabError = 'not_allowed' | 'invalid' | 'not_found' | 'failed';
export type LabResult<T> = { ok: true; value: T } | { ok: false; error: LabError };

const SUMMARY = 'id, author_id, author_name, label, expect, description, created_at';
const PRESET = 'id, author_id, author_name, name, settings, created_at';

type RecordingRow = Pick<
  Database['public']['Tables']['gesture_recordings']['Row'],
  'id' | 'author_id' | 'author_name' | 'label' | 'expect' | 'description' | 'created_at'
>;
type PresetRow = Database['public']['Tables']['gesture_lab_presets']['Row'];

export function toRecordingSummary(row: RecordingRow): RecordingSummary {
  return {
    id: row.id,
    label: row.label,
    expect: isGestureEventType(row.expect) ? row.expect : null,
    description: row.description,
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: row.created_at,
  };
}

export function toPresetSummary(row: PresetRow): PresetSummary {
  return {
    id: row.id,
    name: row.name,
    settings: parseLabSettings(row.settings),
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: row.created_at,
  };
}

export async function isLabAdmin(supabase: LabClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_gesture_lab_admin');
    return !error && data === true;
  } catch {
    // In locale senza Supabase: il laboratorio resta aperto, senza archivio.
    return false;
  }
}

export async function loadArchive(supabase: LabClient, userId: string): Promise<LabArchive> {
  const [recordings, presets] = await Promise.all([
    supabase
      .from('gesture_recordings')
      .select(SUMMARY)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('gesture_lab_presets')
      .select(PRESET)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  return {
    userId,
    recordings: (recordings.data ?? []).map(toRecordingSummary),
    presets: (presets.data ?? []).map(toPresetSummary),
  };
}

export async function insertRecording(
  supabase: LabClient,
  author: Author,
  input: RecordingInput,
): Promise<RecordingSummary | null> {
  const { data, error } = await supabase
    .from('gesture_recordings')
    .insert({
      author_id: author.id,
      author_name: author.name,
      label: input.label,
      expect: input.expect,
      description: input.description,
      armed: input.armed,
      frames: input.frames as unknown as Json,
    })
    .select(SUMMARY)
    .single();
  return error || !data ? null : toRecordingSummary(data);
}

export async function fetchRecording(supabase: LabClient, id: string): Promise<Recording | null> {
  const { data } = await supabase
    .from('gesture_recordings')
    .select('label, expect, armed, frames')
    .eq('id', id)
    .maybeSingle();
  return data ? parseRecording(data) : null;
}

export async function removeRecording(supabase: LabClient, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('gesture_recordings')
    .delete()
    .eq('id', id)
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}

export async function insertPreset(
  supabase: LabClient,
  author: Author,
  input: PresetInput,
): Promise<PresetSummary | null> {
  const { data, error } = await supabase
    .from('gesture_lab_presets')
    .insert({
      author_id: author.id,
      author_name: author.name,
      name: input.name,
      settings: input.settings as unknown as Json,
    })
    .select(PRESET)
    .single();
  return error || !data ? null : toPresetSummary(data);
}

export async function removePreset(supabase: LabClient, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('gesture_lab_presets')
    .delete()
    .eq('id', id)
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}
```

Se il tipo generato di `rpc('is_gesture_lab_admin')` vuole un secondo argomento, passare
`{}`.

- [ ] **Passo 4: verificare che passi**

Esegui: `npx vitest run tests/unit/gesture-lab-store.test.ts` (PASS, 4 test) e
`npm run typecheck` (ok).

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/lib/gesture-lab/lab-store.ts tests/unit/gesture-lab-store.test.ts
git commit -m "feat(gesture-lab): Supabase store for recordings and presets"
```

---

### Task 5: server action

**File:**
- Crea: `apps/web/src/app/dev/gesture-lab/actions.ts`
- Test: `tests/unit/gesture-lab-actions.test.ts`

**Interfacce:**
- Consuma: `labAccess`, `gestureLabEnabled` (Task 1); `parseRecordingInput`,
  `parsePresetInput` (Task 3); store e tipi (Task 4); `createServerSupabase`
  (`@/lib/supabase/server`).
- Produce:

```ts
saveRecordingAction(input: unknown): Promise<LabResult<RecordingSummary>>
getRecordingAction(id: string): Promise<LabResult<Recording>>
deleteRecordingAction(id: string): Promise<LabResult<null>>
savePresetAction(input: unknown): Promise<LabResult<PresetSummary>>
deletePresetAction(id: string): Promise<LabResult<null>>
```

- [ ] **Passo 1: test che fallisce**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hand } from '../fixtures/hands';

const supabaseMock = vi.hoisted(() => ({
  user: { id: 'u1', email: 'luca@example.com' } as { id: string; email: string } | null,
  isAdmin: false,
  insert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: supabaseMock.user } }) },
    rpc: async () => ({ data: supabaseMock.isAdmin, error: null }),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { display_name: 'Luca' } }) }),
      }),
      insert: (row: unknown) => {
        supabaseMock.insert(table, row);
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: 'r1',
                author_id: 'u1',
                author_name: 'Luca',
                label: 'V',
                expect: null,
                description: '',
                created_at: '2026-10-06T10:00:00Z',
              },
              error: null,
            }),
          }),
        };
      },
    }),
  }),
}));

const { saveRecordingAction } = await import('@/app/dev/gesture-lab/actions');

const input = {
  label: 'V',
  expect: null,
  description: '',
  armed: true,
  frames: [{ t: 0, hands: [hand('fist')] }],
};

beforeEach(() => {
  supabaseMock.user = { id: 'u1', email: 'luca@example.com' };
  supabaseMock.isAdmin = false;
  supabaseMock.insert.mockReset();
});

describe('saveRecordingAction', () => {
  it('writes nothing for a user who is not a lab admin', async () => {
    expect(await saveRecordingAction(input)).toEqual({ ok: false, error: 'not_allowed' });
    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });

  it('writes nothing without a session', async () => {
    supabaseMock.user = null;
    supabaseMock.isAdmin = true;
    expect(await saveRecordingAction(input)).toEqual({ ok: false, error: 'not_allowed' });
    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });

  it('refuses an invalid recording', async () => {
    supabaseMock.isAdmin = true;
    expect(await saveRecordingAction({ ...input, label: '' })).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });

  it('saves for an admin, in the admin name', async () => {
    supabaseMock.isAdmin = true;
    const result = await saveRecordingAction(input);
    expect(result.ok).toBe(true);
    expect(supabaseMock.insert).toHaveBeenCalledWith(
      'gesture_recordings',
      expect.objectContaining({ author_id: 'u1', author_name: 'Luca', label: 'V' }),
    );
  });
});
```

(Vitest gira con `NODE_ENV=test`: `labAccess` dà `admin` all'admin e `open` agli altri.)

- [ ] **Passo 2: verificare che fallisca**

Esegui: `npx vitest run tests/unit/gesture-lab-actions.test.ts`
Atteso: FAIL, modulo mancante.

- [ ] **Passo 3: implementazione**

```ts
'use server';

import type { Recording } from '@/lib/gesture-lab/recording';
import { gestureLabEnabled, labAccess } from '@/lib/gesture-lab/access';
import {
  fetchRecording,
  insertPreset,
  insertRecording,
  isLabAdmin,
  removePreset,
  removeRecording,
  type Author,
  type LabClient,
  type LabResult,
  type PresetSummary,
  type RecordingSummary,
} from '@/lib/gesture-lab/lab-store';
import { parsePresetInput, parseRecordingInput } from '@/lib/gesture-lab/recording-schema';
import { createServerSupabase } from '@/lib/supabase/server';

// Ogni action ricontrolla l'admin prima di toccare i dati: l'RLS è la seconda barriera.
async function labAdmin(): Promise<{ supabase: LabClient; author: Author } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const isAdmin = await isLabAdmin(supabase);
  const access = labAccess({ nodeEnv: process.env.NODE_ENV, enabled: gestureLabEnabled(), isAdmin });
  if (access !== 'admin') return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', data.user.id)
    .maybeSingle();
  const name = profile?.display_name || data.user.email?.split('@')[0] || 'admin';
  return { supabase, author: { id: data.user.id, name: name.slice(0, 80) } };
}

const notAllowed = { ok: false, error: 'not_allowed' } as const;

export async function saveRecordingAction(input: unknown): Promise<LabResult<RecordingSummary>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  const parsed = parseRecordingInput(input);
  if (!parsed) return { ok: false, error: 'invalid' };
  const saved = await insertRecording(ctx.supabase, ctx.author, parsed);
  return saved ? { ok: true, value: saved } : { ok: false, error: 'failed' };
}

export async function getRecordingAction(id: string): Promise<LabResult<Recording>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  const recording = await fetchRecording(ctx.supabase, id);
  return recording ? { ok: true, value: recording } : { ok: false, error: 'not_found' };
}

export async function deleteRecordingAction(id: string): Promise<LabResult<null>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  return (await removeRecording(ctx.supabase, id))
    ? { ok: true, value: null }
    : { ok: false, error: 'not_found' };
}

export async function savePresetAction(input: unknown): Promise<LabResult<PresetSummary>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  const parsed = parsePresetInput(input);
  if (!parsed) return { ok: false, error: 'invalid' };
  const saved = await insertPreset(ctx.supabase, ctx.author, parsed);
  return saved ? { ok: true, value: saved } : { ok: false, error: 'failed' };
}

export async function deletePresetAction(id: string): Promise<LabResult<null>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  return (await removePreset(ctx.supabase, id))
    ? { ok: true, value: null }
    : { ok: false, error: 'not_found' };
}
```

- [ ] **Passo 4: verificare che passi**

Esegui: `npx vitest run tests/unit/gesture-lab-actions.test.ts` (PASS, 4 test),
`npm run typecheck`, `npm run lint`.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/app/dev/gesture-lab/actions.ts tests/unit/gesture-lab-actions.test.ts
git commit -m "feat(gesture-lab): server actions guarded by the lab admin check"
```

---

### Task 6: registrare dal flusso della webcam

**File:**
- Modifica: `apps/web/src/lib/gesture-lab/use-gesture-lab.ts`
- Test: `tests/unit/use-gesture-lab.test.tsx`

**Interfacce:**
- Produce: nel valore di `useGestureLab`, `capture(ms: number): Promise<Frame[]>`: raccoglie
  i fotogrammi grezzi per `ms` millisecondi e li restituisce con i tempi riportati a 0.

- [ ] **Passo 1: test che fallisce**

In `describe('useGestureLab live')`:

```ts
  it('captures the raw frames for a while, with times starting at zero', async () => {
    const { stream } = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const { result, video } = setup();
    video.play = vi.fn().mockResolvedValue(undefined);
    let onFrame: ((raw: Frame, processed: Frame, view: null) => void) | undefined;
    runnerMock.startGestures.mockImplementation(async (_video, options) => {
      onFrame = options.onFrame;
      return { stop: vi.fn(), reconfigure: vi.fn() };
    });
    await act(async () => {
      await result.current.startLive();
    });
    act(() => onFrame!(frame(500), frame(500), null));
    let captured: Promise<Frame[]> | undefined;
    act(() => {
      captured = result.current.capture(1_000);
    });
    act(() => onFrame!(frame(1_000), frame(1_000), null));
    act(() => onFrame!(frame(1_100), frame(1_100), null));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    const frames = await captured!;
    expect(frames.map((f) => f.t)).toEqual([0, 100]);
    // Dopo la registrazione i fotogrammi non si accumulano più.
    act(() => onFrame!(frame(1_200), frame(1_200), null));
    expect(frames).toHaveLength(2);
  });
```

- [ ] **Passo 2: verificare che fallisca**

Esegui: `npx vitest run tests/unit/use-gesture-lab.test.tsx`
Atteso: FAIL, `result.current.capture is not a function`.

- [ ] **Passo 3: implementazione**

In `useGestureLab`, accanto agli altri ref:

```ts
  // Fotogrammi grezzi della registrazione in corso; null quando non si registra.
  const captureRef = useRef<Frame[] | null>(null);
```

nel callback `onFrame` di `startLive`, prima di `framesRef.current = …`:

```ts
          captureRef.current?.push(raw);
```

dopo `pause`:

```ts
  // Registra dal flusso già acceso: niente seconda webcam. Tempi riportati a 0 come nel registratore.
  const capture = useCallback(
    (ms: number) =>
      new Promise<Frame[]>((resolve) => {
        captureRef.current = [];
        setTimeout(() => {
          const frames = captureRef.current ?? [];
          captureRef.current = null;
          const t0 = frames[0]?.t ?? 0;
          resolve(frames.map((f) => ({ ...f, t: f.t - t0 })));
        }, ms);
      }),
    [],
  );
```

e aggiungere `capture` all'oggetto restituito.

- [ ] **Passo 4: verificare che passi**

Esegui: `npx vitest run tests/unit/use-gesture-lab.test.tsx`
Atteso: PASS (tutti, compresi i precedenti).

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/lib/gesture-lab/use-gesture-lab.ts tests/unit/use-gesture-lab.test.tsx
git commit -m "feat(gesture-lab): capture raw frames from the live camera"
```

---

### Task 7: pannello Registra

**File:**
- Crea: `apps/web/src/app/dev/gesture-lab/lab-messages.ts`
- Crea: `apps/web/src/app/dev/gesture-lab/record-panel.tsx`
- Test: `tests/unit/gesture-lab-record.test.tsx`

**Interfacce:**
- Consuma: `Recording` (Task 3), `RecordingInput` (Task 3), `LabResult`, `LabError`,
  `RecordingSummary` (Task 4).
- Produce:
  - `LAB_MESSAGES: Record<LabError, string>`
  - `RecordPanel` con props
    `{ live: boolean; capture: (ms: number) => Promise<Frame[]>; onRecorded: (clip: Recording) => void; onSave: (input: RecordingInput) => Promise<LabResult<RecordingSummary>> }`

- [ ] **Passo 1: test che fallisce**

```tsx
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordPanel } from '@/app/dev/gesture-lab/record-panel';
import { hand } from '../fixtures/hands';

const frames = [{ t: 0, hands: [hand('fist')] }];
const summary = {
  id: 'r1',
  label: 'V',
  expect: null,
  description: '',
  authorId: 'u1',
  authorName: 'Luca',
  createdAt: '2026-10-06T10:00:00Z',
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function recordClip(props: Partial<Parameters<typeof RecordPanel>[0]> = {}) {
  const capture = vi.fn().mockResolvedValue(frames);
  const onRecorded = vi.fn();
  const onSave = vi.fn().mockResolvedValue({ ok: true, value: summary });
  render(
    <RecordPanel live capture={capture} onRecorded={onRecorded} onSave={onSave} {...props} />,
  );
  fireEvent.change(screen.getByLabelText('Nome della gesture'), { target: { value: ' V ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registra' }));
  expect(screen.getByText('3')).toBeTruthy();
  await act(async () => {
    vi.advanceTimersByTime(3_000);
  });
  return { capture, onRecorded, onSave };
}

describe('RecordPanel', () => {
  it('needs the camera and a name before recording', () => {
    render(<RecordPanel live={false} capture={vi.fn()} onRecorded={vi.fn()} onSave={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Registra' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('counts down, records four seconds and hands the clip to the replay', async () => {
    const { capture, onRecorded } = await recordClip();
    expect(capture).toHaveBeenCalledWith(4_000);
    expect(onRecorded).toHaveBeenCalledWith({ expect: null, armed: true, frames, label: 'V' });
    expect(screen.getByRole('button', { name: 'Salva' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scarica JSON' })).toBeTruthy();
  });

  it('saves once even on a double click', async () => {
    const { onSave } = await recordClip();
    let resolve: (value: unknown) => void = () => {};
    onSave.mockReturnValue(new Promise((r) => (resolve = r)));
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      label: 'V',
      expect: null,
      description: '',
      armed: true,
      frames,
    });
    await act(async () => resolve({ ok: true, value: summary }));
    expect(screen.getByText('Registrazione salvata.')).toBeTruthy();
  });

  it('keeps the clip and offers the download when saving fails', async () => {
    const { onSave } = await recordClip();
    onSave.mockResolvedValue({ ok: false, error: 'failed' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    });
    expect(screen.getByText(/Non sono riuscito a salvare/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scarica JSON' })).toBeTruthy();
  });

  it('says so when no frame was recorded', async () => {
    await recordClip({ capture: vi.fn().mockResolvedValue([]) });
    expect(screen.getByText(/Nessun fotogramma registrato/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Salva' })).toBeNull();
  });

  it('records GESTURES_TOGGLE disarmed, like the recorder', async () => {
    const capture = vi.fn().mockResolvedValue(frames);
    const onRecorded = vi.fn();
    render(<RecordPanel live capture={capture} onRecorded={onRecorded} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome della gesture'), { target: { value: 'palmo' } });
    fireEvent.change(screen.getByLabelText('Evento atteso'), {
      target: { value: 'GESTURES_TOGGLE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registra' }));
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(onRecorded.mock.calls[0]![0]).toMatchObject({
      expect: 'GESTURES_TOGGLE',
      armed: false,
    });
  });
});
```

- [ ] **Passo 2: verificare che fallisca**

Esegui: `npx vitest run tests/unit/gesture-lab-record.test.tsx`
Atteso: FAIL, modulo mancante.

- [ ] **Passo 3: implementazione**

`lab-messages.ts`:

```ts
import type { LabError } from '@/lib/gesture-lab/lab-store';

export const LAB_MESSAGES: Record<LabError, string> = {
  not_allowed: 'Non hai i permessi del laboratorio, o la sessione è scaduta. Ricarica la pagina.',
  invalid: 'Dati non validi: controlla nome e descrizione, e che la registrazione non sia vuota.',
  not_found: 'Non più disponibile: forse è stata eliminata.',
  failed: 'Non sono riuscito a salvare. Riprova, oppure scarica il JSON.',
};
```

`record-panel.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@omnicanvas/ui';
import type { Frame, GestureEvent } from '@omnicanvas/gesture';
import type { LabResult, RecordingSummary } from '@/lib/gesture-lab/lab-store';
import type { Recording } from '@/lib/gesture-lab/recording';
import type { RecordingInput } from '@/lib/gesture-lab/recording-schema';
import { LAB_MESSAGES } from './lab-messages';

const COUNTDOWN = 3;
const RECORD_MS = 4_000;
const EVENTS: GestureEvent['type'][] = [
  'GESTURES_TOGGLE',
  'AGENT_ACTIVATE',
  'CONFIRM',
  'REJECT',
  'GRAB',
  'FOCUS_NEXT',
  'FOCUS_PREV',
  'WINDOW_ARCHIVE',
  'WINDOW_CREATE',
];

type Phase =
  | { kind: 'idle' }
  | { kind: 'countdown'; n: number }
  | { kind: 'recording' }
  | { kind: 'done'; clip: Recording };

type Props = {
  live: boolean;
  capture: (ms: number) => Promise<Frame[]>;
  onRecorded: (clip: Recording) => void;
  onSave: (input: RecordingInput) => Promise<LabResult<RecordingSummary>>;
};

export function RecordPanel({ live, capture, onRecorded, onSave }: Props) {
  const [label, setLabel] = useState('');
  const [expect, setExpect] = useState<GestureEvent['type'] | ''>('');
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const busy = phase.kind === 'countdown' || phase.kind === 'recording';

  async function record() {
    setPhase({ kind: 'recording' });
    const frames = await capture(RECORD_MS);
    if (frames.length === 0) {
      setPhase({ kind: 'idle' });
      setMessage('Nessun fotogramma registrato: la webcam era accesa e la mano in vista?');
      return;
    }
    const clip: Recording = {
      expect: expect || null,
      armed: expect !== 'GESTURES_TOGGLE',
      frames,
      label: label.trim(),
    };
    setPhase({ kind: 'done', clip });
    onRecorded(clip);
  }

  function start() {
    setMessage(null);
    const tick = (n: number) => {
      if (n === 0) {
        void record();
        return;
      }
      setPhase({ kind: 'countdown', n });
      timer.current = setTimeout(() => tick(n - 1), 1_000);
    };
    tick(COUNTDOWN);
  }

  async function save(clip: Recording) {
    // Il ref blocca il secondo click prima che lo stato «saving» arrivi al bottone.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const result = await onSave({
      label: label.trim(),
      expect: clip.expect,
      description: description.trim(),
      armed: clip.armed,
      frames: clip.frames,
    });
    savingRef.current = false;
    setSaving(false);
    if (result.ok) {
      setPhase({ kind: 'idle' });
      setMessage('Registrazione salvata.');
    } else {
      setMessage(LAB_MESSAGES[result.error]);
    }
  }

  function download(clip: Recording) {
    const json = JSON.stringify({ ...clip, description: description.trim() });
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'gesture';
    link.download = `${clip.expect ?? 'NUOVA'}-${slug}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <h2 className="text-sm font-semibold text-muted">Registra</h2>
      <label className="flex flex-col gap-1 text-xs">
        Nome della gesture
        <input
          aria-label="Nome della gesture"
          maxLength={60}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-tile border border-line bg-stage px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Evento atteso
        <select
          aria-label="Evento atteso"
          value={expect}
          onChange={(e) => setExpect(e.target.value as GestureEvent['type'] | '')}
          className="rounded-tile border border-line bg-stage px-2 py-1"
        >
          <option value="">Gesture nuova</option>
          {EVENTS.map((event) => (
            <option key={event} value={event}>
              {event}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Descrizione
        <textarea
          aria-label="Descrizione"
          maxLength={500}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-tile border border-line bg-stage px-2 py-1"
        />
      </label>
      <Button
        variant="accent"
        disabled={!live || label.trim() === '' || busy}
        onClick={start}
      >
        Registra
      </Button>
      {!live && <p className="text-xs text-muted">Accendi la webcam per registrare.</p>}
      {phase.kind === 'countdown' && (
        <p aria-live="polite" className="text-2xl font-extrabold">
          {phase.n}
        </p>
      )}
      {phase.kind === 'recording' && <p aria-live="polite">Registrazione in corso…</p>}
      {phase.kind === 'done' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={saving} onClick={() => void save(phase.clip)}>
            Salva
          </Button>
          <Button size="sm" onClick={() => download(phase.clip)}>
            Scarica JSON
          </Button>
          <Button size="sm" onClick={() => setPhase({ kind: 'idle' })}>
            Scarta
          </Button>
        </div>
      )}
      {message && <p className="text-xs">{message}</p>}
    </section>
  );
}
```

- [ ] **Passo 4: verificare che passi**

Esegui: `npx vitest run tests/unit/gesture-lab-record.test.tsx`
Atteso: PASS (6 test). Poi `npm run lint`.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/app/dev/gesture-lab/lab-messages.ts apps/web/src/app/dev/gesture-lab/record-panel.tsx tests/unit/gesture-lab-record.test.tsx
git commit -m "feat(gesture-lab): record panel with countdown, save and download"
```

---

### Task 8: Archivio, Preset e contenitore

**File:**
- Crea: `apps/web/src/app/dev/gesture-lab/archive-panel.tsx`
- Crea: `apps/web/src/app/dev/gesture-lab/preset-panel.tsx`
- Crea: `apps/web/src/app/dev/gesture-lab/server-panels.tsx`
- Test: `tests/unit/gesture-lab-server-panels.test.tsx`

**Interfacce:**
- Consuma: action (Task 5), `RecordPanel` e `LAB_MESSAGES` (Task 7), tipi (Task 3, 4).
- Produce: `ServerPanels` con props
  `{ archive: LabArchive; live: boolean; capture: (ms: number) => Promise<Frame[]>; onLoad: (recording: Recording) => void; settings: LabSettings; onApplySettings: (settings: LabSettings) => void }`.

- [ ] **Passo 1: test che fallisce**

```tsx
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import type { LabArchive } from '@/lib/gesture-lab/lab-store';

const actions = vi.hoisted(() => ({
  saveRecordingAction: vi.fn(),
  getRecordingAction: vi.fn(),
  deleteRecordingAction: vi.fn(),
  savePresetAction: vi.fn(),
  deletePresetAction: vi.fn(),
}));
vi.mock('@/app/dev/gesture-lab/actions', () => actions);

const { ServerPanels } = await import('@/app/dev/gesture-lab/server-panels');

const mine = {
  id: 'r1',
  label: 'V mia',
  expect: null,
  description: '',
  authorId: 'me',
  authorName: 'Sean',
  createdAt: '2026-10-06T10:00:00Z',
};
const theirs = { ...mine, id: 'r2', label: 'swipe di Luca', authorId: 'luca', authorName: 'Luca' };
const preset = {
  id: 'p1',
  name: 'morbido',
  settings: { ...DEFAULT_LAB_SETTINGS, toggles: { ...DEFAULT_LAB_SETTINGS.toggles, feedback: true } },
  authorId: 'luca',
  authorName: 'Luca',
  createdAt: '2026-10-06T10:00:00Z',
};
const archive: LabArchive = { userId: 'me', recordings: [mine, theirs], presets: [preset] };

function setup() {
  const onLoad = vi.fn();
  const onApplySettings = vi.fn();
  render(
    <ServerPanels
      archive={archive}
      live={false}
      capture={vi.fn()}
      onLoad={onLoad}
      settings={DEFAULT_LAB_SETTINGS}
      onApplySettings={onApplySettings}
    />,
  );
  return { onLoad, onApplySettings };
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ServerPanels', () => {
  it('loads an archived recording into the replay', async () => {
    const recording = { expect: null, armed: true, frames: [], label: 'swipe di Luca' };
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: recording });
    const { onLoad } = setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'swipe di Luca' }));
    });
    expect(actions.getRecordingAction).toHaveBeenCalledWith('r2');
    expect(onLoad).toHaveBeenCalledWith(recording);
  });

  it('offers delete only on own recordings, and removes the entry', async () => {
    actions.deleteRecordingAction.mockResolvedValue({ ok: true, value: null });
    setup();
    const own = screen.getByRole('listitem', { name: 'V mia' });
    const other = screen.getByRole('listitem', { name: 'swipe di Luca' });
    expect(within(other).queryByRole('button', { name: 'Elimina' })).toBeNull();
    await act(async () => {
      fireEvent.click(within(own).getByRole('button', { name: 'Elimina' }));
    });
    expect(actions.deleteRecordingAction).toHaveBeenCalledWith('r1');
    expect(screen.queryByRole('listitem', { name: 'V mia' })).toBeNull();
  });

  it('drops an entry that no longer exists', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: false, error: 'not_found' });
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'swipe di Luca' }));
    });
    expect(screen.getByText(/Non più disponibile/)).toBeTruthy();
    expect(screen.queryByRole('listitem', { name: 'swipe di Luca' })).toBeNull();
  });

  it('applies a preset', () => {
    const { onApplySettings } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Applica morbido' }));
    expect(onApplySettings).toHaveBeenCalledWith(preset.settings);
  });

  it('saves the current settings as a preset and lists it', async () => {
    const saved = { ...preset, id: 'p2', name: 'rapido', authorId: 'me', authorName: 'Sean' };
    actions.savePresetAction.mockResolvedValue({ ok: true, value: saved });
    setup();
    fireEvent.change(screen.getByLabelText('Nome del preset'), { target: { value: 'rapido' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    });
    expect(actions.savePresetAction).toHaveBeenCalledWith({
      name: 'rapido',
      settings: DEFAULT_LAB_SETTINGS,
    });
    expect(screen.getByRole('button', { name: 'Applica rapido' })).toBeTruthy();
  });
});
```

- [ ] **Passo 2: verificare che fallisca**

Esegui: `npx vitest run tests/unit/gesture-lab-server-panels.test.tsx`
Atteso: FAIL, modulo mancante.

- [ ] **Passo 3: implementazione**

`archive-panel.tsx`:

```tsx
'use client';

import { Button } from '@omnicanvas/ui';
import type { RecordingSummary } from '@/lib/gesture-lab/lab-store';

type Props = {
  userId: string;
  recordings: RecordingSummary[];
  busy: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

const date = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

export function ArchivePanel({ userId, recordings, busy, onOpen, onDelete }: Props) {
  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <h2 className="text-sm font-semibold text-muted">Archivio</h2>
      {recordings.length === 0 && <p className="text-xs text-muted">Nessuna registrazione.</p>}
      <ul className="flex flex-col gap-1">
        {recordings.map((r) => (
          <li key={r.id} aria-label={r.label} className="flex items-center gap-2 text-xs">
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(r.id)}
              className="flex-1 text-left underline-offset-2 hover:underline"
            >
              {r.label}
            </button>
            <span className="text-muted">
              {`${r.expect ?? 'nuova'} · ${r.authorName} · ${date(r.createdAt)}`}
            </span>
            {r.authorId === userId && (
              <Button size="sm" disabled={busy} onClick={() => onDelete(r.id)}>
                Elimina
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`preset-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@omnicanvas/ui';
import type { PresetSummary } from '@/lib/gesture-lab/lab-store';

type Props = {
  userId: string;
  presets: PresetSummary[];
  busy: boolean;
  onSave: (name: string) => Promise<boolean>;
  onApply: (preset: PresetSummary) => void;
  onDelete: (id: string) => void;
};

export function PresetPanel({ userId, presets, busy, onSave, onApply, onDelete }: Props) {
  const [name, setName] = useState('');

  async function save() {
    if (await onSave(name)) setName('');
  }

  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <h2 className="text-sm font-semibold text-muted">Preset</h2>
      <div className="flex gap-2">
        <input
          aria-label="Nome del preset"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-tile border border-line bg-stage px-2 py-1 text-xs"
        />
        <Button size="sm" disabled={busy || name.trim() === ''} onClick={() => void save()}>
          Salva taratura
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {presets.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <span className="flex-1">{`${p.name} · ${p.authorName}`}</span>
            <Button size="sm" aria-label={`Applica ${p.name}`} onClick={() => onApply(p)}>
              Applica
            </Button>
            {p.authorId === userId && (
              <Button size="sm" disabled={busy} onClick={() => onDelete(p.id)}>
                Elimina
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

(Se `Button` di `@omnicanvas/ui` non inoltra `aria-label`, verificarlo nel componente e
inoltrare le props `...rest` al `<button>`.)

`server-panels.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { Frame } from '@omnicanvas/gesture';
import type { LabArchive, PresetSummary } from '@/lib/gesture-lab/lab-store';
import type { Recording } from '@/lib/gesture-lab/recording';
import type { LabSettings } from '@/lib/gesture-lab/settings';
import {
  deletePresetAction,
  deleteRecordingAction,
  getRecordingAction,
  savePresetAction,
  saveRecordingAction,
} from './actions';
import { ArchivePanel } from './archive-panel';
import { LAB_MESSAGES } from './lab-messages';
import { PresetPanel } from './preset-panel';
import { RecordPanel } from './record-panel';

type Props = {
  archive: LabArchive;
  live: boolean;
  capture: (ms: number) => Promise<Frame[]>;
  onLoad: (recording: Recording) => void;
  settings: LabSettings;
  onApplySettings: (settings: LabSettings) => void;
};

// Pannelli che parlano col server: esistono solo per un admin del laboratorio.
export function ServerPanels({ archive, live, capture, onLoad, settings, onApplySettings }: Props) {
  const [recordings, setRecordings] = useState(archive.recordings);
  const [presets, setPresets] = useState(archive.presets);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function open(id: string) {
    setBusy(true);
    const result = await getRecordingAction(id);
    setBusy(false);
    if (result.ok) {
      setMessage(null);
      onLoad(result.value);
      return;
    }
    setMessage(LAB_MESSAGES[result.error]);
    if (result.error === 'not_found') setRecordings((list) => list.filter((r) => r.id !== id));
  }

  async function removeRecording(id: string) {
    if (!window.confirm('Eliminare questa registrazione?')) return;
    setBusy(true);
    const result = await deleteRecordingAction(id);
    setBusy(false);
    if (result.ok || result.error === 'not_found')
      setRecordings((list) => list.filter((r) => r.id !== id));
    setMessage(result.ok ? null : LAB_MESSAGES[result.error]);
  }

  async function savePreset(name: string) {
    setBusy(true);
    const result = await savePresetAction({ name, settings });
    setBusy(false);
    if (!result.ok) {
      setMessage(LAB_MESSAGES[result.error]);
      return false;
    }
    setMessage(null);
    setPresets((list) => [result.value, ...list]);
    return true;
  }

  async function removePreset(id: string) {
    if (!window.confirm('Eliminare questo preset?')) return;
    setBusy(true);
    const result = await deletePresetAction(id);
    setBusy(false);
    if (result.ok || result.error === 'not_found')
      setPresets((list) => list.filter((p) => p.id !== id));
    setMessage(result.ok ? null : LAB_MESSAGES[result.error]);
  }

  return (
    <>
      <RecordPanel
        live={live}
        capture={capture}
        onRecorded={onLoad}
        onSave={async (input) => {
          const result = await saveRecordingAction(input);
          if (result.ok) setRecordings((list) => [result.value, ...list]);
          return result;
        }}
      />
      <ArchivePanel
        userId={archive.userId}
        recordings={recordings}
        busy={busy}
        onOpen={(id) => void open(id)}
        onDelete={(id) => void removeRecording(id)}
      />
      <PresetPanel
        userId={archive.userId}
        presets={presets}
        busy={busy}
        onSave={savePreset}
        onApply={(preset: PresetSummary) => onApplySettings(preset.settings)}
        onDelete={(id) => void removePreset(id)}
      />
      {message && <p className="text-xs text-danger">{message}</p>}
    </>
  );
}
```

- [ ] **Passo 4: verificare che passi**

Esegui: `npx vitest run tests/unit/gesture-lab-server-panels.test.tsx`
Atteso: PASS (5 test). Poi `npm run lint`.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/app/dev/gesture-lab/archive-panel.tsx apps/web/src/app/dev/gesture-lab/preset-panel.tsx apps/web/src/app/dev/gesture-lab/server-panels.tsx tests/unit/gesture-lab-server-panels.test.tsx
git commit -m "feat(gesture-lab): archive and preset panels backed by server actions"
```

---

### Task 9: pagina, collegamento e documenti

**File:**
- Modifica: `apps/web/src/app/dev/gesture-lab/page.tsx`
- Modifica: `apps/web/src/app/dev/gesture-lab/lab.tsx`
- Modifica: `tests/unit/gesture-lab-layout.test.tsx`
- Crea: `docs/GESTURE-LAB.md`
- Modifica: `docs/ENVIRONMENT.md`, `CLAUDE.md` (Stato attuale), `tests/fixtures/gestures/README.md`

**Interfacce:**
- Consuma: `labAccess`, `gestureLabEnabled` (Task 1), `isLabAdmin`, `loadArchive` (Task 4),
  `capture` (Task 6), `ServerPanels` (Task 8).
- Produce: `Lab` con prop `archive: LabArchive | null`.

- [ ] **Passo 1: test che fallisce**

In `tests/unit/gesture-lab-layout.test.tsx`: aggiungere `capture: vi.fn()` all'oggetto del
mock di `useGestureLab`, mock delle action come nel Task 8 (`vi.mock('@/app/dev/gesture-lab/actions', () => ({ saveRecordingAction: vi.fn(), getRecordingAction: vi.fn(), deleteRecordingAction: vi.fn(), savePresetAction: vi.fn(), deletePresetAction: vi.fn() }))`),
`render(<Lab archive={null} />)` nel test esistente, e due test nuovi:

```tsx
  it('shows the server panels only to a lab admin', () => {
    render(<Lab archive={null} />);
    expect(screen.queryByRole('heading', { name: 'Archivio' })).toBeNull();
    cleanup();
    render(<Lab archive={{ userId: 'me', recordings: [], presets: [] }} />);
    const side = screen.getByRole('complementary');
    expect(within(side).getByRole('heading', { name: 'Registra' })).toBeTruthy();
    expect(within(side).getByRole('heading', { name: 'Archivio' })).toBeTruthy();
    expect(within(side).getByRole('heading', { name: 'Preset' })).toBeTruthy();
  });
```

(importare `within` da Testing Library.)

- [ ] **Passo 2: verificare che fallisca**

Esegui: `npx vitest run tests/unit/gesture-lab-layout.test.tsx`
Atteso: FAIL (nessun pannello Archivio).

- [ ] **Passo 3: implementazione**

`lab.tsx`: `Lab` e `LabClient` ricevono `archive`; nella colonna destra, dopo `ReplayPanel`:

```tsx
export function Lab({ archive }: { archive: LabArchive | null }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? <LabClient archive={archive} /> : null;
}

function LabClient({ archive }: { archive: LabArchive | null }) {
```

```tsx
        {archive && (
          <ServerPanels
            archive={archive}
            live={lab.live === 'on'}
            capture={lab.capture}
            onLoad={lab.loadRecording}
            settings={lab.settings}
            onApplySettings={lab.setSettings}
          />
        )}
```

`page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { gestureLabEnabled, labAccess } from '@/lib/gesture-lab/access';
import { isLabAdmin, loadArchive } from '@/lib/gesture-lab/lab-store';
import { createServerSupabase } from '@/lib/supabase/server';
import { Lab } from './lab';

// Strumento di sviluppo. In locale è aperto a tutti; su Vercel esiste solo con
// GESTURE_LAB_ENABLED=true e per un admin del laboratorio, altrimenti è un 404.
export default async function GestureLabPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = data.user;
  const isAdmin = user ? await isLabAdmin(supabase) : false;
  const access = labAccess({
    nodeEnv: process.env.NODE_ENV,
    enabled: gestureLabEnabled(),
    isAdmin,
  });
  if (access === 'hidden') notFound();
  const archive = access === 'admin' && user ? await loadArchive(supabase, user.id) : null;
  return <Lab archive={archive} />;
}
```

- [ ] **Passo 4: verificare**

Esegui: `npx vitest run tests/unit/gesture-lab-layout.test.tsx` (PASS), poi l'intera
verifica: `npm run typecheck`, `npm run lint`, `npm test` (attesi verdi salvo i file
`tests/db/*`, che in locale non partono senza Supabase).

Prova a mano in locale: `npm run dev`, apri `http://localhost:3000/dev/gesture-lab` senza
login: il laboratorio si apre come prima, senza Registra, Archivio e Preset, e senza errori
nel terminale.

- [ ] **Passo 5: documenti**

`docs/GESTURE-LAB.md` (nuovo):

```markdown
# Laboratorio gesture

Pagina `/dev/gesture-lab`: si vede la mano, si tarano le gesture, si registrano e si
rigiocano. Spec: `docs/specs/2026-10-05-gesture-lab-design.md` e
`docs/specs/2026-10-06-gesture-lab-staging-design.md`.

## Dove si apre

- **In locale** (`npm run dev`): sempre. Con login di un admin compaiono Registra, Archivio
  e Preset.
- **Su staging**: solo con `GESTURE_LAB_ENABLED=true` (variabili Preview su Vercel) e per un
  admin loggato. Per chiunque altro è un 404. Prima si entra da `/login`, poi si apre
  `https://omnicanvas-staging.vercel.app/dev/gesture-lab`.
- **In produzione**: mai (la variabile non c'è).

## Aggiungere un admin

1. La persona si registra dal login di staging.
2. Nel SQL editor del progetto Supabase `aiconference`:

   ```sql
   insert into public.gesture_lab_admins (user_id)
   select id from auth.users where email = 'email@esempio.it';
   ```

Per toglierlo: `delete from public.gesture_lab_admins where user_id = (select id from auth.users where email = '…');`

## Dalle registrazioni al codice

- **Taratura**: «Copia come codice» e incollare nei predefiniti di `packages/gesture`, con un test.
- **Gesture nota riconosciuta male**: scaricare il JSON e metterlo in
  `tests/fixtures/gestures/`: diventa un test.
- **Gesture nuova** (`expect: null`): gli esempi servono a scrivere il riconoscitore. Il test
  delle fixture le salta; quando il riconoscitore esiste, si cambia `expect` nel file.

## Dati

Solo landmark della mano e testo scritto dall'admin. Mai immagini, audio o riunioni.
```

`docs/ENVIRONMENT.md`, nella tabella delle variabili server:

```markdown
| `GESTURE_LAB_ENABLED` | `true` solo su Preview: apre `/dev/gesture-lab` agli admin del laboratorio su staging. Assente in produzione. Letta da `gestureLabEnabled()`, non da `serverEnv()` |
```

`tests/fixtures/gestures/README.md`: aggiungere «Si registrano anche dal laboratorio
(«Scarica JSON»). Le gesture nuove (`expect: null`) non sono test: il test le salta.»

`CLAUDE.md`, in «Stato attuale» dopo la riga del laboratorio: «Su
`slice/gesture-lab-staging` il laboratorio va su staging per gli admin
(`docs/GESTURE-LAB.md`), con registrazioni e preset su Supabase (migrazione 0006).»

- [ ] **Passo 6: commit**

```bash
git add apps/web/src/app/dev/gesture-lab tests/unit/gesture-lab-layout.test.tsx docs/GESTURE-LAB.md docs/ENVIRONMENT.md tests/fixtures/gestures/README.md CLAUDE.md
git commit -m "feat(gesture-lab): server-gated page with admin panels, docs"
```

---

### Task 10: messa in staging (passi esterni, confermati con Sean uno per uno)

Nessun codice. Ogni passo tocca servizi esterni: chiedere conferma a Sean prima di ognuno.

- [ ] **Passo 1: push e PR**

```bash
git push -u origin slice/gesture-lab-staging
"/c/Program Files/GitHub CLI/gh.exe" pr create --base slice/gesture-lab --title "Gesture lab on staging for lab admins" --body-file <file>
```

Atteso: CI verde, compreso il job `db` con `tests/db/gesture-lab.test.ts`.

- [ ] **Passo 2: migrazione su staging**

```bash
npx supabase db push
```

Atteso: applicata `0006_gesture_lab.sql` sul progetto `aiconference`
(`okymzngnbxkwklhfdrjj`). Verifica: `list_tables` mostra le tre tabelle con RLS attiva.

- [ ] **Passo 3: variabile su Preview**

```bash
npx vercel env add GESTURE_LAB_ENABLED preview
```

valore `true`. Non su Production.

- [ ] **Passo 4: deploy e alias**

```bash
npx vercel deploy --yes
npx vercel alias set <url-del-deploy> omnicanvas-staging.vercel.app
```

Verifica: senza login, `https://omnicanvas-staging.vercel.app/dev/gesture-lab` → 404.

- [ ] **Passo 5: admin**

Sean (o Claude con conferma) esegue nel SQL editor la riga di `docs/GESTURE-LAB.md` per sé e
per l'amico, dopo che l'amico si è registrato. Verifica: da loggato admin la pagina si apre
con Registra, Archivio e Preset.
```
