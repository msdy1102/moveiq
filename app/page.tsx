'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import AuthButton from './components/AuthButton';

interface AnalysisResult {
  address: string;
  scores: { traffic: number; infra: number; school: number; noise: number; commerce: number; development: number; };
  total: number; grade: string; ai_comment: string;
  traffic_detail: string; infra_detail: string; school_detail: string;
  noise_detail: string; commerce_detail: string; development_detail: string;
  alternatives: { name: string; score: number; note: string }[];
  noise_times: { label: string; pct: number; note: string }[];
  // 확장 필드 (선택)
  reviews?:      { author: string; rating: number; text: string; date: string }[];
  jeonse_risk?:  { level: 'low'|'medium'|'high'; reason: string; checklist: string[] };
  school_info?:  { name: string; type: string; distance: string; rating: string; note: string }[];
}

// ── 예시 데이터 ──────────────────────────────────────────
const SAMPLE: AnalysisResult = {
  address: '마포구 성산동 일대 (예시)',
  scores: { traffic: 80, infra: 88, school: 62, noise: 45, commerce: 79, development: 72 },
  total: 75, grade: 'B+ (준수)',
  ai_comment: '교통·생활 편의는 우수하나 소음 환경과 학군 측면에서 개선 여지가 있습니다. 주말 저녁~새벽 유흥 소음이 집중되며, 인근 재개발 공사는 2027년 2월까지 예정되어 있습니다.',
  traffic_detail: '지하철 2·6호선 도보 10분 이내. 버스 정류장 8개. 강남까지 약 35분 소요. 교통 접근성 우수.',
  infra_detail: '반경 500m 내 편의점 6개, 병원·약국 12개, 카페 18개, 공원 2개. 생활 인프라 매우 풍부.',
  school_detail: '배정 초등학교 1개(도보 8분), 중학교 배정 예측 2곳, 학원가 밀집(수학·영어 중심).',
  noise_detail: '주중 낮은 비교적 조용하나 주말 저녁~새벽 유흥 소음이 집중됩니다. 재택근무자·영유아 가정 주의 필요.',
  commerce_detail: '유동인구 구 평균 대비 +22%, 음식점·카페 중심 업종, 공실률 7%(안정적).',
  development_detail: '2027년 재개발 구역 인접. 주변 재건축 단지 호재 예정. 장기 보유 시 가치 상승 기대.',
  alternatives: [
    { name: '연남동', score: 78, note: '학군 +15점, 임대료 +12%' },
    { name: '공덕동', score: 77, note: '교통 +8점, 소음 -10점' },
    { name: '마포동', score: 74, note: '소음 -15점, 개발 +10점' },
  ],
  noise_times: [
    { label: '새벽 00-06시', pct: 80, note: '유흥 퇴장 집중' },
    { label: '오전 06-12시', pct: 30, note: '비교적 조용' },
    { label: '오후 12-18시', pct: 40, note: '공사 소음(평일)' },
    { label: '저녁 18-24시', pct: 90, note: '유흥 최고조' },
  ],
};

// ── 푸터 모달 콘텐츠 ──────────────────────────────────────
const PAGES: Record<string, { title: string; body: string }> = {
  '서비스 소개': {
    title: '서비스 소개',
    body: `무브IQ는 소음 크라우드 지도와 AI 입지 분석을 결합한 이사 결정 플랫폼입니다.

■ 핵심 기능
• 소음 크라우드 지도: 층간·공사·유흥·교통 소음 시간대별 확인
• AI 입지 분석: 교통·학군·인프라·소음·상권·개발 6개 레이어 종합 분석
• 스마트 알림: 관심 주소 소음 변화·공사 허가·개발 계획 실시간 알림

■ 시장 배경
• 연간 이사 가구: 800만 가구 (국토부, 2024)
• 이사 후 입지 후회율: 42%
• 연간 층간소음 민원: 40만 건 이상

■ 운영 문의
admin@moveiq.co.kr`,
  },
  '개인정보처리방침': {
    title: '개인정보처리방침',
    body: `무브IQ는 이용자의 개인정보를 중요시하며 개인정보보호법을 준수합니다.

■ 수집하는 개인정보
• 소음 제보 시: 제보 위치(50m 반경 랜덤화 처리), IP 주소(어뷰징 방지)
• 회원가입 시(예정): 이메일, 닉네임

■ 개인정보 이용 목적
• 소음 제보 데이터 지도 표시
• 어뷰징·허위 제보 방지
• 서비스 개선 및 통계 분석

■ 개인정보 보유 및 파기
• 소음 제보: 제보일로부터 90일 후 자동 삭제
• 회원 탈퇴 시: 즉시 파기

■ 위치정보 처리
제보된 위치는 반경 50m 랜덤화 처리 후 저장됩니다. 정확한 위치는 저장되지 않습니다.

문의: admin@moveiq.co.kr`,
  },
  '이용약관': {
    title: '이용약관',
    body: `■ 제1조 (목적)
본 약관은 무브IQ(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정합니다.

■ 제2조 (서비스 제공)
서비스는 소음 크라우드 지도, AI 입지 분석 정보를 제공합니다. 제공되는 정보는 참고용이며, 최종 이사 결정의 책임은 이용자에게 있습니다.

■ 제3조 (이용자 의무)
• 허위 소음 제보 금지
• 타인의 권리 침해 금지
• 서비스 정상 운영 방해 금지

■ 제4조 (면책조항)
서비스가 제공하는 분석 결과는 AI 및 크라우드 데이터 기반으로 100% 정확성을 보장하지 않습니다. 부동산 계약 시 전문가 상담을 병행하시기 바랍니다.

■ 제5조 (준거법)
본 약관은 대한민국 법령에 따라 해석됩니다.

문의: admin@moveiq.co.kr`,
  },
  '공지사항': {
    title: '공지사항',
    body: `■ [2025.03] 무브IQ 베타 서비스 오픈

안녕하세요, 무브IQ팀입니다.

소음 크라우드 지도 × AI 입지 분석 플랫폼 무브IQ가 베타 서비스를 시작합니다.

▶ 베타 기간 중 무료 제공
• 소음 지도 열람 및 제보 무제한
• AI 입지 분석 일 3회
• 6개 레이어 기본 분석

▶ 순차 오픈 예정
• PDF 리포트 저장
• 실시간 알림 서비스
• 유료 요금제 (이사 플랜 / 월정액 / 프리미엄)

서비스 이용 중 불편 사항이나 개선 의견은 admin@moveiq.co.kr 로 보내주세요.

감사합니다. 무브IQ팀 드림`,
  },
};

// 필터 칩 라벨 → noise_type 매핑
const FILTER_TYPE_MAP: Record<string, string> = {
  '🏗️ 공사':  'construction',
  '🎵 유흥':  'entertainment',
  '🏠 층간':  'floor',
  '🚗 교통':  'traffic',
  '🐕 기타':  'other',
};
const TIME_SLOTS = ['dawn','morning','afternoon','evening','night'];

// ── 소음 유형별 핀 설정 ─────────────────────────────────
const PIN_CONFIG: Record<string, { icon: string; color: string }> = {
  construction:  { icon: '🏗️', color: '#8B6914' },
  entertainment: { icon: '🎵', color: '#111111' },
  floor:         { icon: '🏠', color: '#646F4B' },
  traffic:       { icon: '🚗', color: '#2563EB' },
  other:         { icon: '🐕', color: '#6B7280' },
};

