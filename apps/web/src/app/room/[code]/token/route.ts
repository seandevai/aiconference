import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clientEnv, serverEnv } from '@/env';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import { issueRoomToken } from '@/lib/rooms/room-token';
import { toTokenResponse } from '@/lib/rooms/token-response';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

// POST e non GET: un token non deve finire in cache né partire da un link.
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const store = await cookies();
  const env = serverEnv();

  const result = await issueRoomToken(
    createAdminSupabase(),
    {
      joinCode: code,
      userId: auth.user?.id ?? null,
      guestParticipantId: (roomId) => readGuestParticipantId(store, roomId),
    },
    {
      url: clientEnv.NEXT_PUBLIC_LIVEKIT_URL,
      apiKey: env.LIVEKIT_API_KEY,
      apiSecret: env.LIVEKIT_API_SECRET,
    },
  );

  const { status, body } = toTokenResponse(result);
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
