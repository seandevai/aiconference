import type { ReactNode } from 'react';

type Props = {
  areaRef: React.RefObject<HTMLDivElement | null>;
  hand: ReactNode;
  stage: ReactNode;
};

// Mano e palco secondo lo schermo (spec §2): telefono verticale mano sopra e palco sotto,
// telefono orizzontale affiancati, computer palco grande sopra e mano sotto.
export function LabScene({ areaRef, hand, stage }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 max-lg:landscape:flex-row">
      <div className="flex h-[38dvh] shrink-0 justify-center max-lg:landscape:h-auto max-lg:landscape:w-1/2 lg:order-2 lg:h-[35%]">
        {hand}
      </div>
      <div
        ref={areaRef}
        className="relative flex min-h-[200px] flex-1 flex-col overflow-hidden lg:order-1"
      >
        {stage}
      </div>
    </div>
  );
}
