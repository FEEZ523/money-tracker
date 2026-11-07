import type { Metadata } from 'next';
import { Prompt, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const promptFont = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Money Tracker • แอปจดเงินคู่ใจ Antigravity AI (Liquid Glass Edition)',
  description: 'จดเงินผ่านเว็บและ Antigravity MCP สรุปรายจ่าย คำนวณเป็นสตางค์ เวลาไทย ดีไซน์ Liquid Glass & Thermal Receipt',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${promptFont.variable} ${monoFont.variable} dark`}>
      <body className="font-sans antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
