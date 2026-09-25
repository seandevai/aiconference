import { notFound } from 'next/navigation';
import { SpikeCpu } from './spike-cpu';

// Spike usa-e-getta (piano slice 2, task 2.11): mai in produzione.
export default function SpikeCpuPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <SpikeCpu />;
}
