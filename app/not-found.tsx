import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="empty-state">
      <span className="eyebrow">404 / OUT OF FRAME</span>
      <h1>화면 밖으로 나왔네요.</h1>
      <p>요청하신 페이지를 찾을 수 없습니다.</p>
      <Link className="primary-button" href="/">
        모션 피드로 돌아가기
      </Link>
    </section>
  );
}
