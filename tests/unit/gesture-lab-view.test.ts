import { describe, expect, it } from 'vitest';
import { resolveView, viewSearch } from '@/lib/gesture-lab/lab-view';

const params = (search: string) => new URLSearchParams(search);

describe('resolveView', () => {
  it('opens the home without a view', () => {
    expect(resolveView(params(''), true)).toEqual({ view: 'home', id: null });
  });

  it('opens a known view', () => {
    expect(resolveView(params('?vista=prova'), false)).toEqual({ view: 'prova', id: null });
    expect(resolveView(params('?vista=registra'), true)).toEqual({ view: 'registra', id: null });
  });

  it('falls back to the home for an unknown view', () => {
    expect(resolveView(params('?vista=taratura'), true)).toEqual({ view: 'home', id: null });
  });

  it('keeps record and replay for those with the archive', () => {
    expect(resolveView(params('?vista=registra'), false).view).toBe('home');
    expect(resolveView(params('?vista=rigioca&id=r1'), false).view).toBe('home');
  });

  it('reads the recording id only in the replay', () => {
    expect(resolveView(params('?vista=rigioca&id=r1'), true)).toEqual({
      view: 'rigioca',
      id: 'r1',
    });
    expect(resolveView(params('?vista=rigioca&id='), true).id).toBeNull();
    expect(resolveView(params('?vista=prova&id=r1'), true).id).toBeNull();
  });
});

describe('viewSearch', () => {
  it('writes the view, and the id only for the replay', () => {
    expect(viewSearch('home')).toBe('');
    expect(viewSearch('prova')).toBe('?vista=prova');
    expect(viewSearch('rigioca', 'r1')).toBe('?vista=rigioca&id=r1');
    expect(viewSearch('registra', 'r1')).toBe('?vista=registra');
  });

  it('goes back and forth with resolveView', () => {
    const search = viewSearch('rigioca', 'a b');
    expect(resolveView(params(search), true)).toEqual({ view: 'rigioca', id: 'a b' });
  });
});
