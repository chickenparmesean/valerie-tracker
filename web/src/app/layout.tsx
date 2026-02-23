import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Valerie Tracker',
  description: 'Time tracking and activity monitoring for virtual assistants',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased bg-va-bg text-va-text">
        {children}
      </body>
    </html>
  );
}
