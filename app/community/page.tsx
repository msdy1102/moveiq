'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import AuthButton from '@/app/components/AuthButton';
import { useAuth } from '@/app/components/useAuth';
import ResidentVerifyModal from './ResidentVerifyModal';
import styles from './community.module.css';

// ── 타입 ──────────────────────────────────────────────────────
interface Post {
  id:          string;
  nickname:    string;
  dong:        string;
  category:    string;
  title:       string;
  content:     string;
  likes:       number;
  comments:    number;
  is_verified: boolean;
  created_at:  string;
  liked:       boolean;
  is_mine:     boolean;
}

interface Comment {
  id:          string;
  nickname:    string;
  content:     string;
  likes:       number;
  is_verified: boolean;
  created_at:  string;
  liked:       boolean;
  is_mine:     boolean;
}

interface PostDetail extends Omit<Post, 'comments'> {
  comments: Comment[];   // 상세에선 배열 (목록에선 숫자)
  comments_count: number;
}

// ── 카테고리 설정 ─────────────────────────────────────────────
const CATEGORIES = [
  { label: '전체',       icon: '📋', value: '' },
  { label: '동네 질문',  icon: '❓', value: '동네 질문' },
  { label: '생활 꿀팁',  icon: '💡', value: '생활 꿀팁' },
  { label: '소음 후기',  icon: '🔊', value: '소음 후기' },
  { label: '이사 후기',  icon: '🏠', value: '이사 후기' },
  { label: '동네 소식',  icon: '📢', value: '동네 소식' },
  { label: '이웃 구해요',icon: '🤝', value: '이웃 구해요' },
  { label: '건물 후기',  icon: '🏢', value: '건물 후기' },
];

const SORT_OPTIONS = [
  { label: '최신순',          value: 'latest' },
  { label: '공감 많은 순',    value: 'likes' },
  { label: '인증 주민 먼저',  value: 'verified' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h    = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month:'short', day:'numeric' });
}

