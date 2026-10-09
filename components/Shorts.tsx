'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Search,
  RotateCw,
  MoveDownRight,
} from 'lucide-react';
import { CATEGORIES, filterContent, errorMessage } from '../lib/domain';
import { getClient, listContent, listCategories, signedUrl } from '../lib/repository';
import Setup from './Setup';
export type PlayItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  url?: string;
  storage_path?: string;
  source?: string;
};
export const DEMO_ITEMS: PlayItem[] = [
  {
    id: 'demo-flower',
    title: '작은 순간의 움직임',
    description:
      '바람에 흔들리는 꽃. MDN의 공개 CC0 테스트 영상입니다. 실제 등록 콘텐츠가 아닙니다.',
    category: '자연',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    source: 'MDN / CC0 FLOWER',
  },
  {
    id: 'demo-sintel',
    title: '프레임 너머의 이야기',
    description:
      'Sintel 예고편. Blender Foundation의 공개 샘플 영상입니다. 원본은 가로 영상이며 화면에 맞춰 표시합니다.',
    category: '아트',
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    source: 'BLENDER FOUNDATION / SINTEL',
  },
  {
    id: 'demo-bunny',
    title: '움직임이 만드는 세계',
    description:
      'Big Buck Bunny 예고편. Blender Foundation의 공개 샘플 영상입니다. 원본은 가로 영상이며 화면에 맞춰 표시합니다.',
    category: '아트',
    url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    source: 'BLENDER FOUNDATION / BIG BUCK BUNNY',
  },
];
export function VideoCard({
  item,
  active,
  muted,
  paused,
  onTogglePause,
  onToggleMute,
  index,
}: {
  item: PlayItem;
  active: boolean;
  muted: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
  index: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState(item.url || '');
  const [failure, setFailure] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [retry, setRetry] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const change = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', change);
    change();
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!active || item.url) return;
    let alive = true;
    const client = getClient();
    const load = async () => {
      try {
        if (!client || !item.storage_path) throw new Error('파일에 연결할 수 없습니다.');
        const next = await signedUrl(client, 'videos', item.storage_path);
        if (alive) {
          setUrl(next);
          setFailure('');
        }
      } catch (e) {
        if (alive) setFailure(errorMessage(e));
      }
    };
    void load();
    const timer = setInterval(load, 4 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [item.storage_path, item.url, active, retry]);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = muted;
    if (!active || paused || !visible || !url || failure) {
      video.pause();
      return;
    }
    let canceled = false;
    void video
      .play()
      .then(() => {
        if (!canceled) setBlocked(false);
      })
      .catch(() => {
        if (!canceled) setBlocked(true);
      });
    return () => {
      canceled = true;
      video.pause();
    };
  }, [active, paused, visible, url, muted, failure, retry]);
  const tryAgain = () => {
    setFailure('');
    setBlocked(false);
    setRetry((r) => r + 1);
    ref.current?.load();
  };
  const manualPlay = () => {
    const video = ref.current;
    if (!video) return;
    void video
      .play()
      .then(() => setBlocked(false))
      .catch(() =>
        setFailure('브라우저가 영상을 재생하지 못했습니다. 다른 브라우저에서 다시 시도해 주세요.'),
      );
  };
  return (
    <article
      className={`video-card ${active ? 'is-active' : ''}`}
      aria-label={`${index + 1}. ${item.title}`}
      aria-hidden={!active}
    >
      <video
        ref={ref}
        src={url || undefined}
        playsInline
        muted={muted}
        loop
        preload={active ? 'auto' : 'none'}
        aria-label={item.title}
        onTimeUpdate={() => {
          const v = ref.current;
          if (v && v.duration) setProgress((v.currentTime / v.duration) * 100);
        }}
        onLoadedMetadata={() => setDuration(ref.current?.duration || 0)}
        onError={() =>
          setFailure('영상을 불러올 수 없습니다. 네트워크 또는 파일 상태를 확인해 주세요.')
        }
      />
      <div className="video-shade" />
      <div className="video-top">
        <span className="video-label">
          <span className="status-dot" />
          {item.url ? 'SAMPLE / DEMO' : 'METRO ORIGINAL'}
        </span>
        <span className="video-number">{String(index + 1).padStart(2, '0')}</span>
      </div>
      {failure ? (
        <div className="media-feedback" role="alert">
          <p>{failure}</p>
          <button className="secondary-button" onClick={tryAgain} tabIndex={active ? 0 : -1}>
            <RotateCw size={15} /> 영상 다시 시도
          </button>
        </div>
      ) : blocked ? (
        <button
          className="play-overlay"
          aria-label="영상 재생 시작"
          onClick={manualPlay}
          tabIndex={active ? 0 : -1}
        >
          <Play size={30} />
        </button>
      ) : !url ? (
        <div className="media-feedback" role="status">
          영상을 연결하는 중…
        </div>
      ) : null}
      <div className="video-caption">
        <span className="category-tag">{item.category}</span>
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        {item.source && <small>{item.source}</small>}
      </div>
      <div className="video-controls">
        <button
          className="icon-button"
          onClick={onTogglePause}
          aria-label={paused ? '재생' : '일시 정지'}
          tabIndex={active ? 0 : -1}
        >
          {paused ? <Play size={19} /> : <Pause size={19} />}
        </button>
        <input
          type="range"
          className="progress-slider"
          aria-label="재생 위치"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          tabIndex={active ? 0 : -1}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (ref.current && duration) {
              ref.current.currentTime = (value / 100) * duration;
              setProgress(value);
            }
          }}
          style={{ '--progress': `${progress}%` } as React.CSSProperties}
        />
        <span className="duration-label">
          {Number.isFinite(duration)
            ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
            : '0:00'}
        </span>
        <button
          className="icon-button"
          onClick={onToggleMute}
          aria-label={muted ? '소리 켜기' : '음소거'}
          tabIndex={active ? 0 : -1}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>
      </div>
    </article>
  );
}
export default function Shorts({ demo = false }: { demo?: boolean }) {
  const client = getClient();
  const [rows, setRows] = useState<PlayItem[]>(demo ? DEMO_ITEMS : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
  const [categories, setCategories] = useState<string[]>(demo ? CATEGORIES : ['전체']);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const wheelTime = useRef(0);
  useEffect(() => {
    if (demo || !client) return;
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([listContent(client, 'videos'), listCategories(client)])
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
  }, [client, demo, refresh]);
  const filtered = useMemo(() => filterContent(rows, search, category), [rows, search, category]);
  const go = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(filtered.length - 1, next));
      setPaused(false);
      const node = scroller.current;
      node?.scrollTo({
        top: target * node.clientHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    },
    [filtered.length],
  );
  useEffect(() => {
    setIndex(0);
    setPaused(false);
    scroller.current?.scrollTo({ top: 0 });
  }, [search, category]);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 12) return;
      e.preventDefault();
      if (Date.now() - wheelTime.current < 650) return;
      wheelTime.current = Date.now();
      go(index + (e.deltaY > 0 ? 1 : -1));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [go, index, loading, filtered.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,button,a,[contenteditable]'))
        return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        go(index + (e.key === 'ArrowDown' ? 1 : -1));
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setPaused((p) => !p);
      }
      if (e.key.toLowerCase() === 'm') setMuted((m) => !m);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, index]);
  if (!demo && !client) return <Setup />;
  return (
    <section className="feed-page">
      <div className="feed-heading">
        <div>
          <span className="eyebrow">
            {demo ? 'PUBLIC SAMPLES / NOT YOUR LIBRARY' : 'A COLLECTION OF MOMENTS'}
          </span>
          <h1>
            {demo ? '새로운 시선의 시작.' : '지금, 이 순간의 모션.'}
            <span className="lime">*</span>
          </h1>
        </div>
        <label className="search-box">
          <Search size={17} />
          <span className="sr-only">영상 검색</span>
          <input
            placeholder="관심 있는 순간을 찾아보세요"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="filter-row">
        <div className="category-tabs" aria-label="영상 카테고리">
          {categories.map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              className={category === c ? 'active' : ''}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="collection-count">{filtered.length} FILMS</span>
      </div>
      {demo && (
        <p className="demo-banner">
          공개 샘플 데모 · Supabase에 저장된 콘텐츠가 아닙니다. 원본 출처를 각 영상에 표시합니다.
        </p>
      )}
      {loading ? (
        <div className="empty-state" role="status">
          모션을 불러오는 중…
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <h2>피드에 연결하지 못했습니다.</h2>
          <p>{error}</p>
          <button className="secondary-button" onClick={() => setRefresh((r) => r + 1)}>
            다시 시도
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h2>{rows.length ? '일치하는 순간이 없습니다.' : '첫 번째 모션을 기다립니다.'}</h2>
          <p>
            {rows.length
              ? '다른 검색어나 카테고리를 선택해 보세요.'
              : '관리자가 공개한 영상이 이곳에 표시됩니다.'}
          </p>
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
      ) : (
        <div className="viewer-layout">
          <div className="feed-editorial">
            <span className="eyebrow">
              {demo ? 'DEMO EDITION' : 'THE MOTION EDIT'} / {String(index + 1).padStart(2, '0')}
            </span>
            <h2>
              일상을
              <br />
              다르게
              <br />
              <em>보다.</em>
            </h2>
            <p>
              어제와 같은 풍경도,
              <br />
              새로운 프레임 안에서는
              <br />
              다른 이야기가 됩니다.
            </p>
            <div className="editorial-rule" />
            <span className="editorial-small">
              LESS TIME.
              <br />
              MORE PERSPECTIVE.
            </span>
            <MoveDownRight size={40} strokeWidth={1} />
          </div>
          <div
            className="video-scroller"
            ref={scroller}
            tabIndex={0}
            aria-label="숏폼 영상 피드. 위아래 화살표로 이동, 스페이스로 재생 정지, M으로 음소거"
            onScroll={() => {
              const n = scroller.current;
              if (n) {
                const next = Math.round(n.scrollTop / n.clientHeight);
                if (next !== index) {
                  setIndex(next);
                  setPaused(false);
                }
              }
            }}
          >
            {filtered.map((item, i) => (
              <VideoCard
                key={item.id}
                item={item}
                index={i}
                active={index === i}
                muted={muted}
                paused={paused}
                onTogglePause={() => setPaused((p) => !p)}
                onToggleMute={() => setMuted((m) => !m)}
              />
            ))}
          </div>
          <div className="feed-rail">
            <span className="rail-counter">
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              <span>/ {String(filtered.length).padStart(2, '0')}</span>
            </span>
            <div className="rail-line" />
            <button
              className="round-button"
              aria-label="이전 영상"
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              <ArrowUp size={20} />
            </button>
            <button
              className="round-button"
              aria-label="다음 영상"
              disabled={index === filtered.length - 1}
              onClick={() => go(index + 1)}
            >
              <ArrowDown size={20} />
            </button>
            <span className="rail-caption">SCROLL TO EXPLORE</span>
          </div>
        </div>
      )}
      <div className="feed-footer">
        <span>작은 화면 속, 더 넓은 세상.</span>
        <span>
          ↑ ↓ 이동 <b>SPACE</b> 재생/정지 <b>M</b> 소리
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {filtered.length > 0
          ? `${index + 1} / ${filtered.length}, ${filtered[index]?.title}`
          : '영상 없음'}
      </span>
    </section>
  );
}
