'use client';
// app/analysis/share/[token]/SharedReportClient.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SharedData {
  address:    string;
  result:     any;
  created_at: string;
  expires_at: string;
}

const SCORE_LABELS: Record<string, string> = {
  traffic: '🚇 교통 접근성', infra: '🏪 생활 인프라',
  school: '📚 학군 환경', noise: '🔊 소음·환경',
  commerce: '🛍️ 상권 활성도', development: '🏗️ 개발 잠재력',
};

const GRADE_COLOR: Record<string, string> = {
  S:'#2563eb', A:'#16a34a', B:'#ca8a04', C:'#dc2626', D:'#9ca3af',
};

export default function SharedReportClient({ token }: { token: string }) {
  const [data,    setData]    = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`/api/share?token=${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json);
        else setError(json.error === 'EXPIRED' ? '만료된 공유 링크입니다.' : '공유 링크를 찾을 수 없습니다.');
      })
      .catch(() => setError('불러오기에 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:12, color:'#7a8570' }}>
      <div style={{ width:32, height:32, border:'3px solid #e8ebe3', borderTopColor:'#646F4B', borderRadius:'50%', animation:'spin .6s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize:14 }}>리포트 불러오는 중...</span>
    </div>
  );

  if (error || !data) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16, padding:24 }}>
      <span style={{ fontSize:48 }}>😕</span>
      <p style={{ fontSize:16, color:'#333', fontWeight:600 }}>{error || '링크를 찾을 수 없습니다.'}</p>
      <Link href="/" style={{ color:'#646F4B', fontWeight:700, fontSize:14 }}>무브IQ 홈으로 →</Link>
    </div>
  );

  const R = data.result;
  const scores = R.scores ?? {};
  const expiresDate = new Date(data.expires_at).toLocaleDateString('ko-KR');

  return (
    <div style={{ minHeight:'100vh', background:'#f8faf6', fontFamily:"'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header style={{ background:'#fff', borderBottom:'1px solid #e8ebe3', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
          <div style={{ width:20, height:20, background:'#646F4B', borderRadius:'50% 50% 50% 0', transform:'rotate(-45deg)' }} />
          <span style={{ fontSize:16, fontWeight:900, color:'#646F4B' }}>무브IQ</span>
        </Link>
        <Link href={`/analysis?address=${encodeURIComponent(data.address)}`} style={{ fontSize:13, fontWeight:700, color:'#646F4B', textDecoration:'none', background:'#f0f4ed', padding:'6px 14px', borderRadius:8 }}>
          직접 분석해보기 →
        </Link>
      </header>

      <main style={{ maxWidth:700, margin:'0 auto', padding:'24px 16px 64px' }}>

        {/* 공유 배너 */}
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:12, color:'#92400e', display:'flex', alignItems:'center', gap:8 }}>
          🔗 공유된 리포트 · {expiresDate}까지 유효
        </div>

        {/* 주소 + 종합 점수 */}
        <div style={{ background:'#fff', border:'1px solid #e8ebe3', borderRadius:14, padding:'24px', marginBottom:16 }}>
          <p style={{ fontSize:12, color:'#7a8570', margin:'0 0 6px', fontWeight:600 }}>📍 분석 주소</p>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#1a1e15', margin:'0 0 20px' }}>{data.address}</h1>

          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:52, fontWeight:900, color: GRADE_COLOR[R.grade] ?? '#646F4B', lineHeight:1 }}>{R.grade}</div>
              <div style={{ fontSize:11, color:'#7a8570', marginTop:4 }}>종합 등급</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:36, fontWeight:900, color:'#1a1e15' }}>{R.total}<span style={{ fontSize:16, color:'#7a8570' }}>점</span></div>
              <p style={{ fontSize:13, color:'#3d4535', lineHeight:1.6, margin:'8px 0 0' }}>{R.ai_comment}</p>
            </div>
          </div>
        </div>

        {/* 6개 레이어 점수 */}
        <div style={{ background:'#fff', border:'1px solid #e8ebe3', borderRadius:14, padding:'20px 24px', marginBottom:16 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'#111', margin:'0 0 16px' }}>레이어별 점수</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {Object.entries(SCORE_LABELS).map(([key, label]) => {
              const score = scores[key] ?? 0;
              const color = score >= 80 ? '#16a34a' : score >= 60 ? '#646F4B' : score >= 40 ? '#ca8a04' : '#dc2626';
              return (
                <div key={key} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:13, color:'#3d4535', minWidth:110 }}>{label}</span>
                  <div style={{ flex:1, height:8, background:'#f0f0f0', borderRadius:100, overflow:'hidden' }}>
                    <div style={{ width:`${score}%`, height:'100%', background:color, borderRadius:100, transition:'width .4s' }} />
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color, minWidth:32, textAlign:'right' }}>{score}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 코멘트 상세 */}
        {R.traffic_detail && (
          <div style={{ background:'#fff', border:'1px solid #e8ebe3', borderRadius:14, padding:'20px 24px', marginBottom:16 }}>
            <h2 style={{ fontSize:14, fontWeight:700, color:'#111', margin:'0 0 14px' }}>상세 분석</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'traffic_detail', label:'🚇 교통' },
                { key:'infra_detail',   label:'🏪 인프라' },
                { key:'school_detail',  label:'📚 학군' },
                { key:'noise_detail',   label:'🔊 소음' },
                { key:'commerce_detail',label:'🛍️ 상권' },
                { key:'development_detail', label:'🏗️ 개발' },
              ].map(({ key, label }) => R[key] ? (
                <div key={key} style={{ fontSize:13, color:'#3d4535', lineHeight:1.6 }}>
                  <strong style={{ color:'#1a1e15' }}>{label}</strong> {R[key]}
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ background:'linear-gradient(135deg,#646F4B,#4a5236)', borderRadius:14, padding:'24px', textAlign:'center', color:'#fff' }}>
          <div style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>내 이사 예정지도 분석해보기</div>
          <p style={{ fontSize:13, opacity:.85, marginBottom:20, lineHeight:1.6 }}>소음 크라우드 지도 × AI 입지 분석<br/>무료로 시작하세요</p>
          <Link href="/analysis" style={{ display:'inline-block', background:'#fff', color:'#646F4B', fontWeight:700, fontSize:14, padding:'12px 28px', borderRadius:10, textDecoration:'none' }}>
            무료 분석 시작하기 →
          </Link>
        </div>

      </main>
    </div>
  );
}
