// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRoom } from '@/lib/dashboard/model';

vi.mock('@/app/dashboard/actions', () => ({
  createRoomAction: vi.fn(async () => ({ error: null })),
  updateDisplayName: vi.fn(async () => ({ error: null, saved: true })),
}));

const { MeetingList } = await import('@/app/dashboard/meeting-list');
const { CopyLinkButton } = await import('@/app/dashboard/copy-link-button');
const { NewMeeting } = await import('@/app/dashboard/new-meeting');
const { CreditsCard } = await import('@/app/dashboard/credits-card');
const { ProfileCard } = await import('@/app/dashboard/profile-card');
const actions = await import('@/app/dashboard/actions');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const now = new Date('2026-09-30T10:00:00Z');
const room = (over: Partial<DashboardRoom>): DashboardRoom => ({
  id: over.id ?? 'r',
  title: 'Riunione',
  joinCode: 'ABCD2345',
  status: 'created',
  startedAt: null,
  endedAt: null,
  createdAt: '2026-09-29T08:00:00Z',
  ...over,
});

describe('MeetingList', () => {
  it('hides empty groups and offers the link only for live and ready meetings', () => {
    render(
      <MeetingList
        now={now}
        creditsByRoom={{ past: 36 }}
        rooms={[
          room({
            id: 'live',
            title: 'Kickoff Ferretti',
            status: 'active',
            startedAt: '2026-09-30T09:40:00Z',
          }),
          room({
            id: 'past',
            title: 'Demo Ormea',
            status: 'closed',
            startedAt: '2026-09-29T08:00:00Z',
            endedAt: '2026-09-29T08:48:00Z',
          }),
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'In corso' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pronte' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Passate' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Copia link/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Rientra/ }).getAttribute('href')).toBe(
      '/room/ABCD2345',
    );
    expect(screen.getByText('29 set · 48 min · 36 crediti')).toBeTruthy();
  });

  it('keeps long titles inside the row', () => {
    render(<MeetingList now={now} creditsByRoom={{}} rooms={[room({ title: 'x'.repeat(120) })]} />);
    // Il titolo torna anche nel testo nascosto del link «Apri»: qui serve la riga.
    const title = screen.getByText('x'.repeat(120), { ignore: 'a *' });
    expect(title.className).toContain('truncate');
    expect(title.className).toContain('min-w-0');
  });

  it('shows the first-meeting steps when there are no meetings', () => {
    render(<MeetingList now={now} creditsByRoom={{}} rooms={[]} />);
    expect(screen.getByRole('heading', { name: 'Prima riunione' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('CopyLinkButton', () => {
  // Il link nasce dall'indirizzo della pagina, non da una variabile d'ambiente che nel
  // Codespace o in CI vale localhost.
  const origin = () => window.location.origin;

  it('confirms after copying, and says so to screen readers', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyLinkButton path="/room/ABCD2345" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Link copiato' })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(`${origin()}/room/ABCD2345`);
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Link copiato');
  });

  it('shows the link to copy by hand when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
    });
    render(<CopyLinkButton path="/room/ABCD2345" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia link' }));
    const field = await screen.findByRole('textbox', { name: 'Link della riunione' });
    expect((field as HTMLInputElement).value).toBe(`${origin()}/room/ABCD2345`);
    expect(field.hasAttribute('readonly')).toBe(true);
    // Il pulsante sparisce: il focus passa al campo, non cade su <body>.
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it('falls back also when there is no clipboard at all', async () => {
    vi.stubGlobal('navigator', {});
    render(<CopyLinkButton path="/room/ABCD2345" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia link' }));
    expect(await screen.findByRole('textbox', { name: 'Link della riunione' })).toBeTruthy();
  });
});

describe('NewMeeting', () => {
  it('opens the title field from the button and never closes it from there', () => {
    render(<NewMeeting defaultOpen={false} />);
    expect(screen.queryByLabelText('Titolo della riunione')).toBeNull();
    const open = screen.getByRole('button', { name: 'Nuova riunione' });
    fireEvent.click(open);
    fireEvent.click(open);
    expect(screen.getByLabelText('Titolo della riunione')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByLabelText('Titolo della riunione')).toBeNull();
  });

  it('starts open for a new user', () => {
    render(<NewMeeting defaultOpen />);
    expect(screen.getByLabelText('Titolo della riunione')).toBeTruthy();
  });
});

describe('CreditsCard', () => {
  it('shows the balance and this month use', () => {
    render(<CreditsCard now={now} credits={{ balance: 1240, usedThisMonth: 129 }} />);
    expect(screen.getByText('1.240')).toBeTruthy();
    expect(screen.getByText('129 usati a settembre')).toBeTruthy();
  });
  it('shows a dash when credits could not be read', () => {
    render(<CreditsCard now={now} credits={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('ProfileCard', () => {
  it('edits the name in place and keeps what was typed when the server refuses it', async () => {
    vi.mocked(actions.updateDisplayName).mockResolvedValueOnce({
      error: 'Scrivi il tuo nome, al massimo 40 caratteri.',
      saved: false,
    });
    render(<ProfileCard displayName="Giulia Rinaldi" />);
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
    const field = screen.getByLabelText('Nome') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.submit(field.form!);
    expect(await screen.findByText('Scrivi il tuo nome, al massimo 40 caratteri.')).toBeTruthy();
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('   ');
  });
});