// ── Naver Map 컴포넌트 ────────────────────────────────────
function NaverMap({
  lat, lng, loading, onCenterChange, onMapClick,
  activeFilters, timeSlot, onPinsLoaded, showHeat, osmPins,
}: {
  lat: number; lng: number; loading: boolean;
  onCenterChange?: (lat: number, lng: number) => void;
  onMapClick?:     (lat: number, lng: number) => void;
  activeFilters?:  string[];    // 활성 noise_type 목록
  timeSlot?:       string;      // 시간대 필터 (dawn|morning|afternoon|evening|night|all)
  onPinsLoaded?:   () => void;  // 핀 로드 완료 콜백
  showHeat?:       boolean;     // 히트맵 모드
  osmPins?:        { lat: number; lng: number; osm_type: string; name: string }[];
}) {
  const mapRef      = useRef<any>(null);
  const clickPinRef = useRef<any>(null); // 클릭 위치 임시 핀
  const pinsRef     = useRef<any[]>([]);  // 소음 핀 목록 (필터링용)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_NAVER_MAP_KEY;
    if (!key || loading) return;

    // [BUG FIX 4] 인증 실패 전역 콜백 등록 — SDK 로드 전에 등록해야 동작함
    (window as any).navermap_authFailure = () => {
      const el = document.getElementById('naverMapEl');
      if (el) el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#f5f7f3;gap:12px;padding:24px;text-align:center;">
          <span style="font-size:40px">🗺️</span>
          <div style="font-size:14px;font-weight:700;color:#111">지도 API 인증 실패</div>
          <div style="font-size:12px;color:#6b7260;line-height:1.7">
            Naver Cloud Console에서<br/>
            <b>Dynamic Map</b> 서비스를 선택하고<br/>
            <b>https://moveiq.vercel.app</b> 을 Web 서비스 URL에 등록하세요.<br/><br/>
            <a href="https://console.ncloud.com" target="_blank" style="color:#646F4B;font-weight:700;text-decoration:underline">콘솔 바로가기 →</a>
          </div>
        </div>`;
    };

    // DOM 마운트 완료 후 실행 보장
    const initMap = () => {
      // setTimeout으로 React 렌더링 사이클 후 DOM 접근 보장
      setTimeout(() => {
        const el = document.getElementById('naverMapEl');
        if (!el) return;
        const n = (window as any).naver;
        if (!n?.maps) return;

        // 이미 지도가 생성된 경우 중심만 이동
        if (mapRef.current) {
          mapRef.current.setCenter(new n.maps.LatLng(lat, lng));
          // [BUG FIX 3] refresh()는 Naver Maps API에 없는 메서드 — Event.trigger('resize')로 교체
          n.maps.Event.trigger(mapRef.current, 'resize');
          return;
        }

        const map = new n.maps.Map(el, {
          center: new n.maps.LatLng(lat, lng),
          zoom: 15,
        });
        mapRef.current = map;

        // ── 위치 핀 생성 함수 (초기 진입 + 클릭 공통 사용) ──────
        const ACTIVE_PIN_HTML = `<div style="
          width:24px;height:24px;
          background:#646F4B;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:3px solid #fff;
          box-shadow:0 3px 10px rgba(0,0,0,.35);
        "></div>`;

        // 초기 위치 핀 표시 (클릭 핀과 동일 스타일)
        clickPinRef.current = new n.maps.Marker({
          map,
          position: new n.maps.LatLng(lat, lng),
          icon: { content: ACTIVE_PIN_HTML, anchor: new n.maps.Point(12, 24) },
          zIndex: 200,
        });

        // 지도 이동 완료 시 중심 좌표를 부모로 전달
        n.maps.Event.addListener(map, 'idle', () => {
          const center = map.getCenter();
          onCenterChange?.(center.lat(), center.lng());
        });

        // 지도 클릭 → 핀 이동 + 부모로 좌표 전달
        n.maps.Event.addListener(map, 'click', (e: any) => {
          const clickLat = e.coord.lat();
          const clickLng = e.coord.lng();

          // 기존 핀 위치 이동 (제거 후 재생성)
          if (clickPinRef.current) clickPinRef.current.setMap(null);
          clickPinRef.current = new n.maps.Marker({
            map,
            position: new n.maps.LatLng(clickLat, clickLng),
            icon: { content: ACTIVE_PIN_HTML, anchor: new n.maps.Point(12, 24) },
            zIndex: 200,
          });

          onMapClick?.(clickLat, clickLng);
        });

        // DB 소음 핀 로드 (핀 목록을 pinsRef에 보관)
        loadNoisePins(map, lat, lng, n, pinsRef, onPinsLoaded);
      }, 100);
    };

    // SDK 이미 로드된 경우 바로 실행
    if ((window as any).naver?.maps) {
      initMap();
      return;
    }

    // [BUG FIX 2] 이미 삽입된 SDK 스크립트 대기 — id 'naver-sdk' 단일화
    if (document.getElementById('naver-sdk')) {
      const wait = setInterval(() => {
        if ((window as any).naver?.maps) {
          clearInterval(wait);
          initMap();
        }
      }, 100);
      setTimeout(() => clearInterval(wait), 15000);
      return;
    }

    // [BUG FIX 1] SDK 최초 로드 — 올바른 NCP 도메인(oapi.map.naver.com) 단독 사용
    // openapi.map.naver.com 은 구 네이버 개발자센터 URL로 NCP 키 인증 불가
    const s = document.createElement('script');
    s.id  = 'naver-sdk';
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${key}&submodules=visualization`;
    s.onload = initMap;
    s.onerror = () => {
      // 스크립트 로드 자체 실패 시 오류 UI 표시 (네트워크 문제 등)
      const el = document.getElementById('naverMapEl');
      if (el) el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#f5f7f3;gap:12px;padding:24px;text-align:center;">
          <span style="font-size:40px">🗺️</span>
          <div style="font-size:14px;font-weight:700;color:#111">지도를 불러올 수 없습니다</div>
          <div style="font-size:12px;color:#6b7260;line-height:1.7">
            네트워크 상태를 확인하거나<br/>잠시 후 다시 시도해 주세요.
          </div>
        </div>`;
    };
    document.head.appendChild(s);
  }, [lat, lng, loading]);

  // ── 필터/시간대 변경 시 핀 show/hide ────────────────────
  useEffect(() => {
    if (!pinsRef.current.length) return;
    const n = (window as any).naver;
    if (!n?.maps || !mapRef.current) return;

    pinsRef.current.forEach(({ marker, noise_type, time_slot }) => {
      const typeOk = !activeFilters?.length || activeFilters.includes(noise_type);
      const timeOk = !timeSlot || timeSlot === 'all' || time_slot === timeSlot;
      marker.setMap(typeOk && timeOk ? mapRef.current : null);
    });
  }, [activeFilters, timeSlot]);

  // ── 히트맵 렌더링 ─────────────────────────────────────────
  const heatmapRef = useRef<any>(null);
  useEffect(() => {
    const n = (window as any).naver;
    if (!n?.maps || !mapRef.current) return;

    if (showHeat) {
      // 히트맵 모드: 크라우드 핀 + OSM 핀 모두 숨김
      pinsRef.current.forEach(({ marker }) => marker.setMap(null));
      osmPinMarkersRef.current.forEach(m => m.setMap(null));

      // 히트맵 데이터 포인트 수집
      const points = [
        // 크라우드 제보 핀
        ...pinsRef.current.map(({ marker }) => {
          const pos = marker.getPosition();
          return new n.maps.LatLng(pos.lat(), pos.lng());
        }),
        // OSM 공공 핀
        ...(osmPins ?? []).map(p => new n.maps.LatLng(p.lat, p.lng)),
      ];

      if (points.length === 0) {
        // 데이터 없을 때 기존 히트맵 제거
        if (heatmapRef.current) { heatmapRef.current.setMap(null); heatmapRef.current = null; }
        return;
      }

      // 기존 히트맵 제거 후 새로 생성
      if (heatmapRef.current) heatmapRef.current.setMap(null);
      heatmapRef.current = new n.maps.visualization.HeatMap({
        map: mapRef.current,
        data: points,
        radius: 30,
        opacity: 0.7,
        gradient: ['rgba(191,210,191,0)', 'rgba(100,111,75,0.6)', '#646F4B', '#111'],
      });
    } else {
      // 핀 모드: 히트맵 제거 + 핀 복원
      if (heatmapRef.current) { heatmapRef.current.setMap(null); heatmapRef.current = null; }

      // 필터 조건에 맞는 크라우드 핀 복원
      pinsRef.current.forEach(({ marker, noise_type, time_slot }) => {
        const typeOk = !activeFilters?.length || activeFilters.includes(noise_type);
        const timeOk = !timeSlot || timeSlot === 'all' || time_slot === timeSlot;
        marker.setMap(typeOk && timeOk ? mapRef.current : null);
      });
      // OSM 핀 복원
      osmPinMarkersRef.current.forEach(m => m.setMap(mapRef.current));
    }
  }, [showHeat, osmPins]);

  // ── OSM 공공 핀 렌더링 (유흥업소·공사현장) ────────────────
  const osmPinMarkersRef = useRef<any[]>([]);
  useEffect(() => {
    const n = (window as any).naver;
    if (!n?.maps || !mapRef.current || !osmPins?.length) {
      // 기존 OSM 핀 모두 제거
      osmPinMarkersRef.current.forEach(m => m.setMap(null));
      osmPinMarkersRef.current = [];
      return;
    }

    // 기존 OSM 핀 제거
    osmPinMarkersRef.current.forEach(m => m.setMap(null));
    osmPinMarkersRef.current = [];

    // 필터 적용: activeFilters가 있으면 해당 타입만 표시
    const visiblePins = osmPins.filter(pin => {
      if (!activeFilters?.length) return true;
      return activeFilters.includes(pin.osm_type);
    });

    visiblePins.forEach(pin => {
      const isEntertainment = pin.osm_type === 'entertainment';
      // OSM 핀은 크라우드 핀과 구분: 반투명 + 별표(★) 아이콘
      const color = isEntertainment ? '#111111' : '#8B6914';
      const icon  = isEntertainment ? '🎵' : '🏗️';
      const size  = 20;

      const html = `
        <div style="
          background:${color};
          opacity:0.65;
          width:${size}px; height:${size}px;
          border-radius:4px;
          display:flex; align-items:center; justify-content:center;
          font-size:${size * 0.6}px;
          box-shadow:0 1px 4px rgba(0,0,0,.2);
          border:1.5px dashed rgba(255,255,255,.7);
          cursor:pointer;
        ">${icon}</div>`;

      const marker = new n.maps.Marker({
        map: mapRef.current,
        position: new n.maps.LatLng(pin.lat, pin.lng),
        icon: { content: html, anchor: new n.maps.Point(size / 2, size / 2) },
        zIndex: 50, // 크라우드 핀(zIndex 기본)보다 뒤에
      });

      // 클릭 시 정보창
      const typeLabel = isEntertainment ? '유흥업소 (OSM)' : '공사 현장 (OSM)';
      const infoContent = `
        <div style="padding:8px 12px;font-family:'Noto Sans KR',sans-serif;min-width:130px;">
          <div style="font-weight:700;font-size:12px;margin-bottom:3px;">${icon} ${pin.name}</div>
          <div style="font-size:10px;color:#6b7260;">${typeLabel}</div>
          <div style="font-size:9px;color:#aaa;margin-top:3px;">OpenStreetMap 공공 데이터</div>
        </div>`;

      const infoWindow = new n.maps.InfoWindow({
        content: infoContent,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(100,111,75,0.2)',
        disableAnchor: false,
      });

      n.maps.Event.addListener(marker, 'click', () => {
        if (infoWindow.getMap()) infoWindow.close();
        else infoWindow.open(mapRef.current, marker);
      });

      osmPinMarkersRef.current.push(marker);
    });
  }, [osmPins, activeFilters]);

  if (loading) return (
    <div className={styles.mapPlaceholder}>
      <span style={{ fontSize: 32 }}>📍</span>
      <span>현재 위치 확인 중...</span>
    </div>
  );
  return <div id="naverMapEl" className={styles.kakaoMapEl} />;
}

