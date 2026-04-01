'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AuthButton from '../components/AuthButton';
import styles from './noise-map.module.css';

// ── 상수 ─────────────────────────────────────────────────
const FILTER_TYPE_MAP: Record<string, string> = {
  '🏗️ 공사': 'construction',
  '🎵 유흥': 'entertainment',
  '🏠 층간': 'floor',
  '🚗 교통': 'traffic',
  '🐕 기타': 'other',
};
const TIME_SLOTS = ['dawn', 'morning', 'afternoon', 'evening', 'night'];
const PIN_CONFIG: Record<string, { icon: string; color: string }> = {
  construction:  { icon: '🏗️', color: '#8B6914' },
  entertainment: { icon: '🎵', color: '#111111' },
  floor:         { icon: '🏠', color: '#646F4B' },
  traffic:       { icon: '🚗', color: '#2563EB' },
  other:         { icon: '🐕', color: '#6B7280' },
};

// ── Naver 지도 컴포넌트 ───────────────────────────────────
function NaverMap({ lat, lng, loading, onCenterChange, onMapClick, activeFilters, timeSlot, onPinsLoaded, showHeat, osmPins }: {
  lat: number; lng: number; loading: boolean;
  onCenterChange?: (lat: number, lng: number) => void;
  onMapClick?:     (lat: number, lng: number) => void;
  activeFilters?:  string[];
  timeSlot?:       string;
  onPinsLoaded?:   () => void;
  showHeat?:       boolean;
  osmPins?:        { lat: number; lng: number; osm_type: string; name: string }[];
}) {
  const mapRef           = useRef<any>(null);
  const clickPinRef      = useRef<any>(null);
  const pinsRef          = useRef<any[]>([]);
  const osmPinMarkersRef = useRef<any[]>([]);
  const heatmapRef       = useRef<any>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_NAVER_MAP_KEY;
    if (!key || loading) return;

    (window as any).navermap_authFailure = () => {
      const el = document.getElementById('naverMapEl');
      if (el) el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#f5f7f3;gap:12px;padding:24px;text-align:center;"><span style="font-size:40px">🗺️</span><div style="font-size:14px;font-weight:700;color:#111">지도 API 인증 실패</div></div>`;
    };

    const initMap = () => {
      setTimeout(() => {
        const el = document.getElementById('naverMapEl');
        if (!el) return;
        const n = (window as any).naver;
        if (!n?.maps) return;
        if (mapRef.current) {
          mapRef.current.setCenter(new n.maps.LatLng(lat, lng));
          n.maps.Event.trigger(mapRef.current, 'resize');
          return;
        }
        const map = new n.maps.Map(el, { center: new n.maps.LatLng(lat, lng), zoom: 15 });
        mapRef.current = map;
        const ACTIVE_PIN_HTML = `<div style="width:24px;height:24px;background:#646F4B;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);"></div>`;
        clickPinRef.current = new n.maps.Marker({ map, position: new n.maps.LatLng(lat, lng), icon: { content: ACTIVE_PIN_HTML, anchor: new n.maps.Point(12, 24) }, zIndex: 200 });
        n.maps.Event.addListener(map, 'idle', () => { const c = map.getCenter(); onCenterChange?.(c.lat(), c.lng()); });
        n.maps.Event.addListener(map, 'click', (e: any) => {
          const cLat = e.coord.lat(); const cLng = e.coord.lng();
          if (clickPinRef.current) clickPinRef.current.setMap(null);
          clickPinRef.current = new n.maps.Marker({ map, position: new n.maps.LatLng(cLat, cLng), icon: { content: ACTIVE_PIN_HTML, anchor: new n.maps.Point(12, 24) }, zIndex: 200 });
          onMapClick?.(cLat, cLng);
        });
        loadNoisePins(map, lat, lng, n, pinsRef, onPinsLoaded);
      }, 100);
    };

    if ((window as any).naver?.maps) { initMap(); return; }
    if (document.getElementById('naver-sdk')) {
      const wait = setInterval(() => { if ((window as any).naver?.maps) { clearInterval(wait); initMap(); } }, 100);
      setTimeout(() => clearInterval(wait), 15000);
      return;
    }
    const s = document.createElement('script');
    s.id = 'naver-sdk';
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${key}&submodules=visualization`;
    s.onload = initMap;
    document.head.appendChild(s);
  }, [lat, lng, loading]);

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

  useEffect(() => {
    const n = (window as any).naver;
    if (!n?.maps || !mapRef.current) return;
    if (showHeat) {
      pinsRef.current.forEach(({ marker }) => marker.setMap(null));
      osmPinMarkersRef.current.forEach(m => m.setMap(null));
      const points = [
        ...pinsRef.current.map(({ marker }) => { const pos = marker.getPosition(); return new n.maps.LatLng(pos.lat(), pos.lng()); }),
        ...(osmPins ?? []).map(p => new n.maps.LatLng(p.lat, p.lng)),
      ];
      if (points.length === 0) { if (heatmapRef.current) { heatmapRef.current.setMap(null); heatmapRef.current = null; } return; }
      if (heatmapRef.current) heatmapRef.current.setMap(null);
      heatmapRef.current = new n.maps.visualization.HeatMap({ map: mapRef.current, data: points, radius: 30, opacity: 0.7, gradient: ['rgba(191,210,191,0)', 'rgba(100,111,75,0.6)', '#646F4B', '#111'] });
    } else {
      if (heatmapRef.current) { heatmapRef.current.setMap(null); heatmapRef.current = null; }
      pinsRef.current.forEach(({ marker, noise_type, time_slot }) => {
        const typeOk = !activeFilters?.length || activeFilters.includes(noise_type);
        const timeOk = !timeSlot || timeSlot === 'all' || time_slot === timeSlot;
        marker.setMap(typeOk && timeOk ? mapRef.current : null);
      });
      osmPinMarkersRef.current.forEach(m => m.setMap(mapRef.current));
    }
  }, [showHeat, osmPins]);

  useEffect(() => {
    const n = (window as any).naver;
    if (!n?.maps || !mapRef.current || !osmPins?.length) {
      osmPinMarkersRef.current.forEach(m => m.setMap(null));
      osmPinMarkersRef.current = [];
      return;
    }
    osmPinMarkersRef.current.forEach(m => m.setMap(null));
    osmPinMarkersRef.current = [];
    const visiblePins = osmPins.filter(pin => !activeFilters?.length || activeFilters.includes(pin.osm_type));
    visiblePins.forEach(pin => {
      const isEnt = pin.osm_type === 'entertainment';
      const color = isEnt ? '#111111' : '#8B6914';
      const icon  = isEnt ? '🎵' : '🏗️';
      const html = `<div style="background:${color};opacity:0.65;width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.2);border:1.5px dashed rgba(255,255,255,.7);cursor:pointer;">${icon}</div>`;
      const marker = new n.maps.Marker({ map: mapRef.current, position: new n.maps.LatLng(pin.lat, pin.lng), icon: { content: html, anchor: new n.maps.Point(10, 10) }, zIndex: 50 });
      const infoContent = `<div style="padding:8px 12px;font-family:'Pretendard',sans-serif;min-width:130px;"><div style="font-weight:700;font-size:12px;">${icon} ${pin.name}</div><div style="font-size:10px;color:#6b7260;">OSM 공공 데이터</div></div>`;
      const infoWindow = new n.maps.InfoWindow({ content: infoContent, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(100,111,75,0.2)' });
      n.maps.Event.addListener(marker, 'click', () => { if (infoWindow.getMap()) infoWindow.close(); else infoWindow.open(mapRef.current, marker); });
      osmPinMarkersRef.current.push(marker);
    });
  }, [osmPins, activeFilters]);

  if (loading) return (
    <div className={styles.mapPlaceholder}><span style={{ fontSize: 32 }}>📍</span><span>현재 위치 확인 중...</span></div>
  );
  return <div id="naverMapEl" className={styles.mapEl} />;
}

async function loadNoisePins(map: any, lat: number, lng: number, n: any, pinsRef: React.MutableRefObject<any[]>, onPinsLoaded?: () => void) {
  try {
    const res = await fetch(`/api/noise-reports?lat=${lat}&lng=${lng}`);
    const json = await res.json();
    if (pinsRef?.current) { pinsRef.current.forEach((p: any) => p.marker?.setMap(null)); pinsRef.current = []; }
    if (!json.success || !json.data?.length) { onPinsLoaded?.(); return; }
    const timeLabel: Record<string, string> = { dawn: '새벽', morning: '오전', afternoon: '오후', evening: '저녁', night: '심야' };
    const typeLabel: Record<string, string> = { construction: '공사 소음', entertainment: '유흥 소음', floor: '층간소음', traffic: '교통 소음', other: '기타 소음' };
    json.data.forEach((report: any) => {
      const cfg = PIN_CONFIG[report.noise_type] ?? PIN_CONFIG.other;
      const size = 24 + report.severity * 2;
      const html = `<div style="background:${cfg.color};width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-size:${size * 0.45}px;box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid rgba(255,255,255,.8);cursor:pointer;"><span style="transform:rotate(45deg)">${cfg.icon}</span></div>`;
      const marker = new n.maps.Marker({ map, position: new n.maps.LatLng(report.lat, report.lng), icon: { content: html, anchor: new n.maps.Point(size / 2, size) } });
      const infoContent = `<div style="padding:10px 14px;font-family:'Pretendard',sans-serif;min-width:140px;"><div style="font-weight:700;font-size:13px;margin-bottom:4px;">${cfg.icon} ${typeLabel[report.noise_type] ?? '소음'}</div><div style="font-size:11px;color:#6b7260;">시간대: ${timeLabel[report.time_slot] ?? ''}</div><div style="font-size:11px;color:#6b7260;">심각도: ${'★'.repeat(report.severity)}${'☆'.repeat(5 - report.severity)}</div><div style="font-size:10px;color:#aaa;margin-top:4px;">${new Date(report.created_at).toLocaleDateString('ko-KR')}</div></div>`;
      const infoWindow = new n.maps.InfoWindow({ content: infoContent, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(100,111,75,0.2)' });
      n.maps.Event.addListener(marker, 'click', () => { if (infoWindow.getMap()) infoWindow.close(); else infoWindow.open(map, marker); });
      if (pinsRef?.current) pinsRef.current.push({ marker, noise_type: report.noise_type, time_slot: report.time_slot });
    });
    onPinsLoaded?.();
  } catch (err) { console.error('소음 핀 로드 실패:', err); onPinsLoaded?.(); }
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function NoiseMapPage() {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [noiseStats, setNoiseStats] = useState<Record<string, number> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [timeSlotIdx, setTimeSlotIdx] = useState(-1);
  const [mapView, setMapView] = useState<'pin' | 'heat'>('pin');
  const [osmPins, setOsmPins] = useState<any[]>([]);
  const [pinReloadKey, setPinReloadKey] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportOk, setReportOk] = useState(false);
  const [reportLat, setReportLat] = useState<number | null>(null);
  const [reportLng, setReportLng] = useState<number | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => { setUserLat(p.coords.latitude); setUserLng(p.coords.longitude); setLocLoading(false); loadNoiseStats(p.coords.latitude, p.coords.longitude); },
      () => { setUserLat(37.5665); setUserLng(126.9780); setLocLoading(false); loadNoiseStats(37.5665, 126.9780); },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  async function loadNoiseStats(lat: number, lng: number) {
    setStatsLoading(true);
    try {
      const [noiseRes, osmRes] = await Promise.all([
        fetch(`/api/noise-reports?lat=${lat}&lng=${lng}`),
        fetch(`/api/cals-construction?lat=${lat}&lng=${lng}`),
      ]);
      const noiseJson = await noiseRes.json();
      const osmJson   = await osmRes.json().catch(() => ({ success: false, count: 0, entertainment: 0, traffic: false, pins: [] }));
      const counts: Record<string, number> = { entertainment: 0, construction: 0, traffic: 0, floor: 0, other: 0 };
      if (noiseJson.success && noiseJson.data) noiseJson.data.forEach((r: any) => { if (r.noise_type in counts) counts[r.noise_type]++; });
      if (osmJson.success && osmJson.count > 0) counts.construction += osmJson.count;
      if (osmJson.success && osmJson.entertainment > 0) counts.entertainment += osmJson.entertainment;
      if (osmJson.success && osmJson.traffic) counts.traffic += 1;
      if (osmJson.success && osmJson.pins?.length) setOsmPins(osmJson.pins); else setOsmPins([]);
      setNoiseStats({ ...counts });
    } catch { /* silent */ } finally { setStatsLoading(false); }
  }

  async function handleMapClick(clickLat: number, clickLng: number) {
    setReportLat(clickLat); setReportLng(clickLng);
    setUserLat(clickLat); setUserLng(clickLng);
    setReverseGeocoding(true);
    loadNoiseStats(clickLat, clickLng);
    try {
      const res = await fetch(`/api/geocode?lat=${clickLat}&lng=${clickLng}`);
      const json = await res.json();
      if (json.success && json.roadAddress) setSearchInput(json.roadAddress);
    } catch { /* silent */ } finally { setReverseGeocoding(false); }
  }

  async function searchLocation() {
    const addr = searchInput.trim();
    if (!addr) return;
    setLocLoading(true);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`);
      const json = await res.json();
      if (json.lat && json.lng) { setUserLat(json.lat); setUserLng(json.lng); loadNoiseStats(json.lat, json.lng); }
      else alert('주소를 찾을 수 없습니다.');
    } catch { alert('검색 오류가 발생했습니다.'); } finally { setLocLoading(false); }
  }

  async function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      const submitLat = reportLat ?? userLat ?? 37.5665;
      const submitLng = reportLng ?? userLng ?? 126.9780;
      const res = await fetch('/api/noise-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noise_type: d.get('noise_type'), time_slot: d.get('time_slot'), severity: Number(d.get('severity')), lat: submitLat, lng: submitLng, description: d.get('description') }) });
      const json = await res.json();
      if (json.success) { setReportOk(true); setPinReloadKey(k => k + 1); loadNoiseStats(submitLat, submitLng); }
      else alert(json.message);
    } catch { alert('제보 저장에 실패했습니다.'); }
  }

  return (
    <div className={styles.root}>
      {/* ── 헤더 ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark}/>
            <span>무브IQ</span>
          </Link>
          <form className={styles.searchForm} onSubmit={e => { e.preventDefault(); searchLocation(); }}>
            <input
              value={reverseGeocoding ? '주소 불러오는 중...' : searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="지도 클릭 또는 주소 입력"
              readOnly={reverseGeocoding}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>검색</button>
          </form>
          <nav className={styles.nav}>
            <Link href="/noise-map" className={`${styles.navLink} ${styles.navActive}`}>소음 지도</Link>
            <Link href="/analysis"  className={styles.navLink}>입지 분석</Link>
            <Link href="/community" className={styles.navLink}>커뮤니티</Link>
          </nav>
          <AuthButton />
        </div>
      </header>

      {/* ── 레이아웃 ── */}
      <div className={styles.layout}>
        {/* 사이드바 */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            <div className={styles.sidebarSection}>
              <div className={styles.sectionTitle}>🔊 실시간 소음 현황</div>
              <p className={styles.sectionDesc}>
                현재 위치 기준 소음 제보 현황입니다.<br/>
                핀을 클릭해 상세 정보를 확인하세요.
              </p>
              <p className={styles.mapHint}>💡 지도를 클릭하면 해당 위치로 자동 검색됩니다</p>
            </div>

            <div className={styles.statsBox}>
              {statsLoading ? (
                <div className={styles.statsLoading}>현황 불러오는 중...</div>
              ) : noiseStats ? (
                [
                  ['🎵 유흥 소음', noiseStats.entertainment, 'var(--text)'],
                  ['🏗️ 공사 소음', noiseStats.construction,  'var(--main)'],
                  ['🚗 교통 소음', noiseStats.traffic,        'var(--muted)'],
                  ['🏠 층간소음',  noiseStats.floor,          'var(--muted)'],
                  ['🐕 기타 소음', noiseStats.other,          'var(--muted)'],
                ].map(([l, v, c]) => (
                  <div key={l as string} className={styles.statsRow}>
                    <span>{l}</span>
                    <strong style={{ color: (v as number) > 0 ? c as string : 'var(--muted)' }}>
                      {(v as number) > 0 ? `${v}건` : '없음'}
                    </strong>
                  </div>
                ))
              ) : (
                <div className={styles.statsLoading}>위치 확인 후 표시됩니다.</div>
              )}
            </div>

            {/* 민원 가이드 */}
            <div className={styles.sidebarSection}>
              <div className={styles.sectionTitle}>📋 민원 신고 가이드</div>
              <div className={styles.complaintGrid}>
                {[
                  { type: '층간소음', icon: '🏠', tel: '1661-2642', url: 'https://floor.noiseinfo.or.kr' },
                  { type: '공사소음', icon: '🏗️', tel: '120',       url: 'https://www.seoul.go.kr' },
                  { type: '유흥소음', icon: '🎵', tel: '112',        url: 'https://www.police.go.kr' },
                  { type: '교통소음', icon: '🚗', tel: '1800-5955',  url: 'https://www.ex.co.kr' },
                ].map(g => (
                  <div key={g.type} className={styles.complaintCard}>
                    <span className={styles.complaintIcon}>{g.icon}</span>
                    <div className={styles.complaintType}>{g.type}</div>
                    <a href={`tel:${g.tel}`} className={styles.complaintTel}>📞 {g.tel}</a>
                    <a href={g.url} target="_blank" rel="noreferrer" className={styles.complaintLink}>바로가기 →</a>
                  </div>
                ))}
              </div>
            </div>

            <button className={styles.btnReport} onClick={() => setReportOpen(true)}>
              + 소음 제보하기
            </button>
          </div>
        </aside>

        {/* 지도 영역 */}
        <div className={styles.mapArea}>
          {/* 툴바 */}
          <div className={styles.toolbar}>
            <div className={styles.filterChips}>
              {(Object.keys(FILTER_TYPE_MAP) as (keyof typeof FILTER_TYPE_MAP)[]).map(f => {
                const type = FILTER_TYPE_MAP[f];
                const isActive = activeFilters.length === 0 || activeFilters.includes(type);
                return (
                  <button
                    key={f}
                    className={`${styles.chip} ${isActive ? styles.chipOn : styles.chipOff}`}
                    onClick={() => setActiveFilters(prev => {
                      if (prev.length === 0) return [type];
                      const next = prev.filter(t => t !== type);
                      return next;
                    })}
                  >{f}</button>
                );
              })}
            </div>
            <div className={styles.viewToggle}>
              <button className={`${styles.vBtn} ${mapView === 'pin'  ? styles.vBtnActive : ''}`} onClick={() => setMapView('pin')}>📍 핀</button>
              <button className={`${styles.vBtn} ${mapView === 'heat' ? styles.vBtnActive : ''}`} onClick={() => setMapView('heat')}>🌡️ 히트맵</button>
            </div>
          </div>

          <NaverMap
            key={`map-${pinReloadKey}`}
            lat={userLat ?? 37.5665}
            lng={userLng ?? 126.9780}
            loading={locLoading}
            onCenterChange={(lat, lng) => { /* 필요시 사용 */ }}
            onMapClick={handleMapClick}
            activeFilters={activeFilters}
            timeSlot={timeSlotIdx >= 0 ? TIME_SLOTS[timeSlotIdx] : 'all'}
            showHeat={mapView === 'heat'}
            osmPins={osmPins}
          />

          {/* 시간대 슬라이더 */}
          <div className={styles.timeBar}>
            <div className={styles.timeBarLabel}>
              시간대 필터
              {timeSlotIdx >= 0 && (
                <button className={styles.btnReset} onClick={() => setTimeSlotIdx(-1)}>전체</button>
              )}
            </div>
            <input type="range" min="-1" max="4" value={timeSlotIdx} onChange={e => setTimeSlotIdx(Number(e.target.value))} className={styles.timeRange} />
            <div className={styles.timeTicks}>
              {['전체', '새벽', '오전', '오후', '저녁', '심야'].map((t, i) => (
                <span key={t} style={{ color: timeSlotIdx === i - 1 ? 'var(--main)' : '' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button className={styles.fab} onClick={() => setReportOpen(true)}>+ 소음 제보하기</button>

      {/* 하단 모바일 네비 */}
      <nav className={styles.mobileNav}>
        <Link href="/"          className={styles.mobileNavBtn}><span>🏠</span>홈</Link>
        <Link href="/noise-map" className={`${styles.mobileNavBtn} ${styles.mobileNavActive}`}><span>🔊</span>소음 지도</Link>
        <button className={styles.mobileNavBtn} onClick={() => setReportOpen(true)}><span>📝</span>제보</button>
        <Link href="/analysis"  className={styles.mobileNavBtn}><span>🏙️</span>입지 분석</Link>
        <Link href="/community" className={styles.mobileNavBtn}><span>💬</span>커뮤니티</Link>
      </nav>

      {/* 제보 모달 */}
      {reportOpen && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) { setReportOpen(false); setReportOk(false); } }}>
          <div className={styles.modal}>
            {!reportOk ? (
              <>
                <div className={styles.modalHead}><h3>🔊 소음 제보하기</h3><button onClick={() => { setReportOpen(false); setReportOk(false); }}>✕</button></div>
                <div className={styles.reportLoc}>
                  {reportLat != null
                    ? <><span className={`${styles.locDot} ${styles.locDotGreen}`}/><span>📍 지도 클릭 위치 ({reportLat.toFixed(4)}, {reportLng?.toFixed(4)})</span></>
                    : <><span className={styles.locDot}/><span>📍 현재 위치 기준 — 지도를 클릭해 위치를 변경할 수 있습니다</span></>
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
                      <option value="dawn">새벽 (00–06시)</option>
                      <option value="morning">오전 (06–12시)</option>
                      <option value="afternoon">오후 (12–18시)</option>
                      <option value="evening">저녁 (18–24시)</option>
                      <option value="night">심야</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}><label>심각도 (1~5)</label>
                    <input type="range" name="severity" min="1" max="5" defaultValue="3" className={styles.formInput} />
                  </div>
                  <div className={styles.formGroup}><label>상세 설명 (선택)</label>
                    <textarea name="description" className={styles.formInput} rows={3} maxLength={100} placeholder="소음 상황을 간단히 설명해주세요" />
                  </div>
                  <button type="submit" className={styles.btnSubmit}>제보 완료</button>
                </form>
              </>
            ) : (
              <div className={styles.successState}>
                <div>🎉</div><h3>제보 완료!</h3><p>이 정보로 누군가의 이사를 도왔어요</p>
                <button onClick={() => { setReportOpen(false); setReportOk(false); }} className={styles.btnSubmit}>닫기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
