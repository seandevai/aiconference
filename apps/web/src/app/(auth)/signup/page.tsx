import { safeNextPath } from '@/lib/auth/next-path';
import { signUp } from '../actions';
import { AuthForm } from '../auth-form';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" action={signUp} next={safeNextPath(next)} />;
}
