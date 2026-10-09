'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty-state">
      <span className="eyebrow">SOMETHING WENT WRONG</span>
      <h1>잠시 연결이 멈췄습니다.</h1>
      <p>페이지를 다시 불러오세요. 문제가 지속되면 관리자에게 문의해 주세요.</p>
      <button className="primary-button" onClick={reset}>
        다시 시도
      </button>
    </section>
  );
}
