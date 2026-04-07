import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: '공지사항 — 무브IQ' };

const NOTICES = [
  {
    num: '003',
    badge: '서비스',
    date: '2026.04.01',
    title: 'v3.0 업데이트 — 밝은 UI 개편 및 기능 강화',
    content: `무브IQ v3.0 업데이트 내용을 안내드립니다.\n\n▶ 주요 변경사항\n• 전체 UI를 밝은 화이트 그린 테마로 개편\n• 소음 알림 기능 강화 (관심 주소 등록 및 브라우저 알림)\n• 입지 분석 페이지 — 검색 히스토리 DB 저장 기능 추가\n• 페르소나별 레이더 차트 실데이터 적용\n• 법적 고지 페이지 신설 (이용약관·개인정보처리방침)\n• Pretendard 폰트 전면 적용\n\n▶ 베타 기간 안내\n현재 베타 서비스 운영 중으로, 유료 기능(이사 한 번 플랜, 프리미엄 구독)은 곧 출시 예정입니다.\n\n이용해 주셔서 감사합니다.`,
    important: true,
  },
  {
    num: '002',
    badge: '서비스',
    date: '2025.06.01',
    title: 'v2.0 업데이트 — 커뮤니티 기능 추가',
    content: `무브IQ v2.0 업데이트 내용을 안내드립니다.\n\n▶ 신규 기능\n• 동네 커뮤니티 오픈 (행정동 단위 게시판)\n• 소음 후기·이사 후기·생활 꿀팁 카테고리 신설\n• 주민 인증 기능 준비 중\n• 모바일 반응형 개선\n\n감사합니다.`,
    important: false,
  },
  {
    num: '001',
    badge: '오픈',
    date: '2025.03.01',
    title: '무브IQ 베타 서비스 오픈 안내',
    content: `안녕하세요, 무브IQ팀입니다.\n\n소음 크라우드 지도 × AI 입지 분석 플랫폼 무브IQ가 베타 서비스를 시작합니다.\n\n▶ 베타 기간 중 무료 제공\n• 소음 지도 열람 및 제보 무제한\n• AI 입지 분석 일 3회\n• 6개 레이어 기본 분석\n• 동네 커뮤니티 이용\n\n▶ 순차 오픈 예정\n• PDF 리포트 저장\n• 실시간 알림 고급 기능\n• 유료 요금제 (이사 한 번 플랜 / 월정액)\n\n서비스 이용 중 불편사항이나 개선 의견은 zntk660202@gmail.com로 보내주세요.\n\n감사합니다. 무브IQ팀 드림`,
    important: false,
  },
];

export default function NoticePage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.docHeader}>
          <div className={styles.docBadge}>공지사항</div>
          <h1 className={styles.docTitle}>공지사항</h1>
          <p className={styles.docSummary}>무브IQ 서비스 업데이트 및 주요 안내사항을 확인하세요.</p>
        </div>

        <div className={styles.noticeList}>
          {NOTICES.map((n) => (
            <details key={n.num} className={`${styles.noticeItem} ${n.important ? styles.noticeItemImportant : ''}`}>
              <summary className={styles.noticeSummary}>
                <div className={styles.noticeLeft}>
                  <span className={`${styles.noticeBadge} ${n.important ? styles.noticeBadgeImportant : ''}`}>{n.badge}</span>
                  <span className={styles.noticeTitle}>{n.title}</span>
                </div>
                <span className={styles.noticeDate}>{n.date}</span>
              </summary>
              <div className={styles.noticeBody}>
                {n.content.split('\n').map((line, i) => (
                  <p key={i} style={{ marginBottom: line === '' ? 0 : 8 }}>{line || <br />}</p>
                ))}
              </div>
            </details>
          ))}
        </div>

        <div className={styles.docFooter}>
          <p>추가 문의: <a href="mailto:zntk660202@gmail.com">zntk660202@gmail.com</a></p>
        </div>
      </div>
    </main>
  );
}
