import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Il Codespace sostituisce Docker locale: deve avere lo stesso Node della CI,
// Docker dentro il container per Supabase e le porte che servono alle prove.
const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

describe('devcontainer', () => {
  const config = JSON.parse(read('.devcontainer/devcontainer.json')) as {
    image: string;
    features: Record<string, unknown>;
    forwardPorts: number[];
    postCreateCommand: string;
    postStartCommand: string;
  };

  it('uses the same Node major as CI', () => {
    const ciNode = read('.github/workflows/ci.yml').match(/node-version:\s*(\d+)/)?.[1];
    expect(ciNode).toBeDefined();
    expect(config.image).toContain(`node:1-${ciNode}`);
  });

  it('runs Docker inside the container for supabase start', () => {
    expect(Object.keys(config.features).some((f) => f.includes('docker-in-docker'))).toBe(true);
  });

  it('exposes sshd so gh codespace ssh can drive it', () => {
    expect(Object.keys(config.features).some((f) => f.includes('/sshd:'))).toBe(true);
  });

  it('forwards app, Supabase API, Studio and LiveKit ports', () => {
    expect(config.forwardPorts).toEqual(expect.arrayContaining([3000, 54321, 54323, 7880]));
  });

  it('installs deps and the Playwright browser on create', () => {
    expect(config.postCreateCommand).toContain('npm ci');
    expect(config.postCreateCommand).toMatch(/playwright install --with-deps chromium/);
  });

  it('starts local services through a script that exists', () => {
    const script = config.postStartCommand.match(/\.devcontainer\/[\w-]+\.sh/)?.[0];
    expect(script).toBe('.devcontainer/start-services.sh');
    expect(existsSync(new URL(script!, root))).toBe(true);
  });

  it('starts Supabase and a pinned LiveKit dev server', () => {
    const script = read('.devcontainer/start-services.sh');
    expect(script).toContain('npx supabase start');
    expect(script).toContain('livekit/livekit-server:v1.13.7');
    expect(script).toContain('--dev');
  });

  it('completes .env.local without secrets committed to the script', () => {
    const script = read('.devcontainer/start-services.sh');
    expect(script).toContain('supabase status -o env');
    expect(script).toContain('openssl rand -hex 32');
    expect(script).toContain('ensure NEXT_PUBLIC_LIVEKIT_URL');
    expect(script).not.toMatch(/eyJhbGciOi/);
  });
});