// ── 글쓰기 모달 컴포넌트 ─────────────────────────────────────
function WriteModal({
  onClose, onSuccess, sessionId, userId, nickname, defaultDong,
}: {
  onClose:     () => void;
  onSuccess:   (post: Post) => void;
  sessionId:   string;
  userId?:     string;
  nickname?:   string;
  defaultDong: string;
}) {
  const [dong,     setDong]     = useState(defaultDong !== '전체' ? defaultDong : '');
  const [category, setCategory] = useState('동네 질문');
  const [title,    setTitle]    = useState('');
  const [content,  setContent]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!content.trim()) { setError('내용을 입력해주세요.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id:    userId,
          nickname:   nickname || '익명',
          dong:       dong.trim() || '전체',
          category,
          title:      title.trim(),
          content:    content.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        onSuccess({
          ...json.data,
          likes: 0, comments: 0, is_verified: false,
          liked: false, is_mine: true, nickname: nickname || '익명',
          content: content.trim().slice(0, 150),
          dong: dong || '전체',
          category,
        });
        onClose();
      } else {
        setError(json.message ?? '작성에 실패했습니다.');
      }
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  }

  return (
    <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h3>✏️ 글쓰기</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.writeForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>동네 (선택)</label>
              <input
                type="text" value={dong} onChange={e => setDong(e.target.value)}
                placeholder="예: 성산동, 역삼동"
                className={styles.formInput}
                maxLength={20}
              />
            </div>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>카테고리</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={styles.formInput}>
                {CATEGORIES.slice(1).map(c => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>제목</label>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="제목을 입력해주세요 (2~100자)"
              className={styles.formInput} maxLength={100} required
            />
            <div className={styles.charCount}>{title.length}/100</div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>내용</label>
            <textarea
              value={content} onChange={e => setContent(e.target.value)}
              placeholder="동네에 대한 경험을 자유롭게 공유해주세요. (2~3000자)"
              className={styles.formTextarea} rows={8} maxLength={3000} required
            />
            <div className={styles.charCount}>{content.length}/3000</div>
          </div>

          {error && <p className={styles.formError}>{error}</p>}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>취소</button>
            <button type="submit" className={styles.btnSubmitPost} disabled={loading}>
              {loading ? '작성 중...' : '게시하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 게시글 상세 모달 ──────────────────────────────────────────
function PostDetailModal({
  postId, sessionId, userId, nickname, onClose,
}: {
  postId:    string;
  sessionId: string;
  userId?:   string;
  nickname?: string;
  onClose:   () => void;
}) {
  const [post,       setPost]       = useState<(Omit<PostDetail,'comments'> & { comments: Comment[] }) | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/community/posts/${postId}?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(json => { if (json.success) setPost(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId, sessionId]);

  async function handleLikePost() {
    if (!post) return;
    const res = await fetch('/api/community/likes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: post.id, target_type: 'post', session_id: sessionId }),
    });
    const json = await res.json();
    if (json.success) setPost(p => p ? { ...p, liked: json.liked, likes: json.likes } : p);
  }

  async function handleLikeComment(commentId: string) {
    const res = await fetch('/api/community/likes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: commentId, target_type: 'comment', session_id: sessionId }),
    });
    const json = await res.json();
    if (json.success) {
      setPost(p => p ? {
        ...p,
        comments: p.comments.map(c => c.id === commentId ? { ...c, liked: json.liked, likes: json.likes } : c),
      } : p);
    }
  }

  async function handleDeletePost() {
    if (!post || !confirm('게시글을 삭제하시겠어요?')) return;
    const res = await fetch(`/api/community/posts/${post.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if ((await res.json()).success) onClose();
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, session_id: sessionId, user_id: userId, nickname: nickname || '익명', content: comment.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setPost(p => p ? {
          ...p, comments: [...(p.comments || []), json.data],
          comments_count: (p as any).comments_count + 1,
        } : p);
        setComment('');
      }
    } catch {} finally { setSubmitting(false); }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('댓글을 삭제하시겠어요?')) return;
    setDeleting(commentId);
    try {
      const res = await fetch('/api/community/comments', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId, session_id: sessionId }),
      });
      if ((await res.json()).success) {
        setPost(p => p ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p);
      }
    } catch {} finally { setDeleting(null); }
  }

  const catInfo = CATEGORIES.find(c => c.value === post?.category);

  return (
    <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${styles.modal} ${styles.modalLarge}`}>
        <div className={styles.modalHead}>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className={styles.detailLoading}><div className={styles.spinner} /></div>
        ) : !post ? (
          <div className={styles.detailEmpty}>게시글을 불러올 수 없습니다.</div>
        ) : (
          <div className={styles.detailBody}>
            {/* 포스트 헤더 */}
            <div className={styles.detailHeader}>
              <div className={styles.detailMeta}>
                <span className={styles.detailCategory}>{catInfo?.icon} {post.category}</span>
                <span className={styles.detailDong}>📍 {post.dong}</span>
              </div>
              <h2 className={styles.detailTitle}>{post.title}</h2>
              <div className={styles.detailAuthorRow}>
                <span className={styles.detailAuthor}>
                  {post.is_verified && <span className={styles.verifiedBadge}>🏠</span>}
                  {post.nickname}
                </span>
                <span className={styles.detailDate}>{timeAgo(post.created_at)}</span>
                {post.is_mine && (
                  <button className={styles.btnDelete} onClick={handleDeletePost}>삭제</button>
                )}
              </div>
            </div>

            {/* 본문 */}
            <div className={styles.detailContent}>
              {post.content.split('\n').map((line, i) => (
                <p key={i}>{line || <br />}</p>
              ))}
            </div>

            {/* 좋아요 */}
            <div className={styles.detailActions}>
              <button
                className={`${styles.btnLike} ${post.liked ? styles.btnLiked : ''}`}
                onClick={handleLikePost}
              >
                {post.liked ? '❤️' : '🤍'} 공감 {post.likes}
              </button>
            </div>

            {/* 댓글 목록 */}
            <div className={styles.commentSection}>
              <div className={styles.commentTitle}>
                댓글
                <span className={styles.commentCount}>{post.comments.length}</span>
              </div>
              {post.comments.length === 0 ? (
                <div className={styles.commentEmpty}>첫 번째 댓글을 남겨보세요 💬</div>
              ) : (
                <div className={styles.commentList}>
                  {post.comments.map(c => (
                    <div key={c.id} className={styles.commentItem}>
                      <div className={styles.commentTop}>
                        <span className={styles.commentAuthor}>
                          {c.is_verified && <span className={styles.verifiedBadge}>🏠</span>}
                          {c.nickname}
                        </span>
                        <span className={styles.commentDate}>{timeAgo(c.created_at)}</span>
                        {c.is_mine && (
                          <button
                            className={styles.btnDeleteComment}
                            onClick={() => handleDeleteComment(c.id)}
                            disabled={deleting === c.id}
                          >
                            {deleting === c.id ? '...' : '삭제'}
                          </button>
                        )}
                      </div>
                      <p className={styles.commentContent}>{c.content}</p>
                      <button
                        className={`${styles.btnLikeComment} ${c.liked ? styles.btnLiked : ''}`}
                        onClick={() => handleLikeComment(c.id)}
                      >
                        {c.liked ? '❤️' : '🤍'} {c.likes}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 댓글 입력 */}
              <form onSubmit={handleSubmitComment} className={styles.commentForm}>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="댓글을 입력해주세요 (1~1000자)"
                  className={styles.commentInput}
                  rows={3}
                  maxLength={1000}
                />
                <div className={styles.commentFormBottom}>
                  <span className={styles.charCount}>{comment.length}/1000</span>
                  <button type="submit" className={styles.btnSubmitComment} disabled={submitting || !comment.trim()}>
                    {submitting ? '...' : '댓글 달기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function CommunityPage() {
  const { user } = useAuth();

  const [posts,      setPosts]      = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [hasMore,    setHasMore]    = useState(false);
  const [page,       setPage]       = useState(1);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDong,     setSelectedDong]     = useState('전체');
  const [sort,             setSort]             = useState('latest');
  const [searchQ,          setSearchQ]          = useState('');

  const [dongs,         setDongs]         = useState<string[]>([]);
  const [addDongOpen,   setAddDongOpen]   = useState(false);
  const [newDongInput,  setNewDongInput]  = useState('');
  const [dongSuggestions, setDongSuggestions] = useState<{ label:string; lat:number; lng:number }[]>([]);
  const [dongSearching, setDongSearching]  = useState(false);
  const dongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [writeOpen,       setWriteOpen]       = useState(false);
  const [selectedPostId,  setSelectedPostId]  = useState<string | null>(null);
  const [verifyOpen,      setVerifyOpen]       = useState(false);
  const [verifyStatus,    setVerifyStatus]     = useState<{ is_verified: boolean; verified_dong: string | null } | null>(null);

  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const ex = localStorage.getItem('moveiq_session_id');
    if (ex) return ex;
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem('moveiq_session_id', id);
    return id;
  });

  // 동네 목록 로드
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/user-preferences?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.community_dongs?.length) setDongs(json.community_dongs);
        else { try { const s = JSON.parse(localStorage.getItem('community_dongs') ?? '[]'); if (s.length) setDongs(s); } catch {} }
      })
      .catch(() => { try { const s = JSON.parse(localStorage.getItem('community_dongs') ?? '[]'); if (s.length) setDongs(s); } catch {} });
  }, [sessionId]);

  // 인증 상태 로드
  useEffect(() => {
    if (!sessionId) return;
    const params = new URLSearchParams({ session_id: sessionId });
    if (user?.id) params.set('user_id', user.id);
    fetch(`/api/resident-verify?${params}`)
      .then(r => r.json())
      .then(json => { if (json.success) setVerifyStatus({ is_verified: json.is_verified, verified_dong: json.verified_dong }); })
      .catch(() => {});
  }, [sessionId, user?.id]);

  // 게시글 목록 로드
  const loadPosts = useCallback(async (reset = false) => {
    const pg = reset ? 1 : page;
    setPostsLoading(true);
    try {
      const params = new URLSearchParams({
        dong:       selectedDong !== '전체' ? selectedDong : '',
        category:   selectedCategory,
        sort,
        page:       String(pg),
        limit:      '20',
        session_id: sessionId,
      });
      if (searchQ.trim()) params.set('search', searchQ.trim());

      const res  = await fetch(`/api/community/posts?${params}`);
      const json = await res.json();
      if (json.success) {
        setPosts(prev => reset ? json.data : [...prev, ...json.data]);
        setHasMore(json.has_more);
        if (!reset) setPage(pg + 1);
      }
    } catch {} finally { setPostsLoading(false); }
  }, [selectedDong, selectedCategory, sort, searchQ, sessionId, page]);

  useEffect(() => { loadPosts(true); setPage(1); }, [selectedDong, selectedCategory, sort]);

  // 검색 디바운스
  useEffect(() => {
    const t = setTimeout(() => { loadPosts(true); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  // 동네 자동완성
  function onDongInput(val: string) {
    setNewDongInput(val);
    setDongSuggestions([]);
    if (dongTimer.current) clearTimeout(dongTimer.current);
    if (val.trim().length < 2) return;
    dongTimer.current = setTimeout(async () => {
      setDongSearching(true);
      try {
        const res  = await fetch(`/api/dong-search?q=${encodeURIComponent(val.trim())}`);
        const json = await res.json();
        setDongSuggestions(json.results ?? []);
      } catch {} finally { setDongSearching(false); }
    }, 350);
  }

  function selectDong(label: string) {
    if (!dongs.includes(label)) {
      const next = [...dongs, label];
      setDongs(next);
      localStorage.setItem('community_dongs', JSON.stringify(next));
      if (sessionId) {
        fetch('/api/user-preferences', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id:sessionId, community_dongs:next }) }).catch(()=>{});
      }
    }
    setSelectedDong(label);
    setAddDongOpen(false); setNewDongInput(''); setDongSuggestions([]);
  }

  function removeDong(d: string) {
    const next = dongs.filter(x => x !== d);
    setDongs(next);
    localStorage.setItem('community_dongs', JSON.stringify(next));
    if (sessionId) fetch('/api/user-preferences', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id:sessionId, community_dongs:next }) }).catch(()=>{});
    if (selectedDong === d) setSelectedDong('전체');
  }

  function handlePostLike(postId: string) {
    fetch('/api/community/likes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: postId, target_type: 'post', session_id: sessionId }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: json.liked, likes: json.likes } : p));
        }
      });
  }

  const catInfo = (v: string) => CATEGORIES.find(c => c.value === v) ?? CATEGORIES[0];

  return (
    <>
      {/* ── 헤더 ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark} />
            <span className={styles.logoText}>무브IQ</span>
          </Link>
          <nav className={styles.headerNav}>
            <Link href="/noise-map" className={styles.navLink}>소음 지도</Link>
            <Link href="/analysis"  className={styles.navLink}>입지 분석</Link>
            <Link href="/community" className={`${styles.navLink} ${styles.navLinkActive}`}>커뮤니티</Link>
          </nav>
          <div className={styles.headerActions}>
            <AuthButton />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.pageHero}>
          <div className={styles.pageHeroInner}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              동네 커뮤니티
            </div>
            <h1>살아본 사람만 아는 이야기</h1>
            <p>이사 예정자와 기존 주민이 함께 만드는 진짜 동네 정보</p>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <div className={styles.heroStatNum}>실시간</div>
                <div className={styles.heroStatLabel}>게시글 업데이트</div>
              </div>
              <div className={styles.heroStat}>
                <div className={styles.heroStatNum}>🏠 인증</div>
                <div className={styles.heroStatLabel}>실거주 주민 배지</div>
              </div>
              <div className={styles.heroStat}>
                <div className={styles.heroStatNum}>8개</div>
                <div className={styles.heroStatLabel}>카테고리</div>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.layout}>
          {/* ── 사이드바 ── */}
          <aside className={styles.sidebar}>
            {/* 동네 선택 */}
            <div className={styles.sideSection}>
              <div className={styles.sideTitle} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>📍 동네 선택</span>
                <button className={styles.btnAddDong} onClick={() => setAddDongOpen(true)}>+</button>
              </div>
              {addDongOpen && (
                <div className={styles.addDongWrap}>
                  <div className={styles.addDongRow}>
                    <input
                      className={styles.addDongInput}
                      value={newDongInput}
                      onChange={e => onDongInput(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && (setAddDongOpen(false), setNewDongInput(''), setDongSuggestions([]))}
                      placeholder="예: 성산동, 역삼동"
                      autoFocus
                    />
                    <button className={styles.btnAddDongCancel} onClick={() => { setAddDongOpen(false); setNewDongInput(''); setDongSuggestions([]); }}>✕</button>
                  </div>
                  {dongSearching && <div className={styles.dongDropdown}><span className={styles.dongDropdownLoading}>검색 중...</span></div>}
                  {!dongSearching && dongSuggestions.length > 0 && (
                    <div className={styles.dongDropdown}>
                      {dongSuggestions.map(s => (
                        <button key={s.label} className={styles.dongDropdownItem} onClick={() => selectDong(s.label)}>📍 {s.label}</button>
                      ))}
                    </div>
                  )}
                  {!dongSearching && newDongInput.trim().length >= 2 && dongSuggestions.length === 0 && (
                    <div className={styles.dongDropdown}><span className={styles.dongDropdownEmpty}>검색 결과 없음</span></div>
                  )}
                </div>
              )}
              <div className={styles.dongList}>
                <button className={`${styles.dongBtn} ${selectedDong === '전체' ? styles.dongBtnActive : ''}`} onClick={() => setSelectedDong('전체')}>전체</button>
                {dongs.map(d => (
                  <div key={d} className={styles.dongBtnWrap}>
                    <button className={`${styles.dongBtn} ${selectedDong === d ? styles.dongBtnActive : ''}`} onClick={() => setSelectedDong(d)}>{d}</button>
                    <button className={styles.dongBtnDel} onClick={() => removeDong(d)}>✕</button>
                  </div>
                ))}
                {dongs.length === 0 && <p className={styles.dongEmpty}>+ 버튼으로 관심 동네를 추가하세요</p>}
              </div>
            </div>

            {/* 카테고리 */}
            <div className={styles.sideSection}>
              <div className={styles.sideTitle}>📂 카테고리</div>
              <div className={styles.catList}>
                {CATEGORIES.map(c => (
                  <button key={c.value}
                    className={`${styles.catBtn} ${selectedCategory === c.value ? styles.catBtnActive : ''}`}
                    onClick={() => setSelectedCategory(c.value)}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 인증 안내 */}
            <div className={styles.verifyInfo}>
              <div className={styles.verifyTitle}>🏠 주민 인증</div>
              {verifyStatus?.is_verified ? (
                <>
                  <div className={styles.verifyBadgeRow}>
                    <span className={styles.verifyBadgeActive}>✓ 인증 완료</span>
                    <span className={styles.verifyBadgeDong}>{verifyStatus.verified_dong}</span>
                  </div>
                  <p>내 게시글과 댓글에 🏠 배지가 표시됩니다.</p>
                  <button className={styles.btnVerifyRenew} onClick={() => setVerifyOpen(true)}>
                    재인증하기
                  </button>
                </>
              ) : (
                <>
                  <p>실거주 동네를 인증하면 <strong>🏠 인증 주민 배지</strong>가 표시됩니다.</p>
                  <button className={styles.btnVerify} onClick={() => setVerifyOpen(true)}>
                    내 동네 인증하기
                  </button>
                </>
              )}
            </div>
          </aside>

          {/* ── 메인 피드 ── */}
          <div className={styles.feed}>
            {/* 검색 + 글쓰기 */}
            <div className={styles.feedTop}>
              <div className={styles.searchBar}>
                <span>🔍</span>
                <input
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="게시글 검색" className={styles.searchInput}
                />
                {searchQ && <button className={styles.searchClear} onClick={() => setSearchQ('')}>✕</button>}
              </div>
              <button className={styles.btnWrite} onClick={() => setWriteOpen(true)}>✏️ 글쓰기</button>
            </div>

            {/* 정렬 */}
            <div className={styles.sortBar}>
              <span className={styles.resultCount}>
                {selectedDong !== '전체' && <span className={styles.dongTag}>📍 {selectedDong}</span>}
                {selectedCategory && <span className={styles.catTag}>{catInfo(selectedCategory).icon} {catInfo(selectedCategory).label}</span>}
                게시글 {posts.length}개
              </span>
              <div className={styles.sortBtns}>
                {SORT_OPTIONS.map(s => (
                  <button key={s.value}
                    className={`${styles.sortBtn} ${sort === s.value ? styles.sortBtnActive : ''}`}
                    onClick={() => setSort(s.value)}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            {/* 게시글 목록 */}
            {postsLoading && posts.length === 0 ? (
              <div className={styles.feedLoading}>
                {[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
              </div>
            ) : posts.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize:40, marginBottom:10 }}>💬</div>
                <p>아직 게시글이 없어요.<br/>이 동네의 첫 번째 글을 남겨보세요!</p>
                <button className={styles.btnWrite} onClick={() => setWriteOpen(true)}>첫 글 쓰기</button>
              </div>
            ) : (
              <>
                <div className={styles.postList}>
                  {posts.map(post => {
                    const ci = catInfo(post.category);
                    return (
                      <article key={post.id} className={styles.postCard} onClick={() => setSelectedPostId(post.id)}>
                        <div className={styles.postTop}>
                          <span className={styles.postCategory}>{ci.icon} {post.category}</span>
                          <span className={styles.postDong}>📍 {post.dong}</span>
                        </div>
                        <h3 className={styles.postTitle}>{post.title}</h3>
                        <p className={styles.postExcerpt}>{post.content}</p>
                        <div className={styles.postBottom}>
                          <div className={styles.postMeta}>
                            <span className={styles.postAuthor}>
                              {post.is_verified && <span className={styles.verifiedBadge}>🏠</span>}
                              {post.nickname}
                            </span>
                            <span className={styles.postDate}>{timeAgo(post.created_at)}</span>
                          </div>
                          <div className={styles.postStats}>
                            <button
                              className={`${styles.statBtn} ${post.liked ? styles.statBtnLiked : ''}`}
                              onClick={e => { e.stopPropagation(); handlePostLike(post.id); }}
                            >
                              {post.liked ? '❤️' : '🤍'} {post.likes}
                            </button>
                            <span className={styles.statItem}>💬 {post.comments}</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {hasMore && (
                  <button className={styles.btnLoadMore} onClick={() => loadPosts(false)} disabled={postsLoading}>
                    {postsLoading ? '불러오는 중...' : '더 보기'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* ── 푸터 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <div className={styles.footerLogoMark} />
            무브IQ
          </div>
          <p className={styles.footerTagline}>이사 후 "알았다면 안 왔을 텐데"가 없는 세상을 만듭니다.</p>
          <div className={styles.footerCopy}>© 2026 MoveIQ. All rights reserved.</div>
        </div>
      </footer>

      {/* 주민 인증 모달 */}
      {verifyOpen && (
        <ResidentVerifyModal
          onClose={() => setVerifyOpen(false)}
          onSuccess={dong => {
            setVerifyStatus({ is_verified: true, verified_dong: dong });
            setVerifyOpen(false);
          }}
          sessionId={sessionId}
          userId={user?.id}
          defaultDong={selectedDong !== '전체' ? selectedDong : dongs[0]}
        />
      )}

      {/* 글쓰기 모달 */}
      {writeOpen && (
        <WriteModal
          onClose={() => setWriteOpen(false)}
          onSuccess={post => { setPosts(prev => [post, ...prev]); }}
          sessionId={sessionId}
          userId={user?.id}
          nickname={user?.nickname}
          defaultDong={selectedDong}
        />
      )}

      {/* 게시글 상세 모달 */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          sessionId={sessionId}
          userId={user?.id}
          nickname={user?.nickname}
          onClose={() => {
            setSelectedPostId(null);
            loadPosts(true);   // 좋아요/댓글 반영
          }}
        />
      )}
    </>
  );
}
