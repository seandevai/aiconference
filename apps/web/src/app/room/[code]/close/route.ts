import { NextResponse } from 'next/server';
import { closeRoom } from '@omnicanvas/realtime/server';
import { clientEnv, serverEnv } from '@/env';
import { createKv } from '@/lib/kv/kv';
import { requesterOf } from '@/lib/rooms/requester';
import { closeRoomAsHost } from '@/lib/rooms/room-lifecycle';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const env = serverEnv();
  const livekit = {
    url: clientEnv.NEXT_PUBLIC_LIVEKIT_URL,
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
  };
  const { status, body } = await closeRoomAsHost(
    createAdminSupabase(),
    createKv(),
    await requesterOf(code),
    (roomId) => closeRoom(roomId, livekit),
  );
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
