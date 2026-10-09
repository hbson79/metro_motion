'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, ArrowUpRight, Search, ArrowLeft, Download, Files } from 'lucide-react';
import { type Content, filterContent, errorMessage } from '../lib/domain';
import { getClient, listContent, listCategories, signedUrl } from '../lib/repository';
import Setup from './Setup';
export function DocumentCard({ row }: { row: Content }) {
  return (
    <Link className="document-card" href={`/documents/${row.id}`}>
      <div className="document-cover">
        <span className="doc-cover-index">MM / RESOURCE</span>
        <FileText size={58} strokeWidth={1} />
        <span className="document-format">{row.original_name.split('.').pop()?.toUpperCase()}</span>
      </div>
      <div className="document-card-body">
        <span className="category-tag">{row.category}</span>
        <h2>
          {row.title}
          <ArrowUpRight size={19} />
        </h2>
        <p>{row.description || '문서 상세에서 파일 정보를 확인하세요.'}</p>
        <div className="document-meta">
          <span>{(row.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
          <time dateTime={row.created_at}>
            {new Date(row.created_at).toLocaleDateString('ko-KR')}
          </time>
        </div>
      </div>
    </Link>
  );
}
export default function Documents() {
  const client = getClient();
  const [rows, setRows] = useState<Content[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
  const [categories, setCategories] = useState<string[]>(['전체']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([listContent(client, 'documents'), listCategories(client)])
      .then(([data, names]) => {
        if (alive) {
          setRows(data);
          setCategories(['전체', ...names]);
          setCategory((current) => (names.includes(current) ? current : '전체'));
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
  const filtered = useMemo(() => filterContent(rows, search, category), [rows, search, category]);
  if (!client) return <Setup />;
  return (
    <section className="library-page">
      <div className="page-heading">
        <span className="eyebrow">THE RESOURCE LIBRARY</span>
        <h1>
          생각을 움직이는 <em>자료.</em>
        </h1>
        <p>새로운 작업을 위한 참고 자료와 창작의 출발점.</p>
      </div>
      <div className="library-toolbar">
        <div className="category-tabs" aria-label="문서 카테고리">
          {categories.map((c) => (
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
          <span className="sr-only">문서 검색</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="자료 검색"
          />
        </label>
      </div>
      <p className="collection-count" aria-live="polite">
        {filtered.length} RESOURCES
      </p>
      {loading ? (
        <div className="empty-state" role="status">
          자료를 불러오는 중…
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <h2>자료를 불러오지 못했습니다.</h2>
          <p>{error}</p>
          <button className="secondary-button" onClick={() => setRetry((r) => r + 1)}>
            다시 시도
          </button>
        </div>
      ) : filtered.length ? (
        <div className="document-grid">
          {filtered.map((row) => (
            <DocumentCard key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Files size={38} strokeWidth={1} />
          <h2>{rows.length ? '검색 결과가 없습니다.' : '자료가 준비되고 있습니다.'}</h2>
          <p>공개된 문서만 라이브러리에 표시됩니다.</p>
          {rows.length > 0 && (
            <button
              className="secondary-button"
              onClick={() => {
                setSearch('');
                setCategory('전체');
              }}
            >
              필터 초기화
            </button>
          )}
        </div>
      )}
    </section>
  );
}
export function DocumentDetail({ id }: { id: string }) {
  const client = getClient();
  const [row, setRow] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    setLoading(true);
    setError('');
    client
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('published', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(errorMessage(error));
        setRow(data);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [client, id, retry]);
  async function download() {
    if (!client || !row || busy) return;
    setBusy(true);
    setError('');
    try {
      const url = await signedUrl(client, 'documents', row.storage_path, row.original_name);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.original_name;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (!client) return <Setup />;
  return (
    <section className="detail-page">
      <Link className="text-link" href="/documents">
        <ArrowLeft size={16} /> 라이브러리로 돌아가기
      </Link>
      {loading ? (
        <div className="empty-state" role="status">
          문서를 불러오는 중…
        </div>
      ) : !row ? (
        <div className="empty-state">
          <h1>문서를 찾을 수 없습니다.</h1>
          <p>{error || '비공개이거나 삭제된 문서일 수 있습니다.'}</p>
          <button className="secondary-button" onClick={() => setRetry((r) => r + 1)}>
            다시 시도
          </button>
        </div>
      ) : (
        <div className="detail-grid">
          <div className="detail-cover">
            <FileText size={100} strokeWidth={0.8} />
            <span>{row.original_name.split('.').pop()?.toUpperCase()}</span>
            <small>METRO MOTION / RESOURCES</small>
          </div>
          <article>
            <span className="eyebrow">RESOURCE / {row.category}</span>
            <h1>{row.title}</h1>
            <p className="detail-description">
              {row.description || '추가 설명이 없는 문서입니다.'}
            </p>
            <dl className="file-details">
              <div>
                <dt>파일명</dt>
                <dd>{row.original_name}</dd>
              </div>
              <div>
                <dt>파일 크기</dt>
                <dd>{(row.size_bytes / 1024 / 1024).toFixed(1)} MB</dd>
              </div>
              <div>
                <dt>업데이트</dt>
                <dd>
                  <time dateTime={row.updated_at}>
                    {new Date(row.updated_at).toLocaleDateString('ko-KR')}
                  </time>
                </dd>
              </div>
            </dl>
            <button className="primary-button" disabled={busy} onClick={download}>
              <Download size={18} />
              {busy ? '다운로드 준비 중…' : '문서 다운로드'}
            </button>
            <p className="muted">
              다운로드 시점에 접근 권한을 확인합니다. 신뢰할 수 있는 문서만 열어 보세요.
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
