// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from '@/app/(auth)/auth-form';

afterEach(cleanup);
const noop = vi.fn(async () => ({ error: null, info: null }));

describe('AuthForm', () => {
  it('shows the Nod logo, the fields and the privacy promise on login', () => {
    render(<AuthForm mode="login" action={noop} next="/dashboard" />);
    expect(screen.getByRole('img', { name: 'Nod' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.queryByLabelText('Nome')).toBeNull();
    expect(screen.getByRole('button', { name: 'Entra' })).toBeTruthy();
    expect(
      screen.getByText(/Niente di ciò che si dice in riunione resta sui nostri server/),
    ).toBeTruthy();
  });

  it('asks for the name on signup and links back to login keeping next', () => {
    render(<AuthForm mode="signup" action={noop} next="/room/ABCD2345" />);
    expect(screen.getByLabelText('Nome')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Registrati' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Accedi' }).getAttribute('href')).toBe(
      '/login?next=%2Froom%2FABCD2345',
    );
  });

  it('uses only theme tokens, never the prototype greys', () => {
    const { container } = render(<AuthForm mode="login" action={noop} next="/dashboard" />);
    expect(container.innerHTML).not.toMatch(/neutral-|emerald-|red-4/);
  });
});
