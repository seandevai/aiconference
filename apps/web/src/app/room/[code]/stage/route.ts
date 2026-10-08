import { NextResponse } from 'next/server';
import { createKv } from '@/lib/kv/kv';
import { requesterOf } from '@/lib/rooms/requester';
import { readStage, writeStage, type StageAccessResult } from '@/lib/stage/stage-access';
import { createAdminSupabase } from '@/lib/supabase/admin';

type Context = { params: Promise<{ code: string }> };

function respond({ status, body }: StageAccessResult) {
  const headers = { 'Cache-Control': 'no-store' };
  return status === 204
    ? new Response(null, { status, headers })
    : NextResponse.json(body, { status, headers });
}

export async function GET(_request: Request, { params }: Context) {
  const { code } = await params;
  return respond(await readStage(createAdminSupabase(), createKv(), await requesterOf(code)));
}

export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  return respond(
    await writeStage(createAdminSupabase(), createKv(), await requesterOf(code), await request.text()),
  );
}
