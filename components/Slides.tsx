'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Maximize, Presentation, Search } from 'lucide-react';
import { type Content, errorMessage, filterContent, LIMITS } from '../lib/domain';
import { getClient, listContent, listCategories, signedUrl } from '../lib/repository';
import Setup from './Setup';

export default function Slides() {
  const client = getClient();
  const [rows, setRows] = useState<Content[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([listContent(client, 'slides'), listCategories(client)])
      .then(([data, names]) => {
        if (alive) {
          setRows(data);
          setCategories(names);
        }
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [client, retry]);
  if (!client) return <Setup />;
  const filtered = filterContent(rows, search, category);
  return (
    <section className="library-page slides-page">
      <div className="page-heading">
        <span className="eyebrow">THE SLIDE GALLERY</span>
        <h1>
          아이디어를 펼치는 <em>슬라이드.</em>
        </h1>
        <p>HTML 프레젠테이션을 열고, 새로운 관점을 발견하세요.</p>
      </div>
      <div className="library-toolbar">
        <div className="category-tabs" aria-label="슬라이드 카테고리">
          {['전체', ...categories].map((c) => (
            <button
              key={c}
              aria-pressed={c === category}
              className={c === category ? 'active' : ''}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={17} />
          <span className="sr-only">슬라이드 검색</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="슬라이드 검색"
          />
        </label>
      </div>
      <p className="collection-count" aria-live="polite">
        {filtered.length} SLIDES
      </p>
      {loading ? (
        <div className="empty-state" role="status">
          슬라이드를 불러오는 중…
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <h2>슬라이드를 불러오지 못했습니다.</h2>
          <p>{error}</p>
          <button className="secondary-button" onClick={() => setRetry((r) => r + 1)}>
            다시 시도
          </button>
        </div>
      ) : filtered.length ? (
        <div className="document-grid">
          {filtered.map((row) => (
            <Link className="document-card" href={`/slides/${row.id}`} key={row.id}>
              <div className="document-cover">
                <span className="doc-cover-index">MM / PRESENTATION</span>
                <Presentation size={58} strokeWidth={1} />
                <span className="document-format">HTML</span>
              </div>
              <div className="document-card-body">
                <span className="category-tag">{row.category}</span>
                <h2>
                  {row.title}
                  <ArrowUpRight size={19} />
                </h2>
                <p>{row.description || '슬라이드를 열어 프레젠테이션을 확인하세요.'}</p>
                <div className="document-meta">
                  <span>{(row.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                  <time dateTime={row.created_at}>
                    {new Date(row.created_at).toLocaleDateString('ko-KR')}
                  </time>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Presentation size={38} strokeWidth={1} />
          <h2>{rows.length ? '검색 결과가 없습니다.' : '슬라이드가 준비되고 있습니다.'}</h2>
          <p>관리자가 공개한 HTML 슬라이드만 표시됩니다.</p>
        </div>
      )}
    </section>
  );
}

// Keep this policy before all uploaded markup. Opaque-origin sandbox allows inline
// slide controls but never grants the HTML access to the app, auth or network.
const FRAME_POLICY = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer">`;
export function SlideDetail({ id }: { id: string }) {
  const client = getClient();
  const [row, setRow] = useState<Content | null>(null);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const viewer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    let alive = true;
    async function load() {
      if (alive) {
        setHtml('');
        setError('');
        setLoading(true);
      }
      try {
        // RLS returns published rows to readers and drafts only to admins.
        const { data, error } = await client!.from('slides').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data)
          throw new Error('슬라이드를 찾을 수 없습니다. 비공개이거나 삭제되었을 수 있습니다.');
        const url = await signedUrl(client!, 'slides', data.storage_path);
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error('슬라이드 파일을 불러오지 못했습니다.');
        const text = await response.text();
        if (new Blob([text]).size > LIMITS.slides)
          throw new Error('슬라이드 파일이 20MB를 초과합니다.');
        if (alive) {
          setRow(data);
          setHtml(FRAME_POLICY + text);
        }
      } catch (e) {
        if (alive) {
          setRow(null);
          setHtml('');
          setError(errorMessage(e));
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 240000);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [client, id, retry]);
  if (!client) return <Setup />;
  return (
    <section className="detail-page slide-detail">
      <Link className="text-link" href="/slides">
        <ArrowLeft size={16} /> 슬라이드 목록으로
      </Link>
      {loading ? (
        <div className="empty-state" role="status">
          슬라이드를 불러오는 중…
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <h1>슬라이드를 표시할 수 없습니다.</h1>
          <p>{error}</p>
          <button className="secondary-button" onClick={() => setRetry((r) => r + 1)}>
            다시 시도
          </button>
        </div>
      ) : (
        row && (
          <>
            <div className="slide-heading">
              <div>
                <span className="eyebrow">
                  HTML SLIDES / {row.category}
                  {!row.published ? ' / 미공개 미리보기' : ''}
                </span>
                <h1>{row.title}</h1>
              </div>
              <button
                className="secondary-button"
                onClick={() => {
                  if (!viewer.current?.requestFullscreen) {
                    setError('이 브라우저는 전체 화면을 지원하지 않습니다.');
                    return;
                  }
                  void viewer.current
                    .requestFullscreen()
                    .catch(() => setError('전체 화면을 시작하지 못했습니다.'));
                }}
              >
                <Maximize size={17} /> 전체 화면
              </button>
            </div>
            {row.description && <p className="detail-description">{row.description}</p>}
            <div className="slide-viewer" ref={viewer}>
              <iframe
                title={row.title}
                sandbox="allow-scripts"
                srcDoc={html}
                referrerPolicy="no-referrer"
                allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
              />
            </div>
            <p className="muted">
              슬라이드 안의 버튼이나 키보드로 조작하세요. 외부 리소스·네트워크·폼·팝업은 차단됩니다.
              독립 실행형 HTML 파일을 지원합니다.
            </p>
          </>
        )
      )}
    </section>
  );
}