// ── DB 소음 핀 로드 함수 ─────────────────────────────────
// pinsRef: 핀 목록 저장 ref (필터/시간대 변경 시 재사용)
// onPinsLoaded: 로드 완료 콜백 (제보 후 갱신용)
async function loadNoisePins(
  map: any, lat: number, lng: number, n: any,
  pinsRef?: React.MutableRefObject<any[]>,
  onPinsLoaded?: () => void,
) {
  try {
    const res  = await fetch(`/api/noise-reports?lat=${lat}&lng=${lng}`);
    const json = await res.json();

    // 기존 핀 모두 제거
    if (pinsRef?.current) {
      pinsRef.current.forEach((p: any) => p.marker?.setMap(null));
      pinsRef.current = [];
    }

    if (!json.success || !json.data?.length) {
      onPinsLoaded?.();
      return;
    }

    const timeLabel: Record<string, string> = {
      dawn: '새벽', morning: '오전', afternoon: '오후', evening: '저녁', night: '심야',
    };
    const typeLabel: Record<string, string> = {
      construction: '공사 소음', entertainment: '유흥 소음',
      floor: '층간소음', traffic: '교통 소음', other: '기타 소음',
    };

    json.data.forEach((report: {
      id: string; noise_type: string; time_slot: string;
      severity: number; lat: number; lng: number; created_at: string;
    }) => {
      const cfg  = PIN_CONFIG[report.noise_type] ?? PIN_CONFIG.other;
      const size = 24 + report.severity * 2;

      const html = `
        <div style="
          background:${cfg.color};
          width:${size}px; height:${size}px;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          display:flex; align-items:center; justify-content:center;
          font-size:${size * 0.45}px;
          box-shadow:0 2px 8px rgba(0,0,0,.25);
          border:2px solid rgba(255,255,255,.8);
          cursor:pointer;
        ">
          <span style="transform:rotate(45deg)">${cfg.icon}</span>
        </div>`;

      const marker = new n.maps.Marker({
        map,
        position: new n.maps.LatLng(report.lat, report.lng),
        icon: { content: html, anchor: new n.maps.Point(size / 2, size) },
      });

      const infoContent = `
        <div style="padding:10px 14px;font-family:'Noto Sans KR',sans-serif;min-width:140px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${cfg.icon} ${typeLabel[report.noise_type] ?? '소음'}</div>
          <div style="font-size:11px;color:#6b7260;">발생 시간대: ${timeLabel[report.time_slot] ?? ''}</div>
          <div style="font-size:11px;color:#6b7260;">심각도: ${'★'.repeat(report.severity)}${'☆'.repeat(5 - report.severity)}</div>
          <div style="font-size:10px;color:#aaa;margin-top:4px;">${new Date(report.created_at).toLocaleDateString('ko-KR')}</div>
        </div>`;

      const infoWindow = new n.maps.InfoWindow({
        content: infoContent,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(100,111,75,0.2)',
        disableAnchor: false,
      });

      n.maps.Event.addListener(marker, 'click', () => {
        if (infoWindow.getMap()) { infoWindow.close(); }
        else { infoWindow.open(map, marker); }
      });

      // 핀 데이터를 ref에 저장 (필터링 시 show/hide용)
      if (pinsRef?.current) {
        pinsRef.current.push({
          marker,
          noise_type: report.noise_type,
          time_slot:  report.time_slot,
        });
      }
    });

    onPinsLoaded?.();
  } catch (err) {
    console.error('소음 핀 로드 실패:', err);
    onPinsLoaded?.();
  }
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function HomePage() {
  const [tab,          setTab]          = useState<'search'|'noise'>('search');
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [step,         setStep]         = useState(0);
  const [result,       setResult]       = useState<AnalysisResult|null>(null);
  const [rTab,         setRTab]         = useState('overview');
  const [reportOpen,   setReportOpen]   = useState(false);
  const [reportOk,     setReportOk]     = useState(false);
  const [pageModal,    setPageModal]    = useState<string|null>(null);
  const [mapView,           setMapView]           = useState<'pin'|'heat'>('pin');
  const [userLat,           setUserLat]           = useState<number|null>(null);
  const [userLng,           setUserLng]           = useState<number|null>(null);
  const [locLoading,        setLocLoading]        = useState(false);
  const [noiseSearchInput,  setNoiseSearchInput]  = useState('');
  const [noiseStats,        setNoiseStats]        = useState<Record<string,number> | null>(null);
  const [statsLoading,      setStatsLoading]      = useState(false);
  // 지도 현재 중심 좌표 (드래그/줌 후 idle 이벤트로 업데이트)
  const [mapCenter,         setMapCenter]         = useState<{lat:number;lng:number}|null>(null);
  // 역지오코딩 진행 중 여부 (지도 클릭 시 입력창 로딩 표시)
  const [reverseGeocoding,  setReverseGeocoding]  = useState(false);
  // 필터 칩 상태 (빈 배열 = 전체 표시)
  const [activeFilters,     setActiveFilters]     = useState<string[]>([]);
  // 시간대 슬라이더 (0=새벽, 1=오전, 2=오후, 3=저녁, 4=심야, -1=전체)
  const [timeSlotIdx,       setTimeSlotIdx]       = useState(-1);
  // 핀 재로드 트리거 (제보 완료 후 증가)
  const [pinReloadKey,      setPinReloadKey]      = useState(0);
  // 소음 제보 위치 — 지도 클릭 시 해당 좌표, 미클릭 시 현재 위치(userLat/Lng)
  const [reportLat,         setReportLat]         = useState<number|null>(null);
  const [reportLng,         setReportLng]         = useState<number|null>(null);
  // OSM 공공 데이터 핀 목록 (유흥업소·공사현장 좌표)
  const [osmPins,           setOsmPins]           = useState<{lat:number;lng:number;osm_type:string;name:string}[]>([]);
  // 세션 ID (익명 사용자 식별 — localStorage 영구 저장)
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const existing = localStorage.getItem('moveiq_session_id');
    if (existing) return existing;
    const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem('moveiq_session_id', newId);
    return newId;
  });

  // 내가 찾아본 지역 (입지 분석 검색 히스토리)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  // 소음 알림: 관심 주소 목록
  const [watchedAddresses,  setWatchedAddresses]  = useState<{address:string;lat:number;lng:number}[]>([]);
  const [alertOpen,         setAlertOpen]         = useState(false);
  const [notifPermission,   setNotifPermission]   = useState<NotificationPermission>('default');

  // ── DB 환경설정 로드/저장 ──────────────────────────────
  // sessionId가 준비되면 DB에서 불러오기
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/user-preferences?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          if (json.search_history?.length)  setRecentSearches(json.search_history);
          if (json.community_dongs?.length) {
            // 커뮤니티 동네 목록은 community page에서 별도 관리
          }
        }
      })
      .catch(() => {
        // 실패 시 localStorage 폴백
        try {
          const h = JSON.parse(localStorage.getItem('moveiq_history') ?? '[]');
          if (h.length) setRecentSearches(h);
        } catch {}
      });
  }, [sessionId]);

  // 검색 히스토리 DB 저장 헬퍼
  async function saveSearchHistory(history: string[]) {
    if (!sessionId) return;
    // localStorage 동기 백업
    localStorage.setItem('moveiq_history', JSON.stringify(history));
    // DB 비동기 저장 (실패해도 UX 무관)
    fetch('/api/user-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, search_history: history }),
    }).catch(() => {});
  }

  const STEPS = ['교통 데이터 수집 중...','생활 시설 분석 중...','소음 데이터 연동 중...','AI 종합 평가 생성 중...'];

  // 소음 현황 통계 로드 (크라우드 제보 DB + OSM Overpass 공공 데이터)
  async function loadNoiseStats(lat: number, lng: number) {
    setStatsLoading(true);
    try {
      const [noiseRes, osmRes] = await Promise.all([
        fetch(`/api/noise-reports?lat=${lat}&lng=${lng}`),
        fetch(`/api/cals-construction?lat=${lat}&lng=${lng}`),
      ]);

      const noiseJson = await noiseRes.json();
      const osmJson   = await osmRes.json().catch(() => ({
        success: false, count: 0, entertainment: 0, traffic: false, pins: [],
      }));

      const counts: Record<string, number> = {
        entertainment: 0,
        construction:  0,
        traffic:       0,
        floor:         0,
        other:         0,
      };

      // 크라우드 제보 카운팅 (Supabase DB)
      if (noiseJson.success && noiseJson.data) {
        noiseJson.data.forEach((r: { noise_type: string }) => {
          if (r.noise_type in counts) counts[r.noise_type]++;
        });
      }

      // OSM 공사 건수 — 실제 개수 그대로 (÷5 없음)
      if (osmJson.success && osmJson.count > 0) {
        counts.construction += osmJson.count;
      }

      // OSM 유흥업소 수 — 실제 개수 그대로 (÷5 없음)
      if (osmJson.success && osmJson.entertainment > 0) {
        counts.entertainment += osmJson.entertainment;
      }

      // OSM 간선도로 근접 → 교통 소음 1건
      if (osmJson.success && osmJson.traffic) {
        counts.traffic += 1;
      }

      // OSM 핀 좌표 목록 저장 → 지도에 표시
      if (osmJson.success && osmJson.pins?.length) {
        setOsmPins(osmJson.pins);
      } else {
        setOsmPins([]);
      }

      setNoiseStats({ ...counts });
      // 소음 알림 체크 (관심 주소 등록된 경우)
      checkAlerts(lat, lng, counts);
    } catch {
      // 실패 시 빈 상태 유지
    } finally {
      setStatsLoading(false);
    }
  }

  // ── 소음 알림 함수들 ────────────────────────────────────
  // 알림 권한 요청
  async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }

  // 관심 주소 등록
  function addWatchedAddress() {
    if (!noiseSearchInput.trim() || userLat == null || userLng == null) return;
    const entry = { address: noiseSearchInput.trim(), lat: userLat, lng: userLng };
    const next  = [...watchedAddresses.filter(w => w.address !== entry.address), entry];
    setWatchedAddresses(next);
    // localStorage 백업 + DB 저장
    localStorage.setItem('moveiq_watched', JSON.stringify(next));
    if (sessionId) {
      fetch('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, watched_addresses: next }),
      }).catch(() => {});
    }
  }

  // 관심 주소 삭제
  function removeWatchedAddress(address: string) {
    const next = watchedAddresses.filter(w => w.address !== address);
    setWatchedAddresses(next);
    localStorage.setItem('moveiq_watched', JSON.stringify(next));
    if (sessionId) {
      fetch('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, watched_addresses: next }),
      }).catch(() => {});
    }
  }

  // 관심 주소 알림 체크 (소음 현황 로드 후 호출)
  async function checkAlerts(lat: number, lng: number, newStats: Record<string, number>) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const total = Object.values(newStats).reduce((a, b) => a + b, 0);
    if (total > 0) {
      const prevKey = `moveiq_alert_${lat.toFixed(3)}_${lng.toFixed(3)}`;
      const prevTotal = Number(localStorage.getItem(prevKey) ?? 0);
      if (total > prevTotal) {
        new Notification('🔊 무브IQ 소음 알림', {
          body: `관심 지역에 새 소음 데이터가 ${total}건 감지됐습니다.`,
          icon: '/favicon.ico',
        });
        localStorage.setItem(prevKey, String(total));
      }
    }
  }

  // 지도 클릭 핸들러 — 역지오코딩 → 주소 자동 입력 + 소음 통계 즉시 검색
  async function handleMapClick(clickLat: number, clickLng: number) {
    // 클릭 위치를 제보 좌표 + 검색 좌표로 즉시 저장
    setReportLat(clickLat);
    setReportLng(clickLng);
    setUserLat(clickLat);
    setUserLng(clickLng);
    setReverseGeocoding(true);

    // 소음 통계 즉시 재로드 (역지오코딩 완료 전에도 검색 시작)
    loadNoiseStats(clickLat, clickLng);

    try {
      const res  = await fetch(`/api/geocode?lat=${clickLat}&lng=${clickLng}`);
      const json = await res.json();
      // 주소 입력창 자동 채움 (성공 시에만)
      if (json.success && json.roadAddress) {
        setNoiseSearchInput(json.roadAddress);
      }
    } catch {
      // 역지오코딩 실패해도 소음 통계는 이미 로드 시작됨
    } finally {
      setReverseGeocoding(false);
    }
  }

  // 소음지도 탭: 위치 요청 (항상 새로 요청)
  function goNoise() {
    setTab('noise');
    setLocLoading(true);
    navigator.geolocation?.getCurrentPosition(
      p => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        setLocLoading(false);
        loadNoiseStats(lat, lng);
      },
      () => {
        setUserLat(37.5665);
        setUserLng(126.9780);
        setLocLoading(false);
        loadNoiseStats(37.5665, 126.9780);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  // 소음 지도 주소 검색 (Naver Geocoding — 서버 API Route 경유)
  async function searchNoiseLocation() {
    const addr = noiseSearchInput.trim();
    if (!addr) return;
    setLocLoading(true);
    try {
      const res  = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`);
      const json = await res.json();
      if (json.lat && json.lng) {
        setUserLat(json.lat);
        setUserLng(json.lng);
        loadNoiseStats(json.lat, json.lng);
      } else {
        alert('주소를 찾을 수 없습니다. 다시 확인해 주세요.');
      }
    } catch {
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setLocLoading(false);
    }
  }

  async function runAnalysis(addr?: string) {
    const address = addr ?? input.trim();
    if (!address) return;
    setInput(address);
    setResult(null);
    // 검색 히스토리 저장 (최대 8개, 중복 제거, 최신순)
    setRecentSearches(prev => {
      const next = [address, ...prev.filter(a => a !== address)].slice(0, 8);
      saveSearchHistory(next);
      return next;
    });
    setLoading(true);
    setStep(0);
    const iv = setInterval(() => setStep(s => s >= STEPS.length-1 ? s : s+1), 700);
    try {
      const res = await fetch('/api/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ address }) });
      const json = await res.json();
      clearInterval(iv);
      if (json.success) { setResult(json.data); setRTab('overview'); }
      else alert(json.message ?? '분석에 실패했습니다.');
    } catch { clearInterval(iv); alert('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  }

  async function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      // 제보 위치: 지도 클릭 위치 우선 → 없으면 현재 위치 → 없으면 서울 기본값
      const submitLat = reportLat ?? userLat ?? 37.5665;
      const submitLng = reportLng ?? userLng ?? 126.9780;
      const res = await fetch('/api/noise-reports', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ noise_type: d.get('noise_type'), time_slot: d.get('time_slot'),
          severity: Number(d.get('severity')), lat: submitLat, lng: submitLng, description: d.get('description') }) });
      const json = await res.json();
      if (json.success) {
        setReportOk(true);
        // 제보 완료 → 핀 재로드 + 소음 현황 갱신
        setPinReloadKey(k => k + 1);
        loadNoiseStats(submitLat, submitLng);
      } else alert(json.message);
    } catch { alert('제보 저장에 실패했습니다.'); }
  }

  const sc = (s: number) => s >= 80 ? 'var(--main)' : s >= 60 ? '#BFD2BF' : '#111111';
  const D  = result ?? SAMPLE;
  const LAYERS = [
    { icon:'🚇', name:'교통 접근성', score: D.scores.traffic,     detail: D.traffic_detail },
    { icon:'🏪', name:'생활 인프라', score: D.scores.infra,       detail: D.infra_detail },
    { icon:'📚', name:'학군 환경',   score: D.scores.school,      detail: D.school_detail },
    { icon:'🔊', name:'소음·환경',   score: D.scores.noise,       detail: D.noise_detail },
    { icon:'🛍️', name:'상권 활성도', score: D.scores.commerce,    detail: D.commerce_detail },
    { icon:'🏗️', name:'개발 잠재력', score: D.scores.development, detail: D.development_detail },
  ];

  return (
    <>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <a className={styles.logo} href="/"><div className={styles.logoMark}>📍</div><span className={styles.logoText}>무브IQ</span></a>
        <div className={styles.headerSearch}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runAnalysis()} placeholder="주소 검색 (예: 마포구 성산동)" />
          <button onClick={()=>runAnalysis()}>→</button>
        </div>
        {/* 5. 헤더 탭 버튼 제거 */}
        <AuthButton />
      </header>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg}/>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>실시간 소음 크라우드 × AI 입지 분석</div>
          <h1>이 동네,<br/><span>살아도 될까요?</span></h1>
          <p>소음부터 학군·상권·개발계획까지 — 이사 결정에 필요한 모든 데이터를 한 화면에서</p>
          <div className={styles.heroCtas}>
            <div className={`${styles.ctaCard} ${styles.primary}`} onClick={()=>{setTab('search');setTimeout(()=>document.getElementById('mainInput')?.focus(),100);}}>
              <div className={styles.ctaIcon}>🏙️</div>
              <div className={styles.ctaTitle}>이 주소 입지 분석하기</div>
              <div className={styles.ctaDesc}>6개 레이어 AI 종합 분석</div>
              <span className={styles.ctaBadge}>PDF 리포트 저장 가능</span>
            </div>
            <div className={styles.ctaCard} onClick={goNoise}>
              <div className={styles.ctaIcon}>🔊</div>
              <div className={styles.ctaTitle}>소음 지도 보기</div>
              <div className={styles.ctaDesc}>크라우드 소음 제보를 시간대별로 확인</div>
            </div>
            <div className={styles.ctaCard} onClick={()=>window.location.href='/community'}>
              <div className={styles.ctaIcon}>💬</div>
              <div className={styles.ctaTitle}>소통하기</div>
              <div className={styles.ctaDesc}>동네 주민과 이사 정보 나누기</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── APP ── */}
      <div className={styles.app}>

        {/* ── 입지 분석 탭: 전체 너비 중앙 레이아웃 ── */}
        {tab==='search' && (
          <div className={styles.analysisPage}>
            <div className={styles.analysisInner}>
              {/* 검색 */}
              <div className={styles.searchRowCenter}>
                <input id="mainInput" className={styles.bigInputCenter} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runAnalysis()} placeholder="예: 마포구 성산동, 강남구 역삼동"/>
                <button className={styles.btnAnalyze} onClick={()=>runAnalysis()}>분석</button>
              </div>
              <div className={styles.quickChips}>
                <span>추천:</span>
                {['마포구 성산동','강남구 역삼동','용산구 이태원동','송파구 잠실동','서대문구 연희동'].map(a=>(
                  <button key={a} className={styles.chip} onClick={()=>runAnalysis(a)}>{a}</button>
                ))}
              </div>
              {recentSearches.length > 0 && (
                <div className={styles.recentSearches}>
                  <span className={styles.recentLabel}>내가 찾아본 지역:</span>
                  {recentSearches.map(a=>(
                    <button key={a} className={`${styles.chip} ${styles.chipRecent}`} onClick={()=>runAnalysis(a)}>
                      🕐 {a}
                    </button>
                  ))}
                  <button
                    className={styles.chipClear}
                    onClick={()=>{ setRecentSearches([]); localStorage.removeItem('moveiq_history'); }}
                  >지우기</button>
                </div>
              )}

              {/* 로딩 */}
              {loading && (
                <div className={styles.loadingBox}>
                  <div className={styles.spinner}/>
                  <div className={styles.loadingSteps}>
                    {STEPS.map((s,i)=>(
                      <div key={i} className={`${styles.lstep} ${i<step?styles.done:''} ${i===step?styles.active:''}`}>
                        <span>{i<step?'✓':i===step?'⏳':'·'}</span>{s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 결과 */}
              {!loading && (
                <div className={styles.resultBoxCenter}>
                  {!result && (
                    <div className={styles.sampleBadge}>
                      📋 예시 데이터 — 주소를 입력하면 실제 AI 분석 결과가 표시됩니다
                    </div>
                  )}
                  <div className={styles.resultHeader}>
                    <div className={styles.resultAddr}>📍 {D.address}</div>
                    <div className={styles.scoreBadge}>
                      <span className={styles.scoreBig}>{D.total}</span>
                      <span className={styles.scoreGrade}>{D.grade}</span>
                    </div>
                  </div>
                  <div className={styles.resultTabs}>
                    {['overview','traffic','infra','school','noise','commerce','dev','review','jeonse'].map((t,i)=>(
                      <button key={t} className={`${styles.rtab} ${rTab===t?styles.active:''}`} onClick={()=>setRTab(t)}>
                        {['종합','교통','인프라','학군★','소음★','상권','개발','거주후기','전세위험'][i]}
                      </button>
                    ))}
                  </div>

                  {rTab==='overview' && (
                    <>
                      <div className={styles.scoreGridCenter}>
                        {LAYERS.map(l=>(
                          <div key={l.name} className={styles.scoreCard}>
                            <div className={styles.scLabel}>{l.icon} {l.name}</div>
                            <div className={styles.scVal} style={{color:sc(l.score)}}>{l.score}</div>
                            <div className={styles.scBar}><div className={styles.scFill} style={{width:`${l.score}%`,background:sc(l.score)}}/></div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.aiBox}><span>🤖</span><p>{D.ai_comment}</p></div>
                      <div className={styles.compareTitle}>📍 비슷한 조건의 대안 지역</div>
                      <div className={styles.compareGridCenter}>
                        {D.alternatives.map(a=>(
                          <div key={a.name} className={styles.compareItem}>
                            <div><div className={styles.compareName}>📍 {a.name}</div><div className={styles.compareNote}>{a.note}</div></div>
                            <span className={styles.compareScore}>{a.score}점</span>
                          </div>
                        ))}
                      </div>
                      <div className={styles.pdfCta}>
                        <div><strong>풀 리포트 PDF 저장</strong><small>6개 레이어 + 비교 3곳 + AI 평가</small></div>
                        <button className={styles.btnPdf}>📄 4,900원</button>
                      </div>
                    </>
                  )}
                  {rTab==='noise' && (
                    <div className={styles.noisePanel}>
                      <div className={styles.tsTitle}>시간대별 소음 위험도</div>
                      {D.noise_times.map(t=>{
                        const c = t.pct>=80?'#111':t.pct>=50?'var(--main)':'var(--sub)';
                        return (
                          <div key={t.label} className={styles.timeRow}>
                            <span className={styles.timeLabel}>{t.label}</span>
                            <div className={styles.timeBarW}><div className={styles.timeBarF} style={{width:`${t.pct}%`,background:c}}/></div>
                            <span style={{color:c,fontFamily:'Space Mono',fontSize:11}}>{t.pct}%</span>
                            <span className={styles.timeNote}>{t.note}</span>
                          </div>
                        );
                      })}
                      <div className={styles.aiBox} style={{marginTop:16}}><span>🤖</span><p>{D.noise_detail}</p></div>
                    </div>
                  )}
                  {rTab==='traffic'  && <div className={styles.aiBox}><span>🚇</span><p>{D.traffic_detail}</p></div>}
                  {rTab==='infra'    && <div className={styles.aiBox}><span>🏪</span><p>{D.infra_detail}</p></div>}
                  {rTab==='commerce' && <div className={styles.aiBox}><span>🛍️</span><p>{D.commerce_detail}</p></div>}
                  {rTab==='dev'      && <div className={styles.aiBox}><span>🏗️</span><p>{D.development_detail}</p></div>}

                  {/* ── 학군 상세 탭 ── */}
                  {rTab==='school' && (
                    <div className={styles.schoolPanel}>
                      <div className={styles.aiBox} style={{marginBottom:16}}><span>📚</span><p>{D.school_detail}</p></div>
                      {D.school_info && D.school_info.length > 0 ? (
                        <div className={styles.schoolList}>
                          <div className={styles.schoolListTitle}>📋 배정 학교 상세</div>
                          {D.school_info.map((s,i)=>(
                            <div key={i} className={styles.schoolItem}>
                              <div className={styles.schoolItemLeft}>
                                <span className={styles.schoolType}>{s.type}</span>
                                <strong className={styles.schoolName}>{s.name}</strong>
                                <span className={styles.schoolDist}>도보 {s.distance}</span>
                              </div>
                              <div className={styles.schoolItemRight}>
                                <span className={styles.schoolRating}>{s.rating}</span>
                                <span className={styles.schoolNote}>{s.note}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.schoolNoData}>
                          <p>🔍 학군 상세 데이터는 AI 분석 시 함께 제공됩니다.</p>
                          <p style={{fontSize:11,color:'var(--muted)',marginTop:4}}>주소를 입력하면 배정 학교·학원가·평판 정보를 확인할 수 있습니다.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 거주후기 탭 ── */}
                  {rTab==='review' && (
                    <div className={styles.reviewPanel}>
                      {D.reviews && D.reviews.length > 0 ? (
                        <>
                          {D.reviews.map((r,i)=>(
                            <div key={i} className={styles.reviewItem}>
                              <div className={styles.reviewHeader}>
                                <span className={styles.reviewAuthor}>{r.author}</span>
                                <span className={styles.reviewRating}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                                <span className={styles.reviewDate}>{r.date}</span>
                              </div>
                              <p className={styles.reviewText}>{r.text}</p>
                            </div>
                          ))}
                          <button
                            className={styles.btnWriteReview}
                            onClick={()=>window.location.href='/community'}
                          >✏️ 이 동네 후기 남기기</button>
                        </>
                      ) : (
                        <div className={styles.reviewEmpty}>
                          <div style={{fontSize:32,marginBottom:12}}>📝</div>
                          <p>아직 등록된 거주후기가 없습니다.</p>
                          <p style={{fontSize:12,color:'var(--muted)',margin:'6px 0 16px'}}>첫 번째 후기를 남겨보세요!</p>
                          <button
                            className={styles.btnWriteReview}
                            onClick={()=>window.location.href='/community'}
                          >✏️ 후기 작성하러 가기</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 전세사기 위험도 탭 ── */}
                  {rTab==='jeonse' && (
                    <div className={styles.jeonsePanel}>
                      {D.jeonse_risk ? (
                        <>
                          <div className={`${styles.jeonseRiskBadge} ${styles['jeonseRisk_'+D.jeonse_risk.level]}`}>
                            {D.jeonse_risk.level==='high'?'🔴 위험':''}
                            {D.jeonse_risk.level==='medium'?'🟡 주의':''}
                            {D.jeonse_risk.level==='low'?'🟢 안전':''}
                            {' '}
                            {D.jeonse_risk.level==='high'?'전세사기 위험 지역':''}
                            {D.jeonse_risk.level==='medium'?'전세사기 주의 필요':''}
                            {D.jeonse_risk.level==='low'?'비교적 안전한 지역':''}
                          </div>
                          <div className={styles.aiBox} style={{marginTop:12}}><span>🤖</span><p>{D.jeonse_risk.reason}</p></div>
                          <div className={styles.jeonseChecklist}>
                            <div className={styles.jeonseCheckTitle}>✅ 계약 전 필수 체크리스트</div>
                            {D.jeonse_risk.checklist.map((item,i)=>(
                              <div key={i} className={styles.jeonseCheckItem}>
                                <span className={styles.jeonseCheckNum}>{i+1}</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className={styles.jeonseNoData}>
                          <div style={{fontSize:32,marginBottom:12}}>🏦</div>
                          <p>전세사기 위험도는 AI 분석 시 함께 제공됩니다.</p>
                          <p style={{fontSize:12,color:'var(--muted)',marginTop:4}}>주소를 입력하면 해당 지역의 깡통전세·전세사기 위험도를 분석합니다.</p>
                          <div className={styles.jeonseManualBox}>
                            <div className={styles.jeonseManualTitle}>📋 전세계약 기본 체크리스트</div>
                            {['등기부등본 열람 (계약 당일·잔금 직전 재확인)','전세가율 80% 초과 여부 확인 (위험 신호)','선순위 채권·근저당 합계 확인','임대인 신원 확인 (등기부등본 소유자와 일치)','전세보증보험 가입 가능 여부 확인 (HUG/SGI)','확정일자 즉시 신청 (전입신고 당일)'].map((item,i)=>(
                              <div key={i} className={styles.jeonseCheckItem}>
                                <span className={styles.jeonseCheckNum}>{i+1}</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 소음 지도 탭: 사이드 + 지도 ── */}
        {tab==='noise' && (
        <aside className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            {/* 소음 지도 검색 */}
            <div className={styles.noiseSearchSection}>
              <div className={styles.noiseSummaryTitle}>🔍 소음 지도 검색</div>
              <div className={styles.noiseSearchRow}>
                <input
                  className={styles.noiseSearchInput}
                  value={reverseGeocoding ? '주소 불러오는 중...' : noiseSearchInput}
                  onChange={e=>setNoiseSearchInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&searchNoiseLocation()}
                  placeholder={reverseGeocoding ? '📍 주소 불러오는 중...' : '지도 클릭 또는 주소 입력'}
                  readOnly={reverseGeocoding}
                />
                <button
                  className={styles.btnNoiseSearch}
                  onClick={searchNoiseLocation}
                  disabled={reverseGeocoding}
                >검색</button>
              </div>
              {/* 지도 클릭 안내 */}
              <p className={styles.mapClickHint}>💡 지도를 클릭하면 핀 위치 기준으로 자동 검색됩니다</p>
            </div>

            <div className={styles.noiseSummary}>
              <div className={styles.noiseSummaryTitle}>🔊 실시간 소음 지도</div>
              {locLoading
                ? <p className={styles.locLoading}>📍 현재 위치 확인 중...</p>
                : <p>현재 위치 기준 소음 제보 현황입니다.<br/>핀을 클릭해 상세 정보를 확인하세요.</p>
              }
            </div>
            <div className={styles.noiseStatBox}>
              {statsLoading ? (
                <div style={{textAlign:'center',padding:'12px 0',fontSize:12,color:'var(--muted)'}}>현황 불러오는 중...</div>
              ) : noiseStats === null ? (
                <div style={{textAlign:'center',padding:'8px 0',fontSize:12,color:'var(--muted)'}}>소음 지도 탭을 열면 현황이 표시됩니다.</div>
              ) : (
                <>
                  {[
                    ['🎵 유흥 소음', noiseStats.entertainment, '#111'],
                    ['🏗️ 공사 소음', noiseStats.construction,  'var(--main)'],
                    ['🚗 교통 소음', noiseStats.traffic,        'var(--muted)'],
                    ['🏠 층간소음',  noiseStats.floor,          'var(--muted)'],
                    ['🐕 기타 소음', noiseStats.other,          'var(--muted)'],
                  ].map(([l, v, c]) => (
                    <div key={l as string} className={styles.noiseStatRow}>
                      <span>{l}</span>
                      <strong style={{color: (v as number) > 0 ? c as string : 'var(--muted)'}}>
                        {(v as number) > 0 ? `${v}건` : '없음'}
                      </strong>
                    </div>
                  ))}
                  {Object.values(noiseStats).every(v => v === 0) && (
                    <div style={{fontSize:11,color:'var(--muted)',textAlign:'center',paddingTop:6}}>
                      이 지역 제보가 아직 없어요. 첫 제보를 남겨보세요!
                    </div>
                  )}
                </>
              )}
            </div>
            {/* ── 민원 원클릭 가이드 ── */}
            <div className={styles.complaintSection}>
              <div className={styles.noiseSummaryTitle}>📋 민원 신고 가이드</div>
              <div className={styles.complaintGrid}>
                {[
                  { type:'층간소음', icon:'🏠', tel:'1661-2642', org:'층간소음 이웃사이센터', url:'https://floor.noiseinfo.or.kr' },
                  { type:'공사소음', icon:'🏗️', tel:'120',       org:'서울시 다산콜센터',     url:'https://www.seoul.go.kr' },
                  { type:'유흥소음', icon:'🎵', tel:'112',        org:'경찰청 신고',            url:'https://www.police.go.kr' },
                  { type:'교통소음', icon:'🚗', tel:'1800-5955',  org:'한국도로공사',            url:'https://www.ex.co.kr' },
                ].map(g=>(
                  <div key={g.type} className={styles.complaintCard}>
                    <div className={styles.complaintIcon}>{g.icon}</div>
                    <div className={styles.complaintType}>{g.type}</div>
                    <div className={styles.complaintOrg}>{g.org}</div>
                    <a href={`tel:${g.tel}`} className={styles.complaintTel}>📞 {g.tel}</a>
                    <a href={g.url} target="_blank" rel="noreferrer" className={styles.complaintLink}>바로가기 →</a>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 소음 알림 섹션 ── */}
            <div className={styles.alertSection}>
              <div className={styles.noiseSummaryTitle}>
                🔔 소음 알림
                {notifPermission !== 'granted' && (
                  <button className={styles.btnAlertPermit} onClick={requestNotifPermission}>
                    알림 허용
                  </button>
                )}
              </div>
              {notifPermission === 'denied' && (
                <p className={styles.alertDenied}>브라우저 설정에서 알림을 허용해주세요.</p>
              )}
              {/* 현재 검색 주소 등록 버튼 */}
              {noiseSearchInput.trim() && userLat != null && (
                <button className={styles.btnAddWatch} onClick={addWatchedAddress}>
                  📌 "{noiseSearchInput.trim().slice(0,12)}{noiseSearchInput.trim().length>12?'…':''}" 알림 등록
                </button>
              )}
              {/* 관심 주소 목록 */}
              {watchedAddresses.length > 0 ? (
                <ul className={styles.watchList}>
                  {watchedAddresses.map(w => (
                    <li key={w.address} className={styles.watchItem}>
                      <button
                        className={styles.watchAddr}
                        onClick={() => {
                          setUserLat(w.lat); setUserLng(w.lng);
                          setNoiseSearchInput(w.address);
                          loadNoiseStats(w.lat, w.lng);
                        }}
                      >📍 {w.address.slice(0,18)}{w.address.length>18?'…':''}</button>
                      <button className={styles.watchDel} onClick={() => removeWatchedAddress(w.address)}>✕</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.watchEmpty}>주소를 검색한 후 알림을 등록하세요.</p>
              )}
            </div>

            <button className={styles.btnSubmitFull} onClick={()=>setReportOpen(true)}>+ 소음 제보하기</button>
          </div>
        </aside>
        )}

        {/* 우측 콘텐츠 (소음 탭에서만 표시) */}
        <div className={`${styles.mainContent} ${tab!=='noise'?styles.mainContentHidden:''}`}>
          {tab==='noise' && (
            <div className={styles.mapArea}>
              <div className={styles.mapToolbar}>
                <div className={styles.filterChips}>
                  {(['🏗️ 공사','🎵 유흥','🏠 층간','🚗 교통','🐕 기타'] as const).map(f => {
                    const type    = FILTER_TYPE_MAP[f];
                    const isActive = activeFilters.length === 0 || activeFilters.includes(type);
                    return (
                      <button
                        key={f}
                        className={`${styles.fChip} ${isActive ? styles.on : styles.off}`}
                        onClick={() => {
                          setActiveFilters(prev => {
                            // 전체 활성화 상태에서 클릭 → 해당 타입만 선택
                            if (prev.length === 0) return [type];
                            // 이미 선택된 타입 클릭 → 해제 (나머지 유지)
                            const next = prev.filter(t => t !== type);
                            // 마지막 하나 해제 시 → 전체 활성화로 복귀
                            return next;
                          });
                        }}
                      >{f}</button>
                    );
                  })}
                </div>
                <div className={styles.viewToggle}>
                  <button className={`${styles.vBtn} ${mapView==='pin'?styles.active:''}`} onClick={()=>setMapView('pin')}>📍 핀</button>
                  <button className={`${styles.vBtn} ${mapView==='heat'?styles.active:''}`} onClick={()=>setMapView('heat')}>🌡️ 히트맵</button>
                </div>
              </div>
              {/* 4. Naver Map — 현재 위치 기반 */}
              <NaverMap
                lat={userLat??37.5665}
                lng={userLng??126.9780}
                loading={locLoading}
                onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
                onMapClick={handleMapClick}
                activeFilters={activeFilters}
                timeSlot={timeSlotIdx >= 0 ? TIME_SLOTS[timeSlotIdx] : 'all'}
                showHeat={mapView === 'heat'}
                osmPins={osmPins}
                key={`map-${pinReloadKey}`}
              />
              <div className={styles.mapTimeBar}>
                <div>
                  시간대 필터
                  {timeSlotIdx >= 0 && (
                    <button
                      onClick={() => setTimeSlotIdx(-1)}
                      style={{marginLeft:8,fontSize:10,background:'none',border:'1px solid var(--muted)',borderRadius:4,padding:'1px 6px',cursor:'pointer',color:'var(--muted)'}}
                    >전체</button>
                  )}
                </div>
                <input
                  type="range" min="-1" max="4"
                  value={timeSlotIdx}
                  onChange={e => setTimeSlotIdx(Number(e.target.value))}
                />
                <div className={styles.mtbTicks}>
                  <span style={{color: timeSlotIdx===-1?'var(--main)':''}}>전체</span>
                  <span style={{color: timeSlotIdx===0?'var(--main)':''}}>새벽</span>
                  <span style={{color: timeSlotIdx===1?'var(--main)':''}}>오전</span>
                  <span style={{color: timeSlotIdx===2?'var(--main)':''}}>오후</span>
                  <span style={{color: timeSlotIdx===3?'var(--main)':''}}>저녁</span>
                  <span style={{color: timeSlotIdx===4?'var(--main)':''}}>심야</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <button className={styles.fab} onClick={()=>setReportOpen(true)}>+ 소음 제보하기</button>

      {/* ── 핵심 기능 ── */}
      <section className={styles.featuresSection} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.secLabel}>핵심 기능</div>
          <h2 className={styles.secTitle}>이사 결정에 필요한<br/>모든 데이터</h2>
          <div className={styles.featGrid}>
            {[
              {icon:'🔊',title:'소음 크라우드 지도',    desc:'층간·공사·유흥·교통 소음을 시간대별로 확인. 핀 뷰와 히트맵 뷰 전환 가능.'},
              {icon:'🤖',title:'AI 입지 분석 리포트',   desc:'교통·학군·인프라·소음·상권·개발 6개 레이어를 Claude AI가 종합 분석해 점수와 코멘트 제공.'},
              {icon:'📊',title:'레이더 차트 스코어카드', desc:'6개 항목을 레이더 차트와 바 그래프로 시각화. 비슷한 조건의 대안 지역 3곳 비교.'},
              {icon:'🔔',title:'스마트 알림',            desc:'관심 주소 반경 500m 내 새 소음 제보, 공사 허가, 입지 점수 변동 시 즉시 알림.'},
              {icon:'📋',title:'민원 원클릭 가이드',     desc:'층간·공사·유흥 소음 유형별 신고 절차와 담당 기관을 주소 기반으로 자동 연결.'},
              {icon:'📄',title:'PDF 리포트 저장',        desc:'풀 리포트를 PDF로 저장해 부동산 계약 전 참고 자료로 활용하거나 공인중개사와 공유.'},
            ].map(f=>(
              <div key={f.title} className={styles.featCard}>
                <div className={styles.featIcon}>{f.icon}</div>
                <div className={styles.featTitle}>{f.title}</div>
                <div className={styles.featDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. 요금제 — 준비중 */}
      <section className={styles.pricingSection} id="pricing">
        <div className={styles.sectionInner}>
          <div style={{textAlign:'center',maxWidth:520,margin:'0 auto 32px'}}>
            <div className={styles.secLabel} style={{textAlign:'center'}}>요금제</div>
            <h2 className={styles.secTitle}>이사 전 가장 중요한 투자</h2>
            <p className={styles.secDesc} style={{textAlign:'center',marginTop:8}}>한 번의 잘못된 이사가 수개월의 스트레스보다 더 비쌉니다.</p>
          </div>
          <div className={styles.comingSoonBanner}>🔧 결제 서비스 준비 중입니다. 베타 기간 동안 무료로 이용하실 수 있습니다.</div>
          <div className={styles.pricingGrid}>
            {[
              {plan:'무료',      price:'0',      unit:'원',    desc:'소음 지도 + 기본 분석',       feats:['소음 지도 열람·제보 무제한','입지 분석 일 3회','6개 레이어 기본 보기','민원 가이드 이용'],     btn:'무료 시작',  free:true,  badge:''},
              {plan:'이사 플랜', price:'4,900',  unit:'원/건', desc:'이사 결정 1회용 완전 리포트', feats:['특정 주소 풀 리포트','PDF 다운로드','비교 지역 3곳 분석','AI 상세 코멘트'],              btn:'준비 중',    free:false, badge:'인기'},
              {plan:'월정액',    price:'14,900', unit:'원/월', desc:'청약·투자 준비자',             feats:['무제한 분석·비교','실시간 알림','분석 히스토리 30개','이사 예정지 모니터링'],            btn:'준비 중',    free:false, badge:''},
              {plan:'프리미엄',  price:'29,900', unit:'원/월', desc:'완전한 이사 결정 패키지',      feats:['월정액 전체 포함','민원 자동 가이드','주간 리포트 이메일','전문가 상담 1회'],             btn:'준비 중',    free:false, badge:''},
            ].map(p=>(
              <div key={p.plan} className={`${styles.priceCard} ${p.badge?styles.priceCardFeatured:''}`}>
                {p.badge && <div className={styles.priceBadge}>{p.badge}</div>}
                <div className={styles.pricePlan}>{p.plan}</div>
                <div className={styles.priceNum}>{p.price}<span className={styles.priceUnit}>{p.unit}</span></div>
                <div className={styles.priceDesc}>{p.desc}</div>
                <ul className={styles.priceFeats}>{p.feats.map(f=><li key={f}>{f}</li>)}</ul>
                <button disabled={!p.free} className={p.free?styles.priceBtnMain:styles.priceBtnDisabled}>{p.btn}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. B2B — 준비중 */}
      <section className={styles.b2bSection} id="b2b">
        <div className={styles.b2bInner}>
          <div className={styles.b2bLeft}>
            <div className={styles.b2bLabel}>B2B API</div>
            <h2 className={styles.b2bTitle}>직방·다방·건설사·지자체를 위한<br/>입지 분석 API</h2>
            <p className={styles.b2bDesc}>매물별 입지 점수 API 납품, 공인중개사 플랫폼 연동, 지자체 소음 민원 대시보드 등 다양한 B2B 협업을 준비 중입니다.</p>
            <div className={styles.b2bComingSoon}>🔧 서비스 준비 중 — 사전 문의는 이메일로 받고 있습니다</div>
            <a href="mailto:zntk660202@gmail.com" className={styles.b2bBtn}>✉️ 사전 문의하기</a>
          </div>
          <div className={styles.b2bCards}>
            {[
              {icon:'🏢',title:'부동산 플랫폼',    desc:'직방·다방·부동산114 — 입지 분석 API 납품'},
              {icon:'🔑',title:'공인중개사 플랫폼',desc:'매물별 입지 점수 연동 — 건당 과금 모델'},
              {icon:'🏗️',title:'건설사·시행사',    desc:'분양 전 입지 분석 리포트 — 프로젝트별'},
              {icon:'🏛️',title:'지자체',           desc:'소음 민원 집계 대시보드 — 연간 계약'},
            ].map(c=>(
              <div key={c.title} className={styles.b2bCard}>
                <span className={styles.b2bCardIcon}>{c.icon}</span>
                <div><div className={styles.b2bCardTitle}>{c.title}</div><div className={styles.b2bCardDesc}>{c.desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div>
              <div className={styles.footerLogo}>📍 무브IQ</div>
              <p className={styles.footerTagline}>이사 후 "알았다면 안 왔을 텐데"라는 말이<br/>사라지는 세상을 만든다</p>
            </div>
            {/* 7. 실제 동작하는 푸터 링크 */}
            <div className={styles.footerLinks}>
              {Object.keys(PAGES).map(name=>(
                <button key={name} className={styles.footerLinkBtn} onClick={()=>setPageModal(name)}>{name}</button>
              ))}
              <a href="mailto:admin@moveiq.co.kr" className={styles.footerLinkBtn}>B2B 문의</a>
            </div>
          </div>
          <div className={styles.footerCopy}>© 2025 무브IQ. All rights reserved.</div>
        </div>
      </footer>

      {/* ── 소음 제보 모달 ── */}
      {reportOpen && (
        <div className={styles.modalBg} onClick={e=>{if(e.target===e.currentTarget){setReportOpen(false);setReportOk(false);}}}>
          <div className={styles.modal}>
            {!reportOk ? (
              <>
                <div className={styles.modalHead}><h3>🔊 소음 제보하기</h3><button onClick={()=>{setReportOpen(false);setReportOk(false);}}>✕</button></div>
                {/* 현재 제보 위치 표시 */}
                <div className={styles.reportLocRow}>
                  {reportLat != null
                    ? <><span className={styles.reportLocDot} style={{background:'var(--main)'}}/>
                        <span>📍 지도 클릭 위치 ({reportLat.toFixed(4)}, {reportLng?.toFixed(4)})</span></>
                    : <><span className={styles.reportLocDot} style={{background:'#aaa'}}/>
                        <span>📍 현재 위치 기준 — 지도를 먼저 클릭하면 원하는 위치로 변경됩니다</span></>
                  }
                </div>
                <form onSubmit={submitReport}>
                  <div className={styles.formGroup}><label>소음 유형</label>
                    <select name="noise_type" className={styles.formInput} required>
                      <option value="construction">🏗️ 공사 소음</option>
                      <option value="entertainment">🎵 유흥 소음</option>
                      <option value="floor">🏠 층간소음</option>
                      <option value="traffic">🚗 교통 소음</option>
                      <option value="other">🐕 기타</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}><label>발생 시간대</label>
                    <select name="time_slot" className={styles.formInput} required>
                      <option value="dawn">새벽 (00-06시)</option><option value="morning">오전 (06-12시)</option>
                      <option value="afternoon">오후 (12-18시)</option><option value="evening">저녁 (18-24시)</option>
                      <option value="night">심야</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}><label>심각도 (1~5)</label>
                    <input type="range" name="severity" min="1" max="5" defaultValue="3" className={styles.formInput}/>
                  </div>
                  <div className={styles.formGroup}><label>상세 설명 (선택)</label>
                    <textarea name="description" className={styles.formInput} rows={3} maxLength={100} placeholder="소음 상황을 간단히 설명해주세요"/>
                  </div>
                  <button type="submit" className={styles.btnSubmit}>제보 완료</button>
                </form>
              </>
            ) : (
              <div className={styles.successState}>
                <div>🎉</div><h3>제보 완료!</h3><p>이 정보로 누군가의 이사를 도왔어요</p>
                <button onClick={()=>{setReportOpen(false);setReportOk(false);}} className={styles.btnSubmit}>닫기</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. 페이지 모달 */}
      {pageModal && (
        <div className={styles.modalBg} onClick={e=>{if(e.target===e.currentTarget)setPageModal(null);}}>
          <div className={styles.modal} style={{maxWidth:600}}>
            <div className={styles.modalHead}><h3>{PAGES[pageModal].title}</h3><button onClick={()=>setPageModal(null)}>✕</button></div>
            <pre className={styles.pageContent}>{PAGES[pageModal].body}</pre>
          </div>
        </div>
      )}

      {/* ── 모바일 하단 네비게이션 ── */}
      <nav className={styles.mobileNav}>
        <button
          className={`${styles.mobileNavBtn} ${tab==='search'?styles.mobileNavActive:''}`}
          onClick={()=>setTab('search')}
        >
          <span className={styles.mobileNavIcon}>🏙️</span>
          입지 분석
        </button>
        <button
          className={`${styles.mobileNavBtn} ${tab==='noise'?styles.mobileNavActive:''}`}
          onClick={goNoise}
        >
          <span className={styles.mobileNavIcon}>🔊</span>
          소음 지도
        </button>
        <button
          className={styles.mobileNavBtn}
          onClick={()=>setReportOpen(true)}
        >
          <span className={styles.mobileNavIcon}>📝</span>
          소음 제보
        </button>
        <button
          className={styles.mobileNavBtn}
          onClick={()=>window.location.href='/community'}
        >
          <span className={styles.mobileNavIcon}>💬</span>
          소통하기
        </button>
      </nav>
    </>
  );
}
