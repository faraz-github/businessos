import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider as ThemeProviderComponent } from '@/lib/theme';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ThemeProvider = ThemeProviderComponent as any;

export const metadata: Metadata = {
  title: 'Business OS',
  description: 'Personal & Agency Business Operating System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Prevent flash: apply stored theme before paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('bos-theme') || 'dark';
            document.documentElement.setAttribute('data-theme', t);
          })();
        `}} />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
