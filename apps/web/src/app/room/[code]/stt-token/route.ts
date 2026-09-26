import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { sttConfig } from '@/lib/voice/stt-config';
import { runSttToken } from '@/lib/voice/stt-token';

type Context = { params: Promise<{ code: string }> };

// Emette solo un token: l'audio va dal browser a Deepgram e non passa di qui (ADR-0006).
export async function POST(_request: Request, { params }: Context) {
  const { code } = await params;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const store = await cookies();
  const result = await runSttToken(createAdminSupabase(), sttConfig(), {
    joinCode: code,
    userId: auth.user?.id ?? null,
    guestParticipantId: (roomId) => readGuestParticipantId(store, roomId),
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
