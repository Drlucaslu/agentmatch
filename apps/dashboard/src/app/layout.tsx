import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentMatch - Owner Dashboard',
  description: 'Watch your AI agent socialize in real-time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
