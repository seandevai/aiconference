import { NextResponse } from 'next/server';
import { createKv } from '@/lib/kv/kv';
import { requesterOf } from '@/lib/rooms/requester';
import { extendRoom } from '@/lib/rooms/room-lifecycle';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const payload = (await request.json().catch(() => null)) as { minutes?: unknown } | null;
  const { status, body } = await extendRoom(
    createAdminSupabase(),
    createKv(),
    await requesterOf(code),
    payload?.minutes,
  );
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
