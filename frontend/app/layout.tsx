import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'MXH — Quiet Social Feed',
  description: 'Mạng xã hội tối giản phong cách Threads',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#fafafa] text-[#000000] selection:bg-[#efefef]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
