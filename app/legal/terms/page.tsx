import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: '이용약관 — 무브IQ' };

const SECTIONS = [
  {
    title: '제1조 (목적)',
    content: `본 약관은 무브IQ(이하 "서비스")가 제공하는 소음 크라우드 지도, AI 입지 분석, 실거주자 커뮤니티 등 인터넷 서비스(이하 "서비스")의 이용과 관련하여 서비스와 이용자 간의 권리, 의무, 책임사항 및 기타 필요한 사항을 규정함을 목적으로 합니다.`,
  },
  {
    title: '제2조 (정의)',
    content: `① 이 약관에서 사용하는 용어의 정의는 다음과 같습니다.\n\n1. "서비스"란 무브IQ가 제공하는 소음 크라우드 지도, AI 입지 분석 리포트, 실거주자 커뮤니티, 개발계획 정보 등 일체의 서비스를 말합니다.\n2. "이용자"란 이 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.\n3. "회원"이란 서비스에 회원가입을 신청하여 서비스 이용 승낙을 받은 자를 말합니다.\n4. "비회원"이란 회원에 가입하지 않고 서비스를 이용하는 자를 말합니다.\n5. "소음 제보"란 이용자가 직접 경험한 소음 발생 사실을 서비스에 등록하는 행위를 말합니다.`,
  },
  {
    title: '제3조 (약관의 게시와 개정)',
    content: `① 서비스는 이 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기화면에 게시합니다.\n② 서비스는 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.\n③ 약관을 개정할 경우 적용일자 및 개정 사유를 명시하여 현행 약관과 함께 서비스 내 공지사항 화면에 그 적용일자 7일(이용자에게 불리한 경우 30일) 이전부터 적용일자 전일까지 공지합니다.`,
  },
  {
    title: '제4조 (서비스 제공 및 변경)',
    content: `① 서비스는 다음과 같은 서비스를 제공합니다.\n\n1. 소음 크라우드 지도: 이용자가 제보한 소음 데이터를 지도에 표시하는 서비스\n2. AI 입지 분석: 교통·인프라·학군·소음·상권·개발잠재력 6개 레이어를 AI로 종합 분석하는 서비스\n3. 개발계획 정보: 재개발·재건축·교통 인프라 신설 등 공공 정보를 제공하는 서비스\n4. 실거주자 커뮤니티: 이용자 간 동네 정보를 교류하는 커뮤니티 서비스\n5. 소음 알림: 관심 지역의 소음 변화를 알림으로 제공하는 서비스\n\n② 서비스는 운영상, 기술상 이유로 서비스 내용을 변경할 수 있습니다. 이 경우 변경 내용 및 제공일자를 명시하여 공지합니다.\n③ 서비스가 제공하는 분석 결과는 참고용이며, 최종 부동산 계약 결정의 책임은 이용자에게 있습니다.`,
  },
  {
    title: '제5조 (서비스 이용의 제한)',
    content: `① 서비스는 다음 각 호에 해당하는 경우 이용자의 서비스 이용을 제한할 수 있습니다.\n\n1. 허위 소음 제보 또는 조작된 데이터를 등록한 경우\n2. 타인의 명예를 훼손하거나 불이익을 주는 행위를 한 경우\n3. 서비스의 정상적인 운영을 방해한 경우\n4. 기타 관련 법령 또는 이 약관을 위반한 경우`,
  },
  {
    title: '제6조 (이용자의 의무)',
    content: `이용자는 다음 행위를 하여서는 안 됩니다.\n\n1. 허위 정보의 등록 및 제보\n2. 타인의 개인정보 무단 수집·이용\n3. 서비스 운영을 방해하는 행위\n4. 지식재산권을 침해하는 행위\n5. 외설, 폭력적인 메시지, 기타 공서양속에 반하는 정보를 공개하는 행위`,
  },
  {
    title: '제7조 (면책조항)',
    content: `① 서비스는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우 서비스 제공에 관한 책임이 면제됩니다.\n② 서비스는 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.\n③ 서비스가 제공하는 소음 데이터 및 입지 분석 정보는 크라우드소싱 및 AI 기반 추정값으로, 100% 정확성을 보장하지 않습니다.\n④ 이용자가 서비스를 이용하여 기대하는 수익을 얻지 못하거나 손실이 발생하더라도 서비스는 이에 대해 책임을 지지 않습니다.`,
  },
  {
    title: '제8조 (준거법 및 재판관할)',
    content: `① 서비스와 이용자 간 발생한 분쟁에 관한 소송은 민사소송법상의 관할법원에 제소합니다.\n② 서비스와 이용자 간에 제기된 소송에는 대한민국 법령을 적용합니다.`,
  },
];

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.docHeader}>
          <div className={styles.docBadge}>이용약관</div>
          <h1 className={styles.docTitle}>무브IQ 이용약관</h1>
          <div className={styles.docMeta}>
            <span>시행일: 2026년 1월 1일</span>
            <span>·</span>
            <span>최종 수정: 2026년 4월 1일</span>
          </div>
          <p className={styles.docSummary}>
            무브IQ 서비스를 이용하시기 전에 이용약관을 꼭 읽어보세요. 서비스를 이용하면 이 약관에 동의한 것으로 간주됩니다.
          </p>
        </div>

        <div className={styles.toc}>
          <div className={styles.tocTitle}>목차</div>
          {SECTIONS.map((s, i) => (
            <a key={i} href={`#section-${i}`} className={styles.tocItem}>{s.title}</a>
          ))}
        </div>

        <div className={styles.docBody}>
          {SECTIONS.map((s, i) => (
            <section key={i} id={`section-${i}`} className={styles.docSection}>
              <h2 className={styles.docSectionTitle}>{s.title}</h2>
              <div className={styles.docContent}>{s.content.split('\n').map((line, j) => (
                <p key={j} style={{ marginBottom: line === '' ? 0 : 8 }}>{line || <br />}</p>
              ))}</div>
            </section>
          ))}
        </div>

        <div className={styles.docFooter}>
          <p>본 약관은 2026년 4월 1일부터 적용됩니다.</p>
          <p>문의: <a href="mailto:zntk660202@gmail.com">zntk660202@gmail.com</a></p>
        </div>
      </div>
    </main>
  );
}
