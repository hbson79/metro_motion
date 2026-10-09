'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ShieldCheck,
  ArrowUpRight,
  Plus,
  Upload,
  LogOut,
  Film,
  FileText,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { type Kind, type Content, CATEGORIES, validateUpload, errorMessage } from '../lib/domain';
import {
  CommittedCleanupError,
  getClient,
  checkAdmin,
  listContent,
  saveContent,
  deleteContent,
  setPublished,
  signedUrl,
  type ContentInput,
} from '../lib/repository';
import Setup from './Setup';
export function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="login-page">
      <div className="login-intro">
        <span className="eyebrow">BEHIND THE FRAMES</span>
        <h1>
          당신의 시선을
          <br />
          <em>세상에.</em>
        </h1>
        <p>콘텐츠를 관리하고, 새로운 움직임을 공개하는 공간.</p>
        <div className="login-art" aria-hidden="true">
          M<span>↗</span>
        </div>
      </div>
      <div className="login-panel">
        <span className="login-icon">
          <ShieldCheck size={23} />
        </span>
        <span className="eyebrow">ADMINISTRATOR ACCESS</span>
        <h2>관리자 스튜디오</h2>
        <p>등록된 관리자 계정으로 로그인하세요.</p>
        <form onSubmit={login}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@your-studio.com"
          />
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
          />
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? '권한 확인 중…' : '스튜디오 로그인'}
            <ArrowUpRight size={18} />
          </button>
        </form>
        <p className="login-security">
          <ShieldCheck size={14} /> Supabase Auth · 관리자 권한은 데이터베이스에서 검증됩니다.
        </p>
        <p className="muted">
          계정이 없거나 비밀번호를 잊으셨나요?
          <br />
          프로젝트 관리자가 Supabase 대시보드에서 계정을 관리해야 합니다. 이 사이트에서는 가입이나
          권한 부여가 불가능합니다.
        </p>
      </div>
    </section>
  );
}
export function ContentEditor({
  kind,
  existing,
  onSave,
  onCancel,
  busy,
}: {
  kind: Kind;
  existing?: Content;
  onSave: (input: ContentInput, file: File | null) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [category, setCategory] = useState(existing?.category || '도시');
  const [published, setPublished] = useState(existing?.published || false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }
    if (!existing && !file) {
      setError('파일을 선택해 주세요.');
      return;
    }
    if (file) {
      const invalid = validateUpload(file, kind);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    onSave({ title, description, category, published }, file);
  }
  return (
    <div className="editor-panel">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">{existing ? 'EDIT CONTENT' : 'NEW CONTENT'}</span>
          <h2>
            {existing
              ? '콘텐츠 수정'
              : kind === 'videos'
                ? '새로운 모션 업로드'
                : '새로운 자료 업로드'}
          </h2>
        </div>
        <button className="icon-button" aria-label="편집 닫기" disabled={busy} onClick={onCancel}>
          <X size={22} />
        </button>
      </div>
      <form aria-label="콘텐츠 편집" onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="editor-columns">
            <div>
              <label htmlFor="content-title">제목</label>
              <input
                id="content-title"
                maxLength={120}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="이 순간에 이름을 붙여 주세요"
              />
              <label htmlFor="content-description">설명</label>
              <textarea
                id="content-description"
                maxLength={4000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="영상 또는 자료에 대한 짧은 이야기"
              />
              <label htmlFor="content-category">카테고리</label>
              <select
                id="content-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.filter((c) => c !== '전체').map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="upload-zone">
                <Upload size={30} strokeWidth={1.3} />
                <label htmlFor="content-file">파일 선택</label>
                <input
                  id="content-file"
                  type="file"
                  accept={kind === 'videos' ? '.mp4,.webm' : 'application/pdf,text/plain,.docx'}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setError('');
                  }}
                />
                <p>
                  {file
                    ? file.name
                    : existing
                      ? `현재 파일: ${existing.original_name}`
                      : '이곳에서 업로드할 파일을 선택하세요.'}
                </p>
                <small>
                  {kind === 'videos'
                    ? 'MP4 / WebM · 최대 250MB · 세로 9:16 권장'
                    : 'PDF / TXT / DOCX · 최대 20MB'}
                  <br />
                  교체하지 않으면 기존 파일을 유지합니다.
                </small>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                <span>
                  저장과 동시에 공개<small>체크하지 않으면 관리자만 볼 수 있습니다.</small>
                </span>
              </label>
            </div>
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="editor-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              취소
            </button>
            <button className="primary-button" type="submit">
              {busy ? '파일과 메타데이터 저장 중…' : existing ? '변경 사항 저장' : '콘텐츠 저장'}
              <ArrowUpRight size={17} />
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
export default function Admin() {
  const client = getClient();
  const [auth, setAuth] = useState<'loading' | 'guest' | 'admin' | 'denied'>('loading');
  const [authRefresh, setAuthRefresh] = useState(0);
  const [kind, setKind] = useState<Kind>('videos');
  const [rows, setRows] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<Content | null | undefined>(undefined);
  useEffect(() => {
    if (!client) return;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setAuthRefresh((r) => r + 1);
    });
    return () => subscription.unsubscribe();
  }, [client]);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    async function loadAuth() {
      try {
        const {
          data: { user },
          error,
        } = await client!.auth.getUser();
        if (!alive) return;
        if (error || !user) {
          setAuth('guest');
          setRows([]);
          setEditing(undefined);
          return;
        }
        const allowed = await checkAdmin(client!);
        if (alive) setAuth(allowed ? 'admin' : 'denied');
      } catch (e) {
        if (alive) {
          setError(errorMessage(e));
          setAuth('denied');
        }
      }
    }
    void loadAuth();
    return () => {
      alive = false;
    };
  }, [client, authRefresh]);
  useEffect(() => {
    if (!client || auth !== 'admin') return;
    let alive = true;
    setLoading(true);
    listContent(client, kind, true)
      .then((data) => {
        if (alive) setRows(data);
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
  }, [client, auth, kind, refresh]);
  async function act(operation: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      setNotice(message);
      setEditing(undefined);
    } catch (e) {
      if (e instanceof CommittedCleanupError) setEditing(undefined);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setRefresh((r) => r + 1);
    }
  }
  async function logout() {
    if (!client) return;
    setBusy(true);
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setAuth('guest');
      setRows([]);
      setEditing(undefined);
      setNotice('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function preview(row: Content) {
    if (!client) return;
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const url = await signedUrl(
        client,
        kind,
        row.storage_path,
        kind === 'documents' ? row.original_name : undefined,
      );
      if (tab) tab.location.href = url;
      else setError('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용하세요.');
    } catch (e) {
      tab?.close();
      setError(errorMessage(e));
    }
  }
  if (!client) return <Setup />;
  if (auth === 'loading')
    return (
      <div className="empty-state" role="status">
        관리자 권한 확인 중…
      </div>
    );
  if (auth === 'guest') return <Login client={client} />;
  if (auth === 'denied')
    return (
      <section className="empty-state">
        <ShieldCheck size={42} />
        <h1>관리자 권한이 필요합니다.</h1>
        <p>로그인한 계정은 관리자 명단에 없습니다. 프로젝트 관리자에게 문의하세요.</p>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="secondary-button" disabled={busy} onClick={logout}>
          다른 계정으로 로그인
        </button>
      </section>
    );
  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="eyebrow">YOUR CREATIVE CONTROL ROOM</span>
          <h1>
            관리자 스튜디오<span className="lime">.</span>
          </h1>
          <p>새로운 시선을 업로드하고, 공개할 순간을 선택하세요.</p>
        </div>
        <button className="secondary-button" onClick={logout} disabled={busy}>
          <LogOut size={16} /> 로그아웃
        </button>
      </div>
      <div className="admin-stats">
        <div>
          <span>현재 {kind === 'videos' ? '영상' : '문서'}</span>
          <strong>
            {rows.length}
            <small> TOTAL</small>
          </strong>
        </div>
        <div>
          <span>공개 중</span>
          <strong className="lime">
            {rows.filter((r) => r.published).length}
            <small> PUBLISHED</small>
          </strong>
        </div>
        <div>
          <span>미공개</span>
          <strong>
            {rows.filter((r) => !r.published).length}
            <small> DRAFTS</small>
          </strong>
        </div>
      </div>
      <div className="admin-toolbar">
        <div className="content-tabs">
          {(['videos', 'documents'] as Kind[]).map((k) => (
            <button
              key={k}
              aria-pressed={kind === k}
              className={kind === k ? 'active' : ''}
              disabled={busy}
              onClick={() => {
                setKind(k);
                setEditing(undefined);
                setError('');
                setNotice('');
              }}
            >
              {k === 'videos' ? <Film size={17} /> : <FileText size={17} />}{' '}
              {k === 'videos' ? '모션 영상' : '자료 문서'}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button
            className="icon-button"
            aria-label="목록 새로고침"
            disabled={busy}
            onClick={() => setRefresh((r) => r + 1)}
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setError('');
              setNotice('');
            }}
          >
            <Plus size={17} /> 새 콘텐츠
          </button>
        </div>
      </div>
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {editing !== undefined && (
        <ContentEditor
          key={`${kind}-${editing?.id || 'new'}`}
          kind={kind}
          existing={editing || undefined}
          busy={busy}
          onCancel={() => setEditing(undefined)}
          onSave={(input, file) =>
            void act(
              () => saveContent(client, kind, input, file, editing || undefined),
              '콘텐츠를 저장했습니다.',
            )
          }
        />
      )}
      {loading ? (
        <div className="empty-state" role="status">
          콘텐츠 목록 불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <Upload size={36} strokeWidth={1} />
          <h2>아직 등록된 콘텐츠가 없습니다.</h2>
          <p>첫 파일을 업로드하고 스튜디오를 시작해 보세요.</p>
        </div>
      ) : (
        <div className="admin-list">
          {rows.map((row) => (
            <article key={row.id} className="admin-row">
              <div className="row-type">
                {kind === 'videos' ? <Film size={24} /> : <FileText size={24} />}
              </div>
              <div className="row-info">
                <h2>{row.title}</h2>
                <p>
                  {row.category} <span>·</span> {row.original_name} <span>·</span>{' '}
                  {(row.size_bytes / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <span className={`publish-badge ${row.published ? 'published' : ''}`}>
                {row.published ? '공개' : '미공개'}
              </span>
              <div className="row-actions">
                <button
                  className="icon-button"
                  aria-label={`${row.title} ${row.published ? '비공개로 전환' : '공개하기'}`}
                  title={row.published ? '비공개로 전환' : '공개하기'}
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => setPublished(client, kind, row.id, !row.published),
                      row.published ? '콘텐츠를 비공개로 전환했습니다.' : '콘텐츠를 공개했습니다.',
                    )
                  }
                >
                  {row.published ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
                <button
                  className="icon-button"
                  aria-label={`${row.title} 파일 확인`}
                  title="파일 확인"
                  disabled={busy}
                  onClick={() => void preview(row)}
                >
                  <ExternalLink size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${row.title} 수정`}
                  title="수정"
                  disabled={busy}
                  onClick={() => {
                    setEditing(row);
                    setError('');
                  }}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button destructive"
                  aria-label={`${row.title} 삭제`}
                  title="삭제"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `“${row.title}” 콘텐츠와 파일을 영구 삭제할까요? 복구할 수 없습니다.`,
                      )
                    )
                      void act(
                        () => deleteContent(client, kind, row),
                        '콘텐츠와 파일을 삭제했습니다.',
                      );
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="admin-security">
        <ShieldCheck size={14} /> 모든 변경은 Supabase RLS 관리자 정책으로 보호됩니다. 비공개 파일도
        관리자만 접근할 수 있습니다.
      </p>
    </section>
  );
}
