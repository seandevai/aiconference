import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['400', '500', '600', '800'],
});

export const metadata: Metadata = {
  title: 'Nod',
  description:
    'Videochiamate con un palco generativo. Nessun contenuto resta sui nostri server.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
