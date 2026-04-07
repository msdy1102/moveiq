import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '무브IQ — 이사 전, 이것만 보면 끝';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          padding: '80px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 원형 장식 */}
        <div
          style={{
            position: 'absolute',
            right: '-100px',
            top: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '200px',
            bottom: '-80px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          }}
        />

        {/* 로고 + 서비스명 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}
          >
            🏙️
          </div>
          <span style={{ fontSize: '32px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.5px' }}>
            무브IQ
          </span>
        </div>

        {/* 메인 헤드라인 */}
        <div
          style={{
            fontSize: '58px',
            fontWeight: '800',
            color: '#f8fafc',
            lineHeight: 1.15,
            letterSpacing: '-1px',
            marginBottom: '24px',
            maxWidth: '800px',
          }}
        >
          이사 후 후회,
          <br />
          <span style={{ color: '#60a5fa' }}>42%</span>가 겪는다.
        </div>

        {/* 서브 설명 */}
        <div
          style={{
            fontSize: '26px',
            color: '#94a3b8',
            lineHeight: 1.5,
            maxWidth: '720px',
            marginBottom: '48px',
          }}
        >
          소음 크라우드 지도 × AI 입지 분석<br />
          계약 전 3분이면 막을 수 있습니다.
        </div>

        {/* 기능 배지 3개 */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { icon: '🔊', label: '소음 지도' },
            { icon: '🏙️', label: 'AI 입지 분석' },
            { icon: '💬', label: '동네 커뮤니티' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '100px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#cbd5e1',
                fontSize: '20px',
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* URL 워터마크 */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '80px',
            fontSize: '18px',
            color: '#475569',
          }}
        >
          moveiq.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
