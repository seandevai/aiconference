// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Icon, ICON_NAMES } from '@omnicanvas/ui';

afterEach(cleanup);

describe('Icon', () => {
  it('draws every icon of the set as a decorative svg', () => {
    for (const name of ICON_NAMES) {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
      expect(svg!.querySelector('path, rect, circle, line, polyline')).not.toBeNull();
      cleanup();
    }
  });

  it('follows the text colour, so it never brings its own palette', () => {
    const { container } = render(<Icon name="hand" />);
    expect(container.querySelector('svg')!.getAttribute('stroke')).toBe('currentColor');
  });

  it('adds nothing to the accessible name of a button', () => {
    render(
      <Button>
        <Icon name="hand" /> Attiva le gesture
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Attiva le gesture' })).toBeTruthy();
  });
});

describe('Button press feedback', () => {
  it('gives way slightly under the finger, only when motion is allowed', () => {
    render(<Button>Invia</Button>);
    expect(screen.getByRole('button').className).toContain('motion-safe:active:scale-[0.97]');
  });
});
