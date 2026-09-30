import { Menu, faceInitial } from '@omnicanvas/ui';
import { signOut } from '@/app/(auth)/actions';

export function ProfileMenu({ displayName }: { displayName: string }) {
  return (
    <Menu
      triggerLabel={`Menu di ${displayName}`}
      label={
        <>
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full bg-line text-xs font-extrabold"
          >
            {faceInitial(displayName)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
        </>
      }
    >
      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center rounded-tile px-3 text-left text-sm hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
        >
          Esci
        </button>
      </form>
    </Menu>
  );
}
