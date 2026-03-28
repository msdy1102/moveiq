'use client';

import { useState } from 'react';
import styles from './community.module.css';

// ── 샘플 게시글 데이터 ──────────────────────────────────
const SAMPLE_POSTS = [
  {
    id: 1,
    category: '소음 후기',
    categoryIcon: '🔊',
    title: '성산동 주말 새벽 소음 실제로 얼마나 심한가요?',
    content: '계약을 고려 중인데 주변에 유흥가가 있다고 해서요. 실제 거주자분들 경험 궁금합니다.',
    author: '이사준비중',
    verified: false,
    dong: '마포구 성산동',
    likes: 12,
    comments: 7,
    createdAt: '2시간 전',
  },
  {
    id: 2,
    category: '이사 후기',
    categoryIcon: '🏠',
    title: '성산동 3개월 살아보니 솔직 후기',
    content: '이중창 시공 후 소음은 많이 잡혔어요. 교통은 진짜 최고입니다. 마트까지 도보 5분이고 카페도 많아요.',
    author: '성산동주민',
    verified: true,
    dong: '마포구 성산동',
    likes: 34,
    comments: 15,
    createdAt: '1일 전',
  },
  {
    id: 3,
    category: '생활 꿀팁',
    categoryIcon: '💡',
    title: '이 동네 주차 팁 총정리',
    content: '주차 전쟁이 심한 동네인데, 이른 아침이나 주중 낮엔 주차 공간 여유있어요. 공영주차장 위치도 알려드릴게요.',
    author: '5년거주자',
    verified: true,
    dong: '마포구 성산동',
    likes: 21,
    comments: 4,
    createdAt: '3일 전',
  },
  {
    id: 4,
    category: '동네 질문',
    categoryIcon: '❓',
    title: '연남동 쪽 초등학교 배정 어떻게 되나요?',
    content: '아이가 내년에 입학 예정인데 연남동으로 이사 고려 중이에요. 학교 환경이 궁금합니다.',
    author: '초등맘',
    verified: false,
    dong: '마포구 연남동',
    likes: 8,
    comments: 3,
    createdAt: '5일 전',
  },
  {
    id: 5,
    category: '동네 소식',
    categoryIcon: '📢',
    title: '공덕동 재개발 투표 공고 — 주민 참여 안내',
    content: '이번 주 금요일까지 재개발 찬반 투표입니다. 해당 구역 거주자분들 꼭 확인하세요.',
    author: '동네지킴이',
    verified: true,
    dong: '마포구 공덕동',
    likes: 45,
    comments: 22,
    createdAt: '1주일 전',
  },
  {
    id: 6,
    category: '이웃 구해요',
    categoryIcon: '🤝',
    title: '성산동 이사 예정인데 동네 정보 알려주실 분',
    content: '다음 달 성산동으로 이사 예정입니다. 실제 살아보신 분의 생생한 이야기 듣고 싶어요!',
    author: '이사예정자',
    verified: false,
    dong: '마포구 성산동',
    likes: 3,
    comments: 9,
    createdAt: '2일 전',
  },
];

const CATEGORIES = ['전체', '❓ 동네 질문', '💡 생활 꿀팁', '🔊 소음 후기', '🏠 이사 후기', '📢 동네 소식', '🤝 이웃 구해요', '🏢 건물 후기'];

// ── 건물별 거주후기 샘플 ──────────────────────────────────
const BUILDING_REVIEWS = [
  { id:1, address:'마포구 성산동 123-45', buildingName:'○○빌라 2층', rating:4,
    pros:'햇빛 잘 들고 조용해요. 건물주 친절.', cons:'주차 1대밖에 안됨. 엘리베이터 없음.',
    noise:'층간소음 거의 없음', jeonse:'전세가율 68% (안전)', author:'전세살이3년', date:'2025.02' },
  { id:2, address:'마포구 공덕동 456-78', buildingName:'△△오피스텔 8층', rating:3,
    pros:'역세권 최고. 편의시설 많음.', cons:'유흥가 소음 새벽까지 심함. 주말은 최악.',
    noise:'유흥 소음 매우 심함 (10점 중 8점)', jeonse:'전세가율 91% (주의)', author:'공덕뚜벅이', date:'2025.01' },
  { id:3, address:'마포구 연남동 789-12', buildingName:'연남빌딩 3층', rating:5,
    pros:'조용하고 카페거리 걸어서 5분. 녹지 많음.', cons:'주차 어렵고 배달 오토바이 소음.',
    noise:'전반적으로 조용함', jeonse:'전세가율 72% (양호)', author:'연남동토박이', date:'2024.12' },
];
const DONGS = ['전체 동네', '마포구 성산동', '마포구 연남동', '마포구 공덕동', '강남구 역삼동', '용산구 이태원동'];

export default function CommunityPage() {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedDong,     setSelectedDong]     = useState('전체 동네');
  const [writeOpen,        setWriteOpen]         = useState(false);
  const [searchQ,          setSearchQ]           = useState('');

  const filtered = SAMPLE_POSTS.filter(p => {
    const catMatch = selectedCategory === '전체' || p.category === selectedCategory.replace(/^[^\s]+\s/, '');
    const dongMatch = selectedDong === '전체 동네' || p.dong === selectedDong;
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
              <div className={styles.sideTitle}>📍 동네 선택</div>
              <div className={styles.dongList}>
                {DONGS.map(d => (
                  <button
                    key={d}
                    className={`${styles.dongBtn} ${selectedDong === d ? styles.dongBtnActive : ''}`}
                    onClick={() => setSelectedDong(d)}
                  >
                    {d}
                  </button>
                ))}
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
