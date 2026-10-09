'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clapperboard, Files, ArrowUpRight, ShieldCheck, Play, Radio } from 'lucide-react';
const links = [
  { href: '/', label: '모션 피드', english: 'MOTION FEED', icon: Clapperboard },
  { href: '/documents', label: '자료 라이브러리', english: 'RESOURCES', icon: Files },
  { href: '/demo', label: '데모 플레이어', english: 'DEMO / SAMPLE', icon: Play },
];
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>
      <aside className="sidebar">
        <Link href="/" className="wordmark" aria-label="METRO MOTION 홈">
          <span className="brand-icon">
            m<span>m</span>
          </span>
          <span>
            METRO
            <br />
            MOTION<span className="brand-period">®</span>
          </span>
        </Link>
        <div className="side-label">THE WORLD IN MOTION</div>
        <nav aria-label="주 메뉴">
          {links.map(({ href, label, english, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${path === href || (href === '/documents' && path.startsWith('/documents/')) ? 'selected' : ''}`}
            >
              <Icon size={19} />
              <span>
                {label}
                <small>{english}</small>
              </span>
              <ArrowUpRight className="nav-arrow" size={15} />
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="editorial-note">
            <Radio size={20} />
            <p>
              스크롤 한 번,
              <br />
              새로운 시선 하나.
            </p>
            <span>CURATED FOR THE CURIOUS.</span>
          </div>
          <Link href="/admin" className={`admin-link ${path.startsWith('/admin') ? 'active' : ''}`}>
            <ShieldCheck size={15} /> 관리자 스튜디오 <ArrowUpRight size={14} />
          </Link>
          <div className="side-footer">
            METRO MOTION <span>SEOUL, KR</span>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <span className="topbar-title">EXPLORING EVERYDAY PERSPECTIVES</span>
          <span className="topbar-right">
            <span className="tiny-cross">✳</span> SHORT FORM. BIG IDEAS.
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <Link href="/admin" aria-current={path.startsWith('/admin') ? 'page' : undefined}>
          <ShieldCheck size={20} />
          <span>관리자</span>
        </Link>
      </nav>
    </>
  );
}
