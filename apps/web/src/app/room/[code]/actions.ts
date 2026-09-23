'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverEnv } from '@/env';
import { GUEST_TOKEN_TTL_SECONDS, guestCookieName, signGuestToken } from '@/lib/rooms/guest-token';
import { joinRoom } from '@/lib/rooms/join-room';
import { createAdminSupabase } from '@/lib/supabase/admin';

export type GuestJoinState = { error: string | null };

export async function joinAsGuestAction(
  joinCode: string,
  _prev: GuestJoinState,
  formData: FormData,
): Promise<GuestJoinState> {
  const result = await joinRoom(createAdminSupabase(), {
    joinCode,
    userId: null,
    displayName: String(formData.get('display_name') ?? ''),
    language: String(formData.get('language') ?? ''),
  });

  switch (result.kind) {
    case 'invalid':
      return {
        error:
          result.field === 'displayName'
            ? 'Scrivi un nome da mostrare agli altri (massimo 40 caratteri).'
            : 'Scegli una lingua dalla lista.',
      };
    case 'not_found':
      return { error: 'Questa stanza non esiste. Controlla il link che hai ricevuto.' };
    case 'ended':
      return { error: 'Questa riunione è terminata.' };
    case 'joined': {
      const store = await cookies();
      store.set(
        guestCookieName(result.room.id),
        signGuestToken({ participantId: result.participantId, roomId: result.room.id }, serverEnv().GUEST_SESSION_SECRET),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: `/room/${joinCode}`,
          maxAge: GUEST_TOKEN_TTL_SECONDS,
        },
      );
      redirect(`/room/${joinCode}`);
    }
  }
}
