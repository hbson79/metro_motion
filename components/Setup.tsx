import Link from 'next/link';
import { ArrowUpRight, Unplug, ArrowRight } from 'lucide-react';
export default function Setup() {
  return (
    <section className="setup-page">
      <div className="eyebrow">
        <span className="status-dot" /> STUDIO / NOT CONNECTED
      </div>
      <div className="setup-grid">
        <div className="setup-copy">
          <p className="kicker">작은 화면. 새로운 시선.</p>
          <h1>
            연결을 기다리는 <br />
            <em>스튜디오</em>
          </h1>
          <p className="setup-description">
            도시의 리듬부터 일상의 작은 순간까지.
            <br />
            METRO MOTION의 콘텐츠 공간을 시작하세요.
          </p>
          <div className="notice">
            <Unplug size={19} />
            <div>
              <strong>Supabase 연결이 필요합니다</strong>
              <p>
                현재 등록된 콘텐츠를 불러올 수 없습니다. 데모는 실제 라이브러리가 아니며 로그인과
                저장 기능을 모방하지 않습니다.
              </p>
            </div>
          </div>
          <Link className="primary-button" href="/demo">
            데모 플레이어 둘러보기 <ArrowUpRight size={19} />
          </Link>
          <a className="text-link" href="#setup-guide">
            프로젝트 연결 안내 <ArrowRight size={16} />
          </a>
        </div>
        <div className="motion-art" aria-hidden="true">
          <div className="art-label">
            A DIFFERENT
            <br />
            POINT OF VIEW.
          </div>
          <div className="art-orbit" />
          <div className="art-line" />
          <span className="art-bottom">MM / 09:16</span>
        </div>
      </div>
      <div className="setup-guide" id="setup-guide">
        <span className="section-index">01 / GET STARTED</span>
        <h2>첫 콘텐츠를 위한 세 단계</h2>
        <div className="steps">
          <article>
            <span>01</span>
            <h3>데이터베이스 만들기</h3>
            <p>
              Supabase 프로젝트에서 제공된 SQL 마이그레이션을 실행하세요. 테이블과 비공개 스토리지가
              함께 생성됩니다.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>프로젝트 연결하기</h3>
            <p>
              .env.local에 프로젝트 URL과 공개 anon 키를 설정하세요. 서버 비밀 키를 입력하지 마세요.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>관리자 등록하기</h3>
            <p>
              README의 부트스트랩 SQL로 관리자 권한을 부여한 뒤 로그인하고 콘텐츠를 업로드하세요.
            </p>
          </article>
        </div>
        <p className="muted">정확한 SQL과 배포 명령은 저장소의 README.md에 있습니다.</p>
      </div>
    </section>
  );
}
