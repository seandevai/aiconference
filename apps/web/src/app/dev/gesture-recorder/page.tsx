import { notFound } from 'next/navigation';
import { Recorder } from './recorder';

// Strumento di sviluppo: mai in produzione.
export default function GestureRecorderPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Recorder />;
}
