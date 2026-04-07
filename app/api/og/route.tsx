import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const GRADE_COLORS: Record<string, string> = {
  S: '#3b82f6', A: '#22c55e', B: '#eab308', C: '#ef4444', D: '#9ca3af',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dong    = searchParams.get('dong');
  const address = searchParams.get('address');
  const score   = searchParams.get('score');
  const grade   = searchParams.get('grade');

  const hasResult  = !!(address && score && grade);
  const gradeColor = GRADE_COLORS[grade ?? ''] ?? '#646F4B';
  const displayName = address ?? dong ?? '이 동네';

  return new ImageResponse(
    (
      <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'flex-start', background:'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)', padding:'72px 80px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:'-60px', top:'-60px', width:'420px', height:'420px', borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,0.15) 0%,transparent 70%)' }} />

        {hasResult && (
          <div style={{ position:'absolute', right:'80px', top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'160px', height:'160px', borderRadius:'50%', background:`${gradeColor}22`, border:`4px solid ${gradeColor}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:'64px', fontWeight:'900', color:gradeColor, lineHeight:'1' }}>{grade}</span>
              <span style={{ fontSize:'14px', color:'#94a3b8', marginTop:'4px' }}>등급</span>
            </div>
            <span style={{ fontSize:'36px', fontWeight:'900', color:'#f8fafc' }}>{score}점</span>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px' }}>
          <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:'linear-gradient(135deg,#646F4B,#4a5236)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>
            🏙️
          </div>
          <span style={{ fontSize:'26px', fontWeight:'700', color:'#94a3b8' }}>무브IQ</span>
        </div>

        <div style={{ fontSize:'20px', color:'#60a5fa', fontWeight:'600', marginBottom:'18px', background:'rgba(59,130,246,0.12)', padding:'8px 20px', borderRadius:'100px', border:'1px solid rgba(59,130,246,0.3)', maxWidth: hasResult ? '640px' : '900px' }}>
          📍 {displayName}
        </div>

        <div style={{ fontSize: hasResult ? '46px' : '52px', fontWeight:'800', color:'#f8fafc', lineHeight:'1.2', letterSpacing:'-0.5px', marginBottom:'24px', maxWidth: hasResult ? '620px' : '800px' }}>
          {hasResult
            ? <span>AI 입지 분석 결과<br /><span style={{ color:gradeColor }}>종합 {score}점</span> {grade}등급</span>
            : <span>이사 괜찮을까?<br /><span style={{ color:'#60a5fa' }}>AI</span>가 3분 만에 알려드립니다.</span>
          }
        </div>

        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          {(hasResult
            ? ['🔊 소음','📚 학군','🚇 교통','🛍️ 상권','🏗️ 개발']
            : ['🔊 소음 이력','🏗️ 공사 현황','🏫 학군','🏠 전세 위험도','📊 종합 점수']
          ).map((item) => (
            <div key={item} style={{ padding:'8px 16px', borderRadius:'100px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#cbd5e1', fontSize:'17px' }}>
              {item}
            </div>
          ))}
        </div>

        <div style={{ position:'absolute', bottom:'40px', right:'80px', fontSize:'17px', color:'#475569' }}>
          moveiq.vercel.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
