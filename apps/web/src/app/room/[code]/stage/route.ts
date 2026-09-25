import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createKv } from '@/lib/kv/kv';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import type { ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
import { readStage, writeStage, type StageAccessResult } from '@/lib/stage/stage-access';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

type Context = { params: Promise<{ code: string }> };

async function who(code: string): Promise<ResolveParticipantInput> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const store = await cookies();
  return {
    joinCode: code,
    userId: auth.user?.id ?? null,
    guestParticipantId: (roomId) => readGuestParticipantId(store, roomId),
  };
}

function respond({ status, body }: StageAccessResult) {
  const headers = { 'Cache-Control': 'no-store' };
  return status === 204
    ? new Response(null, { status, headers })
    : NextResponse.json(body, { status, headers });
}

export async function GET(_request: Request, { params }: Context) {
  const { code } = await params;
  return respond(await readStage(createAdminSupabase(), createKv(), await who(code)));
}

export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  return respond(
    await writeStage(createAdminSupabase(), createKv(), await who(code), await request.text()),
  );
}
