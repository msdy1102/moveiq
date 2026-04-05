'use client';
// ResidentVerifyModal.tsx
// 주민 인증 모달 — GPS 방식 + 계약 정보 방식
import { useState, useEffect } from 'react';
import styles from './verify.module.css';

interface Props {
  onClose:    () => void;
  onSuccess:  (dong: string) => void;
  sessionId:  string;
  userId?:    string;
  defaultDong?: string;
}

type Step = 'select_method' | 'gps' | 'contract' | 'result';
type Method = 'gps' | 'contract';

export default function ResidentVerifyModal({ onClose, onSuccess, sessionId, userId, defaultDong }: Props) {
  const [step,    setStep]    = useState<Step>('select_method');
  const [method,  setMethod]  = useState<Method>('gps');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ success: boolean; message: string; dong?: string } | null>(null);

  // GPS 상태
  const [gpsStatus,   setGpsStatus]   = useState<'idle' | 'getting' | 'done' | 'error'>('idle');
  const [gpsCoords,   setGpsCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [claimedDong, setClaimedDong] = useState(defaultDong ?? '');

  // 계약 정보
  const [contractDate,   setContractDate]   = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [contractDong,   setContractDong]   = useState('');
  const [contractType,   setContractType]   = useState('전세');

  // GPS 위치 가져오기
  function getGPS() {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }
    setGpsStatus('getting');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('done');
      },
      () => setGpsStatus('error'),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // GPS 인증 제출
  async function submitGPS() {
    if (!gpsCoords || !claimedDong.trim()) return;
    setLoading(true);
    try {
      const res  = await fetch('/api/resident-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method:       'gps',
          session_id:   sessionId,
          user_id:      userId,
          claimed_dong: claimedDong.trim(),
          lat:          gpsCoords.lat,
          lng:          gpsCoords.lng,
        }),
      });
      const json = await res.json();
      setResult({ success: json.success, message: json.message, dong: json.dong });
      setStep('result');
      if (json.success) onSuccess(json.dong ?? claimedDong);
    } catch {
      setResult({ success: false, message: '네트워크 오류가 발생했습니다.' });
      setStep('result');
    } finally { setLoading(false); }
  }

  // 계약 정보 인증 제출
  async function submitContract() {
    if (!contractDate || !contractAmount || !contractDong || !claimedDong.trim()) return;
    setLoading(true);
    try {
      const res  = await fetch('/api/resident-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method:           'contract',
          session_id:       sessionId,
          user_id:          userId,
          claimed_dong:     claimedDong.trim(),
          contract_date:    contractDate,
          contract_amount:  parseInt(contractAmount.replace(/,/g, ''), 10),
          contract_dong:    contractDong,
          contract_type:    contractType,
        }),
      });
      const json = await res.json();
      setResult({ success: json.success, message: json.message, dong: json.dong ?? claimedDong });
      setStep('result');
      if (json.success) onSuccess(json.dong ?? claimedDong);
    } catch {
      setResult({ success: false, message: '네트워크 오류가 발생했습니다.' });
      setStep('result');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h3 className={styles.modalTitle}>🏠 주민 인증</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* ── 방법 선택 ── */}
        {step === 'select_method' && (
          <div className={styles.body}>
            <p className={styles.intro}>
              실거주 동네를 인증하면 커뮤니티에서 <strong>🏠 인증 주민 배지</strong>가 표시됩니다.
              이사 예정자가 신뢰할 수 있는 정보를 더 쉽게 찾을 수 있어요.
            </p>

            <div className={styles.methodGrid}>
              <button
                className={`${styles.methodCard} ${method === 'gps' ? styles.methodCardActive : ''}`}
                onClick={() => setMethod('gps')}
              >
                <div className={styles.methodIcon}>📍</div>
                <div className={styles.methodName}>GPS 위치 인증</div>
                <div className={styles.methodDesc}>현재 위치가 해당 동네 반경 500m 이내인지 확인합니다.</div>
                <div className={styles.methodTag}>빠른 인증</div>
              </button>

              <button
                className={`${styles.methodCard} ${method === 'contract' ? styles.methodCardActive : ''}`}
                onClick={() => setMethod('contract')}
              >
                <div className={styles.methodIcon}>📋</div>
                <div className={styles.methodName}>계약 정보 인증</div>
                <div className={styles.methodDesc}>계약 날짜·금액·동호수 정보로 실거주를 확인합니다.</div>
                <div className={styles.methodTag}>집에서도 가능</div>
              </button>
            </div>

            <div className={styles.dongGroup}>
              <label className={styles.label}>인증할 동네 (행정동)</label>
              <input
                type="text"
                value={claimedDong}
                onChange={e => setClaimedDong(e.target.value)}
                placeholder="예: 성산동, 역삼동"
                className={styles.input}
                maxLength={20}
              />
            </div>

            <div className={styles.notice}>
              🔒 인증 정보는 서버에서만 처리되며, 개인 식별 정보는 저장하지 않습니다.
              인증 유효기간은 90일입니다.
            </div>

            <div className={styles.actions}>
              <button className={styles.btnCancel} onClick={onClose}>취소</button>
              <button
                className={styles.btnNext}
                onClick={() => setStep(method)}
                disabled={!claimedDong.trim()}
              >
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* ── GPS 인증 ── */}
        {step === 'gps' && (
          <div className={styles.body}>
            <div className={styles.stepHeader}>
              <button className={styles.btnBack} onClick={() => setStep('select_method')}>← 뒤로</button>
              <span className={styles.stepTitle}>GPS 위치 인증</span>
            </div>

            <div className={styles.gpsBox}>
              {gpsStatus === 'idle' && (
                <>
                  <div className={styles.gpsIcon}>📍</div>
                  <p className={styles.gpsDesc}>
                    <strong>{claimedDong}</strong>에 현재 위치하고 있다면<br />
                    아래 버튼을 눌러 위치를 확인해주세요.
                  </p>
                  <button className={styles.btnGps} onClick={getGPS}>
                    현재 위치 확인하기
                  </button>
                </>
              )}

              {gpsStatus === 'getting' && (
                <>
                  <div className={styles.gpsSpinner} />
                  <p className={styles.gpsDesc}>위치 정보를 가져오는 중...</p>
                </>
              )}

              {gpsStatus === 'done' && gpsCoords && (
                <>
                  <div className={styles.gpsIcon}>✅</div>
                  <p className={styles.gpsDesc}>
                    위치 확인 완료<br />
                    <span className={styles.gpsCoords}>
                      {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                    </span>
                  </p>
                  <p className={styles.gpsHint}>
                    "{claimedDong}" 동네에 현재 위치하고 있는지 서버에서 확인합니다.
                  </p>
                </>
              )}

              {gpsStatus === 'error' && (
                <>
                  <div className={styles.gpsIcon}>⚠️</div>
                  <p className={styles.gpsDesc}>
                    위치 정보를 가져올 수 없습니다.<br />
                    브라우저 위치 권한을 허용해주세요.
                  </p>
                  <button className={styles.btnGps} onClick={getGPS}>다시 시도</button>
                </>
              )}
            </div>

            <div className={styles.gpsNote}>
              💡 위치 정보는 인증에만 사용되며 서버에 저장되지 않습니다.
              실제 주거지에서 실행해주세요.
            </div>

            <div className={styles.actions}>
              <button className={styles.btnCancel} onClick={() => setStep('select_method')}>취소</button>
              <button
                className={styles.btnSubmit}
                onClick={submitGPS}
                disabled={gpsStatus !== 'done' || loading}
              >
                {loading ? '인증 확인 중...' : '인증하기'}
              </button>
            </div>
          </div>
        )}

        {/* ── 계약 정보 인증 ── */}
        {step === 'contract' && (
          <div className={styles.body}>
            <div className={styles.stepHeader}>
              <button className={styles.btnBack} onClick={() => setStep('select_method')}>← 뒤로</button>
              <span className={styles.stepTitle}>계약 정보 인증</span>
            </div>

            <div className={styles.contractInfo}>
              <p>
                <strong>{claimedDong}</strong>에서 거주 중이신 경우,<br />
                아래 계약 정보를 입력해주세요.
              </p>
              <p className={styles.contractNote}>
                입력하신 정보는 실거주 여부 확인 후 즉시 파기됩니다.
              </p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>계약 유형</label>
              <div className={styles.typeGrid}>
                {['전세', '매매', '월세'].map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.typeBtn} ${contractType === t ? styles.typeBtnActive : ''}`}
                    onClick={() => setContractType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>계약 날짜</label>
              <input
                type="date"
                value={contractDate}
                onChange={e => setContractDate(e.target.value)}
                className={styles.input}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>계약 금액 (만원)</label>
              <input
                type="text"
                value={contractAmount}
                onChange={e => setContractAmount(e.target.value.replace(/[^0-9,]/g, ''))}
                placeholder="예: 30000 (3억)"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>동/호수 (건물명 + 동/호)</label>
              <input
                type="text"
                value={contractDong}
                onChange={e => setContractDong(e.target.value)}
                placeholder="예: 래미안 101동 1201호"
                className={styles.input}
                maxLength={50}
              />
            </div>

            <div className={styles.phaseNotice}>
              📌 베타 서비스: 현재는 계약 정보 입력만으로 인증됩니다.
              향후 공공 부동산 데이터와 비교 검증 예정입니다.
            </div>

            <div className={styles.actions}>
              <button className={styles.btnCancel} onClick={() => setStep('select_method')}>취소</button>
              <button
                className={styles.btnSubmit}
                onClick={submitContract}
                disabled={!contractDate || !contractAmount || !contractDong || loading}
              >
                {loading ? '인증 확인 중...' : '인증하기'}
              </button>
            </div>
          </div>
        )}

        {/* ── 결과 ── */}
        {step === 'result' && result && (
          <div className={styles.body}>
            <div className={styles.resultBox}>
              <div className={styles.resultIcon}>{result.success ? '🏠' : '❌'}</div>
              <h4 className={`${styles.resultTitle} ${result.success ? styles.resultSuccess : styles.resultError}`}>
                {result.success ? '인증 완료!' : '인증 실패'}
              </h4>
              <p className={styles.resultMsg}>{result.message}</p>
              {result.success && (
                <div className={styles.resultBadge}>
                  🏠 인증 주민 배지가 커뮤니티 게시글과 댓글에 표시됩니다.
                </div>
              )}
            </div>
            <button className={styles.btnDone} onClick={onClose}>
              {result.success ? '커뮤니티로 돌아가기' : '닫기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
