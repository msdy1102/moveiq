'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AuthButton from './AuthButton';
import styles from './Header.module.css';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchVal, setSearchVal] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/analysis?address=${encodeURIComponent(searchVal.trim())}`);
    }
  }

  const isLanding = pathname === '/';

  return (
    <header className={`${styles.header} ${isLanding ? styles.headerLanding : styles.headerApp}`}>
      <div className={styles.inner}>
        {/* 로고 */}
        <Link href="/" className={styles.logo}>
          <div className={styles.logoMark}/>
          <span className={styles.logoText}>무브IQ</span>
        </Link>

        {/* 검색창 — 랜딩 외 페이지에서만 */}
        {!isLanding && (
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="이사 예정 주소 입력 (예: 마포구 성산동)"
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>→</button>
          </form>
        )}

        {/* 데스크탑 네비 */}
        <nav className={styles.nav}>
          <Link href="/noise-map" className={`${styles.navLink} ${pathname === '/noise-map' ? styles.active : ''}`}>
            소음 지도
          </Link>
          <Link href="/analysis" className={`${styles.navLink} ${pathname === '/analysis' ? styles.active : ''}`}>
            입지 분석
          </Link>
          <Link href="/community" className={`${styles.navLink} ${pathname === '/community' ? styles.active : ''}`}>
            커뮤니티
          </Link>
        </nav>

        <div className={styles.actions}>
          <AuthButton />
        </div>

        {/* 모바일 햄버거 */}
        <button className={styles.hamburger} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <span/><span/><span/>
        </button>
      </div>

      {/* 모바일 메뉴 드롭다운 */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <Link href="/noise-map" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>소음 지도</Link>
          <Link href="/analysis"  className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>입지 분석</Link>
          <Link href="/community" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>커뮤니티</Link>
        </div>
      )}
    </header>
  );
}
