import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { agentAdapter } from '@/lib/ai/adapter';
import { readAgentUsage, runAgentRequest } from '@/lib/ai/agent-request';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import type { ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
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

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(_request: Request, { params }: Context) {
  const { code } = await params;
  const { status, body } = await readAgentUsage(createAdminSupabase(), await who(code));
  return NextResponse.json(body, { status, headers: noStore });
}

// Il prompt resta in memoria per la durata della richiesta: niente log, niente disco.
export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  const result = await runAgentRequest(
    createAdminSupabase(),
    agentAdapter(),
    await who(code),
    prompt,
  );
  return NextResponse.json(result.body, { status: result.status, headers: noStore });
}
