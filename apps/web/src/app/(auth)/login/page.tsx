import { safeNextPath } from '@/lib/auth/next-path';
import { signIn } from '../actions';
import { AuthForm } from '../auth-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="login" action={signIn} next={safeNextPath(next)} />;
}
