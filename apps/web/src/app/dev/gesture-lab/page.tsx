import { notFound } from 'next/navigation';
import { gestureLabEnabled, labAccess } from '@/lib/gesture-lab/access';
import { isLabAdmin, loadArchive } from '@/lib/gesture-lab/lab-store';
import { createServerSupabase } from '@/lib/supabase/server';
import { Lab } from './lab';

// Strumento di sviluppo. In locale è aperto a tutti; su Vercel esiste solo con
// GESTURE_LAB_ENABLED=true e per un admin del laboratorio, altrimenti è un 404.
export default async function GestureLabPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = data.user;
  const isAdmin = user ? await isLabAdmin(supabase) : false;
  const access = labAccess({
    nodeEnv: process.env.NODE_ENV,
    enabled: gestureLabEnabled(),
    isAdmin,
  });
  if (access === 'hidden') notFound();
  const archive = access === 'admin' && user ? await loadArchive(supabase, user.id) : null;
  return <Lab archive={archive} />;
}
