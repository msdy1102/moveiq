import type { ReactNode } from 'react';
import Link from 'next/link';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight:'100vh', background:'#f7faf5', fontFamily:"'Pretendard', sans-serif" }}>
      {/* 헤더 */}
      <header style={{ background:'#fff', borderBottom:'1px solid rgba(100,111,75,.15)', padding:'0 24px', height:60, display:'flex', alignItems:'center', gap:16, position:'sticky', top:0, zIndex:100 }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, fontWeight:800, fontSize:16, color:'#646F4B' }}>
          <span style={{ display:'inline-block', width:26, height:26, background:'#646F4B', borderRadius:7, position:'relative', flexShrink:0 }} />
          무브IQ
        </Link>
        <span style={{ color:'#a4ad98', fontSize:13 }}>법적 고지</span>
        <nav style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          <Link href="/legal/terms"   style={{ fontSize:13, color:'#7a8570', padding:'5px 12px', borderRadius:18 }}>이용약관</Link>
          <Link href="/legal/privacy" style={{ fontSize:13, color:'#7a8570', padding:'5px 12px', borderRadius:18 }}>개인정보처리방침</Link>
          <Link href="/legal/notice"  style={{ fontSize:13, color:'#7a8570', padding:'5px 12px', borderRadius:18 }}>공지사항</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
