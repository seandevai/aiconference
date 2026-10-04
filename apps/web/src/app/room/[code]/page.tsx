import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { serverEnv } from '@/env';
import { guestCookieName, verifyGuestToken } from '@/lib/rooms/guest-token';
import { isValidJoinCode, normalizeJoinCode } from '@/lib/rooms/join-code';
import { findActiveParticipant, joinRoom } from '@/lib/rooms/join-room';
import { isRoomOver } from '@/lib/rooms/timer';
import { showSampleContent } from '@/lib/stage/sample-content';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { RoomEnded } from './ended';
import { GuestJoinForm } from './guest-join-form';
import { RoomShell } from './room-shell';

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: typed } = await params;
  const code = normalizeJoinCode(typed);
  if (!isValidJoinCode(code)) notFound();
  // Un solo indirizzo per stanza: le route del token e del palco ricevono il codice canonico.
  if (code !== typed) redirect(`/room/${code}`);

  const showSamples = showSampleContent(serverEnv().AI_PROVIDER);
  const admin = createAdminSupabase();
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  // Utente registrato: host se ha creato la stanza, altrimenti ospite con account.
  if (auth.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', auth.user.id)
      .single();
    const displayName = profile?.display_name?.trim().slice(0, 40) || 'Utente';
    const result = await joinRoom(admin, {
      joinCode: code,
      userId: auth.user.id,
      displayName,
      // La scelta della lingua per gli utenti registrati arriva con i sottotitoli (slice 6).
      language: 'it',
    });
    if (result.kind === 'not_found') notFound();
    if (result.kind === 'ended') return <RoomEnded />;
    if (result.kind === 'invalid') throw new Error(`profile invalid for join: ${result.field}`);
    return (
      <RoomShell
        joinCode={code}
        title={result.room.title}
        role={result.role}
        displayName={displayName}
        showSamples={showSamples}
      />
    );
  }

  // Anonimo: rientra se ha un cookie valido e la sua riga è ancora aperta.
  const { data: room } = await admin
    .from('rooms')
    .select('id, title, status, ends_at')
    .eq('join_code', code)
    .maybeSingle();
  if (!room) notFound();
  if (isRoomOver({ status: room.status, endsAt: room.ends_at }, new Date())) {
    return <RoomEnded />;
  }

  const token = (await cookies()).get(guestCookieName(room.id))?.value;
  const participantId = token
    ? verifyGuestToken(token, room.id, serverEnv().GUEST_SESSION_SECRET)
    : null;
  const participant = participantId
    ? await findActiveParticipant(admin, room.id, participantId)
    : null;
  if (participant) {
    return (
      <RoomShell
        joinCode={code}
        title={room.title}
        role={participant.role}
        displayName={participant.displayName}
        showSamples={showSamples}
      />
    );
  }

  return <GuestJoinForm joinCode={code} />;
}
