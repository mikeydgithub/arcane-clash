
import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AudioProvider } from '@/contexts/AudioContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap', // Added display: 'swap'
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap', // Added display: 'swap'
});

export const metadata: Metadata = {
  title: 'Arcane Clash',
  description: 'A magical 2-player card game.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning={true}>
        <AudioProvider>
          {children}
          {/* Background music element is now here, controlled by AudioProvider */}
          <audio id="background-music" src="/audio/arcane-clash-theme-2.mp3" loop />
        </AudioProvider>
        <Toaster />
      </body>
    </html>
  );
}
