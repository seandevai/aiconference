import { notFound } from 'next/navigation';
import { Lab } from './lab';

// Strumento di sviluppo: mai in produzione.
export default function GestureLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Lab />;
}
