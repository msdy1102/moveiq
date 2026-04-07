import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: '개인정보처리방침 — 무브IQ' };

const SECTIONS = [
  {
    title: '제1조 (개인정보의 처리 목적)',
    content: `무브IQ는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.\n\n1. 회원 가입 및 관리: 회원제 서비스 제공에 따른 본인 확인, 개인 식별, 불량 회원의 부정 이용 방지\n2. 서비스 제공: 소음 제보 데이터 처리, AI 입지 분석, 커뮤니티 서비스 제공\n3. 고충 처리: 불만 처리 등 민원 처리, 분쟁 해결\n4. 서비스 개선: 서비스 이용 통계 분석 및 기능 개선`,
  },
  {
    title: '제2조 (개인정보의 처리 및 보유 기간)',
    content: `① 무브IQ는 법령에 따른 개인정보 보유·이용 기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.\n\n② 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.\n\n1. 회원 정보: 회원 탈퇴 시 즉시 파기\n2. 소음 제보 데이터: 제보일로부터 90일 후 자동 삭제 (위치는 반경 50m 내 익명화)\n3. 서비스 이용 기록: 3개월\n4. 소비자 불만 또는 분쟁 처리 기록: 3년 (전자상거래법)`,
  },
  {
    title: '제3조 (처리하는 개인정보의 항목)',
    content: `① 무브IQ는 다음의 개인정보 항목을 처리하고 있습니다.\n\n◎ 회원가입 시\n- 필수 항목: 이메일 주소, 비밀번호, 닉네임\n- Google OAuth 가입 시: Google 계정 이메일, 프로필 사진(선택)\n\n◎ 소음 제보 시\n- 수집 항목: 제보 위치(50m 반경 내 랜덤화 처리), IP 주소\n- 선택 항목: 제보 내용 텍스트, 첨부 이미지\n\n◎ 서비스 이용 중 자동 수집\n- 쿠키, IP 주소, 브라우저 종류, 방문 일시, 서비스 이용 기록`,
  },
  {
    title: '제4조 (개인정보의 제3자 제공)',
    content: `무브IQ는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.\n\n1. 이용자가 사전에 동의한 경우\n2. 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우`,
  },
  {
    title: '제5조 (개인정보처리의 위탁)',
    content: `무브IQ는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.\n\n1. Supabase Inc. (데이터베이스 호스팅) — 서비스 이용 기간\n2. Vercel Inc. (웹 서비스 호스팅) — 서비스 이용 기간\n3. Anthropic PBC (AI 분석 엔진) — 분석 요청 시 즉시 처리 후 미보관`,
  },
  {
    title: '제6조 (정보주체의 권리·의무 및 행사 방법)',
    content: `① 정보주체는 무브IQ에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.\n\n1. 개인정보 열람 요구\n2. 오류 등이 있을 경우 정정 요구\n3. 삭제 요구\n4. 처리 정지 요구\n\n② 위의 권리 행사는 zntk660202@gmail.com 로 이메일을 통해 하실 수 있으며 무브IQ는 이에 대해 지체 없이 조치하겠습니다.`,
  },
  {
    title: '제7조 (개인정보의 안전성 확보 조치)',
    content: `무브IQ는 개인정보보호법 제29조에 따라 다음과 같이 안전성 확보에 필요한 기술적·관리적 조치를 하고 있습니다.\n\n1. 개인정보 취급 직원의 최소화 및 교육\n2. 내부 관리계획의 수립 및 시행\n3. 개인정보의 암호화: 비밀번호 및 개인 식별 정보는 암호화하여 저장\n4. 해킹 등에 대비한 기술적 대책: 보안 프로그램 설치 및 주기적 갱신\n5. 소음 제보 위치: 반경 50m 내 랜덤화 처리로 원본 좌표 미저장`,
  },
  {
    title: '제8조 (개인정보 보호책임자)',
    content: `무브IQ는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만 처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.\n\n◎ 개인정보 보호책임자\n- 이메일: zntk660202@gmail.com\n- 처리시간: 영업일 기준 3일 이내 답변`,
  },
];

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.docHeader}>
          <div className={styles.docBadge}>개인정보처리방침</div>
          <h1 className={styles.docTitle}>개인정보처리방침</h1>
          <div className={styles.docMeta}>
            <span>시행일: 2026년 1월 1일</span>
            <span>·</span>
            <span>최종 수정: 2026년 4월 1일</span>
          </div>
          <p className={styles.docSummary}>
            무브IQ는 이용자의 개인정보를 소중히 여기며, 개인정보 보호법을 준수하고 있습니다.
            이용자의 개인정보가 어떻게 수집·이용·보호되는지 아래에서 확인하세요.
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
          <p>본 방침은 2026년 4월 1일부터 시행됩니다.</p>
          <p>문의: <a href="mailto:zntk660202@gmail.com">zntk660202@gmail.com</a></p>
        </div>
      </div>
    </main>
  );
}
