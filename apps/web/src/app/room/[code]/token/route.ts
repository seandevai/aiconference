import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clientEnv, serverEnv } from '@/env';
import { createKv } from '@/lib/kv/kv';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import { issueRoomToken } from '@/lib/rooms/room-token';
import { toTokenResponse } from '@/lib/rooms/token-response';
import { allowTokenRequest, tokenRateSubject } from '@/lib/rooms/token-rate-limit';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

// POST e non GET: un token non deve finire in cache né partire da un link.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  // Su Vercel il primo indirizzo di x-forwarded-for è quello del client.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const rate = await allowTokenRequest(createKv(), tokenRateSubject(auth.user?.id ?? null, ip));
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(rate.retryAfterSeconds) },
      },
    );
  }
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
