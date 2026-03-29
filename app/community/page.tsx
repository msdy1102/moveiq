'use client';

import { useState } from 'react';
import styles from './community.module.css';

const SAMPLE_POSTS: any[] = [];

const CATEGORIES = ['전체', '❓ 동네 질문', '💡 생활 꿀팁', '🔊 소음 후기', '🏠 이사 후기', '📢 동네 소식', '🤝 이웃 구해요', '🏢 건물 후기'];

const BUILDING_REVIEWS: any[] = [];

export default function CommunityPage() {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedDong,     setSelectedDong]     = useState('전체');
  const [writeOpen,        setWriteOpen]         = useState(false);
  const [searchQ,          setSearchQ]           = useState('');
  // 동네 목록 — localStorage 저장, 초기값 빈 배열
  const [dongs, setDongs] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('community_dongs') ?? '[]'); } catch { return []; }
  });
  const [addDongOpen,  setAddDongOpen]  = useState(false);
  const [newDongInput, setNewDongInput] = useState('');

  function addDong() {
    const d = newDongInput.trim();
    if (!d || dongs.includes(d)) { setAddDongOpen(false); setNewDongInput(''); return; }
    const next = [...dongs, d];
    setDongs(next);
    localStorage.setItem('community_dongs', JSON.stringify(next));
    setSelectedDong(d);
    setAddDongOpen(false);
    setNewDongInput('');
  }

  function removeDong(d: string) {
    const next = dongs.filter(x => x !== d);
    setDongs(next);
    localStorage.setItem('community_dongs', JSON.stringify(next));
    if (selectedDong === d) setSelectedDong('전체');
  }

  const filtered = SAMPLE_POSTS.filter((p: any) => {
    const catMatch = selectedCategory === '전체' || p.category === selectedCategory.replace(/^[^\s]+\s/, '');
    const dongMatch = selectedDong === '전체' || p.dong === selectedDong;
    const searchMatch = !searchQ || p.title.includes(searchQ) || p.content.includes(searchQ);
    return catMatch && dongMatch && searchMatch;
  });

  return (
    <>
      {/* ── 헤더 ── */}
      <header className={styles.header}>
        <a className={styles.logo} href="/">
          <div className={styles.logoMark}>📍</div>
          <span className={styles.logoText}>무브IQ</span>
        </a>
        <nav className={styles.headerNav}>
          <a href="/" className={styles.navLink}>입지 분석</a>
          <a href="/" className={styles.navLink} onClick={e=>{e.preventDefault();window.location.href='/#noise';}}>소음 지도</a>
          <a href="/community" className={`${styles.navLink} ${styles.navLinkActive}`}>소통하기</a>
        </nav>
        <button className={styles.btnLogin}>로그인</button>
      </header>

      <main className={styles.main}>
        {/* ── 페이지 타이틀 ── */}
        <section className={styles.pageHero}>
          <div className={styles.pageHeroInner}>
            <div className={styles.heroBadge}>동네 커뮤니티</div>
            <h1>살아본 사람만 아는 이야기</h1>
            <p>이사 예정자와 기존 주민이 함께 만드는 진짜 동네 정보</p>
          </div>
        </section>

        <div className={styles.layout}>
          {/* ── 사이드바 ── */}
          <aside className={styles.sidebar}>
            {/* 동네 선택 */}
            <div className={styles.sideSection}>
              <div className={styles.sideTitle} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>📍 동네 선택</span>
                <button className={styles.btnAddDong} onClick={()=>setAddDongOpen(true)} title="동네 추가">+</button>
              </div>
              {/* 동네 추가 입력창 */}
              {addDongOpen && (
                <div className={styles.addDongRow}>
                  <input
                    className={styles.addDongInput}
                    value={newDongInput}
                    onChange={e=>setNewDongInput(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&addDong()}
                    placeholder="예: 마포구 성산동"
                    autoFocus
                  />
                  <button className={styles.btnAddDongOk} onClick={addDong}>추가</button>
                  <button className={styles.btnAddDongCancel} onClick={()=>{setAddDongOpen(false);setNewDongInput('');}}>✕</button>
                </div>
              )}
              <div className={styles.dongList}>
                {/* 전체 버튼 */}
                <button
                  className={`${styles.dongBtn} ${selectedDong === '전체' ? styles.dongBtnActive : ''}`}
                  onClick={() => setSelectedDong('전체')}
                >전체</button>
                {/* 사용자 추가 동네 */}
                {dongs.map(d => (
                  <div key={d} className={styles.dongBtnWrap}>
                    <button
                      className={`${styles.dongBtn} ${selectedDong === d ? styles.dongBtnActive : ''}`}
                      onClick={() => setSelectedDong(d)}
                    >{d}</button>
                    <button className={styles.dongBtnDel} onClick={()=>removeDong(d)}>✕</button>
                  </div>
                ))}
                {dongs.length === 0 && (
                  <p className={styles.dongEmpty}>+ 버튼으로 관심 동네를 추가하세요</p>
                )}
              </div>
            </div>

            {/* 카테고리 */}
            <div className={styles.sideSection}>
              <div className={styles.sideTitle}>📂 카테고리</div>
              <div className={styles.catList}>
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    className={`${styles.catBtn} ${selectedCategory === c ? styles.catBtnActive : ''}`}
                    onClick={() => setSelectedCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 인증 배지 안내 */}
            <div className={styles.verifyInfo}>
              <div className={styles.verifyTitle}>🏠 주민 인증이란?</div>
              <p>실거주 주소를 인증한 회원은 <strong>🏠 배지</strong>가 표시됩니다. 이사 예정자가 신뢰할 수 있는 정보를 더 쉽게 찾을 수 있어요.</p>
              <button className={styles.btnVerify}>내 동네 인증하기</button>
            </div>
          </aside>

          {/* ── 메인 피드 ── */}
          <div className={styles.feed}>
            {/* 검색 + 글쓰기 */}
            <div className={styles.feedTop}>
              <div className={styles.searchBar}>
                <span>🔍</span>
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="게시글 검색"
                  className={styles.searchInput}
                />
              </div>
              <button className={styles.btnWrite} onClick={() => setWriteOpen(true)}>✏️ 글쓰기</button>
            </div>

            {/* 정렬 */}
            <div className={styles.sortBar}>
              <span className={styles.resultCount}>게시글 {filtered.length}개</span>
              <div className={styles.sortBtns}>
                <button className={`${styles.sortBtn} ${styles.sortBtnActive}`}>최신순</button>
                <button className={styles.sortBtn}>공감 많은 순</button>
                <button className={styles.sortBtn}>🏠 인증 주민 먼저</button>
              </div>
            </div>

            {/* 건물 후기 탭 */}
            {selectedCategory === '🏢 건물 후기' ? (
              <div className={styles.buildingReviews}>
                <div className={styles.sortBar}>
                  <span className={styles.resultCount}>건물후기 {BUILDING_REVIEWS.length}개</span>
                  <button className={styles.btnWrite} onClick={() => setWriteOpen(true)}>🏢 후기 쓰기</button>
                </div>
                {BUILDING_REVIEWS.map(r => (
                  <div key={r.id} className={styles.buildingCard}>
                    <div className={styles.buildingCardTop}>
                      <div>
                        <div className={styles.buildingName}>{r.buildingName}</div>
                        <div className={styles.buildingAddr}>📍 {r.address}</div>
                      </div>
                      <div className={styles.buildingRating}>
                        {'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}
                      </div>
                    </div>
                    <div className={styles.buildingProscons}>
                      <div className={styles.buildingPros}><span>👍 장점</span> {r.pros}</div>
                      <div className={styles.buildingCons}><span>👎 단점</span> {r.cons}</div>
                    </div>
                    <div className={styles.buildingTags}>
                      <span className={styles.buildingTag}>🔊 {r.noise}</span>
                      <span className={`${styles.buildingTag} ${r.jeonse.includes('주의')?styles.buildingTagWarn:''}`}>🏦 {r.jeonse}</span>
                    </div>
                    <div className={styles.buildingMeta}>{r.author} · {r.date}</div>
                  </div>
                ))}
              </div>
            ) : (
            <>
            {/* 일반 게시글 목록 */}
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>
                <div>💬</div>
                <p>아직 게시글이 없어요.<br/>이 동네의 첫 번째 글을 남겨보세요!</p>
                <button className={styles.btnWrite} onClick={() => setWriteOpen(true)}>첫 글 쓰기</button>
              </div>
            ) : (
              <div className={styles.postList}>
                {filtered.map(post => (
                  <article key={post.id} className={styles.postCard}>
                    <div className={styles.postTop}>
                      <span className={styles.postCategory}>{post.categoryIcon} {post.category}</span>
                      <span className={styles.postDong}>📍 {post.dong}</span>
                    </div>
                    <h3 className={styles.postTitle}>{post.title}</h3>
                    <p className={styles.postExcerpt}>{post.content}</p>
                    <div className={styles.postBottom}>
                      <div className={styles.postMeta}>
                        <span className={styles.postAuthor}>
                          {post.verified && <span className={styles.verifiedBadge}>🏠</span>}
                          {post.author}
                        </span>
                        <span className={styles.postDate}>{post.createdAt}</span>
                      </div>
                      <div className={styles.postStats}>
                        <span>👍 {post.likes}</span>
                        <span>💬 {post.comments}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            </>
            )}
          </div>
        </div>
      </main>

      {/* ── 글쓰기 모달 ── */}
      {writeOpen && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setWriteOpen(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h3>✏️ 글쓰기</h3>
              <button onClick={() => setWriteOpen(false)}>✕</button>
            </div>

            <div className={styles.comingSoonBox}>
              <div className={styles.comingSoonIcon}>🔧</div>
              <div className={styles.comingSoonTitle}>로그인 후 이용 가능합니다</div>
              <p>커뮤니티 글쓰기 기능은 회원 가입 후 이용하실 수 있습니다.<br/>베타 서비스 오픈 후 순차적으로 제공될 예정입니다.</p>
              <div className={styles.comingSoonBtns}>
                <button className={styles.btnPrimary} onClick={() => setWriteOpen(false)}>로그인하기</button>
                <button className={styles.btnSecondary} onClick={() => setWriteOpen(false)}>닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 푸터 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>📍 무브IQ</div>
          <p className={styles.footerTagline}>이사 후 "알았다면 안 왔을 텐데"라는 말이 사라지는 세상을 만든다</p>
          <div className={styles.footerCopy}>© 2025 무브IQ. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
