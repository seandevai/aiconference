import type { ReactNode } from 'react';
import { Button, cx } from '@omnicanvas/ui';

export type SceneVariant = 'stage' | 'bench';

type Props = {
  areaRef: React.RefObject<HTMLDivElement | null>;
  variant: SceneVariant;
  hand: ReactNode;
  stage: ReactNode;
  panel: ReactNode;
  stageShown: boolean;
  onToggleStage: () => void;
};

// Dove il palco non si vede: sul telefono finché non lo si chiede, nel banco su schermo largo.
// Resta montato comunque: finestre e fuoco non si perdono e le gesture continuano ad agire.
export function stageHiddenClass(variant: SceneVariant, stageShown: boolean): string {
  return cx(!stageShown && 'max-lg:hidden', variant === 'bench' && 'lg:hidden');
}

// Mano, palco e numeri secondo lo schermo (spec 09/10). Telefono: la mano a tutto spazio, il
// palco al suo posto a richiesta. Computer: palco grande e mano sotto (stage), oppure mano
// sopra e numeri sotto (bench).
export function LabScene({
  areaRef,
  variant,
  hand,
  stage,
  panel,
  stageShown,
  onToggleStage,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Button
        aria-pressed={stageShown}
        onClick={onToggleStage}
        className="shrink-0 self-start lg:hidden"
      >
        {stageShown ? 'Nascondi il palco' : 'Mostra il palco'}
      </Button>
      <div
        className={cx(
          'flex min-h-0 flex-1 justify-center',
          stageShown && 'max-lg:hidden',
          variant === 'stage' ? 'lg:order-2 lg:h-[35%] lg:flex-none' : 'lg:flex-1',
        )}
      >
        {hand}
      </div>
      <div
        ref={areaRef}
        className={cx(
          'relative flex min-h-[200px] flex-1 flex-col overflow-hidden lg:order-1',
          stageHiddenClass(variant, stageShown),
        )}
      >
        {stage}
      </div>
      {variant === 'bench' && (
        <div className="min-h-0 shrink-0 overflow-hidden max-lg:hidden lg:order-3 lg:h-[40%]">
          {panel}
        </div>
      )}
    </div>
  );
}
