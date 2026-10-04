import './globals.css';

export const metadata = {
  title: 'SIG-SCOPE - Signal Intelligence Platform',
  description: 'Automated Signal Intelligence & Parameter Extraction Platform - SIH 2026',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
