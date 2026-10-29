import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GhostTrace | Haunted Open-Source Codebase Investigator',
  description:
    'A local-first AI investigator that reconstructs why code exists from Git history using an open-weight Gemma model, Mastra agent orchestration, and deterministic Git tools.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ghost-bg text-gray-200 font-mono antialiased selection:bg-ghost-green selection:text-black">
        <div className="relative min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
