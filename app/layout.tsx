import type { Metadata, Viewport } from 'next';
import Shell from '../components/Shell';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'METRO MOTION — 작은 화면, 새로운 시선', template: '%s | METRO MOTION' },
  description: '도시의 리듬과 일상의 순간을 담은 숏폼 모션, 그리고 창작을 위한 자료 라이브러리.',
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#101110' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
