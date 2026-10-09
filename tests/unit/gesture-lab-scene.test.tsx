// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LabScene, stageHiddenClass, type SceneVariant } from '@/app/dev/gesture-lab/lab-scene';

function renderScene(variant: SceneVariant, stageShown = false) {
  const onToggleStage = vi.fn();
  render(
    <LabScene
      areaRef={{ current: null }}
      variant={variant}
      hand={<p>mano</p>}
      stage={<p>palco</p>}
      panel={<p>numeri</p>}
      stageShown={stageShown}
      onToggleStage={onToggleStage}
    />,
  );
  const box = (text: string) => screen.getByText(text).parentElement as HTMLElement;
  return { onToggleStage, box };
}

afterEach(cleanup);

describe('stageHiddenClass', () => {
  it('hides the stage on phones until asked, and always in the bench on a wide screen', () => {
    expect(stageHiddenClass('stage', false)).toBe('max-lg:hidden');
    expect(stageHiddenClass('stage', true)).toBe('');
    expect(stageHiddenClass('bench', false)).toBe('max-lg:hidden lg:hidden');
    expect(stageHiddenClass('bench', true)).toBe('lg:hidden');
  });
});

describe('LabScene', () => {
  it('keeps the stage mounted even while hidden, so gestures still move the windows', () => {
    const { box } = renderScene('stage');
    expect(screen.getByText('palco')).toBeTruthy();
    expect(box('palco').className).toContain('max-lg:hidden');
  });

  it('shows the hand on phones and the stage on request, with a named button', () => {
    const { onToggleStage, box } = renderScene('stage');
    expect(box('mano').className).not.toContain('max-lg:hidden');
    const button = screen.getByRole('button', { name: 'Mostra il palco' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.className).toContain('lg:hidden');
    fireEvent.click(button);
    expect(onToggleStage).toHaveBeenCalledTimes(1);
  });

  it('swaps hand and stage on phones once the stage is shown', () => {
    const { box } = renderScene('stage', true);
    expect(box('mano').className).toContain('max-lg:hidden');
    expect(box('palco').className).not.toContain('max-lg:hidden');
    expect(screen.getByRole('button', { name: 'Nascondi il palco' })).toBeTruthy();
  });

  it('puts the numbers under the hand in the bench, never on phones', () => {
    const { box } = renderScene('bench');
    expect(box('numeri').className).toContain('max-lg:hidden');
    expect(box('palco').className).toContain('lg:hidden');
  });

  it('has no numbers in the stage variant', () => {
    renderScene('stage');
    expect(screen.queryByText('numeri')).toBeNull();
  });
});
