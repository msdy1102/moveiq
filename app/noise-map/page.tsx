'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AuthButton from '../components/AuthButton';
import styles from './noise-map.module.css';

// ── 상수 ──────────────────────────────────────────────────
const FILTER_TYPE_MAP: Record<string, string> = {
  '🏗️ 공사': 'construction', '🎵 유흥': 'entertainment',
  '🏠 층간': 'floor',        '🚗 교통': 'traffic', '🐕 기타': 'other',
};
const TIME_SLOTS = ['dawn', 'morning', 'afternoon', 'evening', 'night'];
const PIN_CONFIG: Record<string, { icon: string; color: string }> = {
  construction:  { icon: '🏗️', color: '#8B6914' },
  entertainment: { icon: '🎵', color: '#333' },
  floor:         { icon: '🏠', color: '#646F4B' },
  traffic:       { icon: '🚗', color: '#2563EB' },
  other:         { icon: '🐕', color: '#6B7280' },
};

// ── Naver 지도 ─────────────────────────────────────────────
function NaverMap({ lat, lng, loading, onCenterChange, onMapClick, activeFilters, timeSlot, onPinsLoaded, showHeat, osmPins, pinReloadKey }: {
  lat: number; lng: number; loading: boolean;
  onCenterChange?: (lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  activeFilters?: string[];
  timeSlot?: string;
  onPinsLoaded?: () => void;
  showHeat?: boolean;
  osmPins?: { lat: number; lng: number; osm_type: string; name: string }[];
  pinReloadKey?: number;
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
      if (el) el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#f7faf5;gap:12px;padding:24px;text-align:center;"><span style="font-size:40px">🗺️</span><div style="font-size:14px;font-weight:700;color:#1a1e15">지도 API 인증 실패</div><div style="font-size:12px;color:#7a8570;line-height:1.6">Naver Cloud Console에서 <b>Dynamic Map</b>을 선택하고<br/><b>이 사이트 도메인</b>을 Web 서비스 URL에 등록하세요.</div></div>`;
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

        const ACTIVE_PIN = `<div style="width:24px;height:24px;background:#646F4B;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.3);"></div>`;
        clickPinRef.current = new n.maps.Marker({ map, position: new n.maps.LatLng(lat, lng), icon: { content: ACTIVE_PIN, anchor: new n.maps.Point(12, 24) }, zIndex: 200 });

        n.maps.Event.addListener(map, 'idle', () => { const c = map.getCenter(); onCenterChange?.(c.lat(), c.lng()); });
        n.maps.Event.addListener(map, 'click', (e: any) => {
          const cLat = e.coord.lat(); const cLng = e.coord.lng();
          if (clickPinRef.current) clickPinRef.current.setMap(null);
          clickPinRef.current = new n.maps.Marker({ map, position: new n.maps.LatLng(cLat, cLng), icon: { content: ACTIVE_PIN, anchor: new n.maps.Point(12, 24) }, zIndex: 200 });
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
  }, [lat, lng, loading, pinReloadKey]);

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
      heatmapRef.current = new n.maps.visualization.HeatMap({ map: mapRef.current, data: points, radius: 30, opacity: 0.7, gradient: ['rgba(191,210,191,0)', 'rgba(100,111,75,0.5)', '#646F4B', '#333'] });
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
    const visible = osmPins.filter(pin => !activeFilters?.length || activeFilters.includes(pin.osm_type));
    visible.forEach(pin => {
      const isEnt = pin.osm_type === 'entertainment';
      const color = isEnt ? '#333' : '#8B6914';
      const icon  = isEnt ? '🎵' : '🏗️';
      const html = `<div style="background:${color};opacity:0.6;width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;border:1.5px dashed rgba(255,255,255,.7);cursor:pointer;">${icon}</div>`;
      const marker = new n.maps.Marker({ map: mapRef.current, position: new n.maps.LatLng(pin.lat, pin.lng), icon: { content: html, anchor: new n.maps.Point(10, 10) }, zIndex: 50 });
      const info = new n.maps.InfoWindow({ content: `<div style="padding:8px 12px;font-family:'Pretendard',sans-serif;min-width:120px;"><div style="font-weight:700;font-size:12px;">${icon} ${pin.name}</div><div style="font-size:10px;color:#7a8570;">공공 데이터</div></div>`, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(100,111,75,0.2)' });
      n.maps.Event.addListener(marker, 'click', () => { if (info.getMap()) info.close(); else info.open(mapRef.current, marker); });
      osmPinMarkersRef.current.push(marker);
    });
  }, [osmPins, activeFilters]);

  if (loading) return (
    <div className={styles.mapPlaceholder}><span style={{ fontSize: 36 }}>📍</span><span>현재 위치 확인 중...</span></div>
  );
  return <div id="naverMapEl" className={styles.mapEl} />;
}

async function loadNoisePins(map: any, lat: number, lng: number, n: any, pinsRef: React.MutableRefObject<any[]>, onPinsLoaded?: () => void) {
  try {
    const res = await fetch(`/api/noise-reports?lat=${lat}&lng=${lng}`);
    const json = await res.json();
    if (pinsRef?.current) { pinsRef.current.forEach((p: any) => p.marker?.setMap(null)); pinsRef.current = []; }
    if (!json.success || !json.data?.length) { onPinsLoaded?.(); return; }
    const tLabel: Record<string, string> = { dawn: '새벽', morning: '오전', afternoon: '오후', evening: '저녁', night: '심야' };
    const nLabel: Record<string, string> = { construction: '공사 소음', entertainment: '유흥 소음', floor: '층간소음', traffic: '교통 소음', other: '기타 소음' };
    json.data.forEach((r: any) => {
      const cfg = PIN_CONFIG[r.noise_type] ?? PIN_CONFIG.other;
      const sz = 24 + r.severity * 2;
      const html = `<div style="background:${cfg.color};width:${sz}px;height:${sz}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-size:${sz * 0.42}px;box-shadow:0 2px 8px rgba(0,0,0,.2);border:2px solid rgba(255,255,255,.9);cursor:pointer;"><span style="transform:rotate(45deg)">${cfg.icon}</span></div>`;
      const marker = new n.maps.Marker({ map, position: new n.maps.LatLng(r.lat, r.lng), icon: { content: html, anchor: new n.maps.Point(sz / 2, sz) } });
      const info = new n.maps.InfoWindow({
        content: `
          <div style="padding:10px 14px;font-family:'Pretendard',sans-serif;min-width:170px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${cfg.icon} ${nLabel[r.noise_type] ?? '소음'}</div>
            <div style="font-size:11px;color:#7a8570;">시간대: ${tLabel[r.time_slot] ?? ''}</div>
            <div style="font-size:11px;color:#7a8570;margin-bottom:4px;">심각도: ${'★'.repeat(r.severity)}${'☆'.repeat(5 - r.severity)}</div>
            <div style="font-size:10px;color:#aaa;margin-bottom:8px;">${new Date(r.created_at).toLocaleDateString('ko-KR')}</div>
            <button
              style="font-size:10px;color:#c0392b;background:#fff5f5;border:1px solid #f5c6cb;border-radius:6px;padding:4px 8px;cursor:pointer;width:100%;text-align:left;"
              onclick="window.__moveiq_reportNoise && window.__moveiq_reportNoise('${r.id}')"
            >🚩 허위 제보 신고</button>
          </div>
        `,
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(100,111,75,0.2)'
      });
      n.maps.Event.addListener(marker, 'click', () => { if (info.getMap()) info.close(); else info.open(map, marker); });
      if (pinsRef?.current) pinsRef.current.push({ marker, noise_type: r.noise_type, time_slot: r.time_slot });
    });
    onPinsLoaded?.();
  } catch { onPinsLoaded?.(); }
}

// ── 메인 ──────────────────────────────────────────────────
export default function NoiseMapPage() {
  const [userLat, setUserLat]   = useState<number | null>(null);
  const [userLng, setUserLng]   = useState<number | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [reverseGeo, setReverseGeo]   = useState(false);
  const [noiseStats, setNoiseStats]   = useState<Record<string, number> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [timeSlotIdx, setTimeSlotIdx]     = useState(-1);
  const [mapView, setMapView]     = useState<'pin' | 'heat'>('pin');
  const [osmPins, setOsmPins]     = useState<any[]>([]);
  const [pinReloadKey, setPinReloadKey] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportOk, setReportOk]     = useState(false);
  // 소음 제보 신고 상태
  const [flagOpen,     setFlagOpen]     = useState(false);
  const [flagTargetId, setFlagTargetId] = useState<string>('');
  const [flagReason,   setFlagReason]   = useState('fake');
  const [flagLoading,  setFlagLoading]  = useState(false);
  const [flagResult,   setFlagResult]   = useState<'ok'|'dup'|null>(null);
  const [reportLat, setReportLat]   = useState<number | null>(null);
  const [reportLng, setReportLng]   = useState<number | null>(null);
  // 사진 첨부 상태
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError,   setPhotoError]   = useState<string>('');
  // 소음 알림 기능
  const [watchedAddresses, setWatchedAddresses]   = useState<{ address: string; lat: number; lng: number }[]>([]);
  const [notifPermission, setNotifPermission]     = useState<NotificationPermission>('default');
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const ex = localStorage.getItem('moveiq_session_id');
    if (ex) return ex;
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem('moveiq_session_id', id);
    return id;
  });

  // 글로벌 신고 핸들러 등록 (NaverMap InfoWindow의 onclick에서 호출)
  useEffect(() => {
    (window as any).__moveiq_reportNoise = (id: string) => {
      setFlagTargetId(id);
      setFlagReason('fake');
      setFlagResult(null);
      setFlagOpen(true);
    };
    return () => { delete (window as any).__moveiq_reportNoise; };
  }, []);

  useEffect(() => {
    // 알림 권한 상태 확인
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    // 관심 주소 불러오기
    try {
      const saved = JSON.parse(localStorage.getItem('moveiq_watched') ?? '[]');
      if (saved.length) setWatchedAddresses(saved);
    } catch {}
    // 위치 요청
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
      checkAlerts(lat, lng, counts);
    } catch { /* silent */ } finally { setStatsLoading(false); }
  }

  async function requestNotif() {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    setNotifPermission(p);
  }

  function addWatch() {
    if (!searchInput.trim() || userLat == null || userLng == null) return;
    const entry = { address: searchInput.trim(), lat: userLat, lng: userLng };
    const next = [...watchedAddresses.filter(w => w.address !== entry.address), entry];
    setWatchedAddresses(next);
    localStorage.setItem('moveiq_watched', JSON.stringify(next));
  }

  function removeWatch(address: string) {
    const next = watchedAddresses.filter(w => w.address !== address);
    setWatchedAddresses(next);
    localStorage.setItem('moveiq_watched', JSON.stringify(next));
  }

  function checkAlerts(lat: number, lng: number, stats: Record<string, number>) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    if (total > 0) {
      const key = `moveiq_alert_${lat.toFixed(3)}_${lng.toFixed(3)}`;
      const prev = Number(localStorage.getItem(key) ?? 0);
      if (total > prev) {
        new Notification('🔊 무브IQ 소음 알림', { body: `관심 지역에 소음 데이터 ${total}건 감지됨.`, icon: '/favicon.ico' });
        localStorage.setItem(key, String(total));
      }
    }
  }

  async function handleMapClick(cLat: number, cLng: number) {
    setReportLat(cLat); setReportLng(cLng);
    setUserLat(cLat); setUserLng(cLng);
    setReverseGeo(true);
    loadNoiseStats(cLat, cLng);
    try {
      const res = await fetch(`/api/geocode?lat=${cLat}&lng=${cLng}`);
      const json = await res.json();
      if (json.success && json.roadAddress) setSearchInput(json.roadAddress);
    } catch { /* silent */ } finally { setReverseGeo(false); }
  }

  async function searchLocation() {
    const addr = searchInput.trim();
    if (!addr) return;
    setLocLoading(true);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`);
      const json = await res.json();
      if (json.lat && json.lng) { setUserLat(json.lat); setUserLng(json.lng); loadNoiseStats(json.lat, json.lng); }
      else alert('주소를 찾을 수 없습니다. 다시 확인해 주세요.');
    } catch { alert('검색 중 오류가 발생했습니다.'); }
    finally { setLocLoading(false); }
  }

  // 사진 선택 핸들러
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhotoError('');
    if (!file) { setPhotoFile(null); setPhotoPreview(null); return; }
    // MIME 검증
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('JPEG, PNG 파일만 첨부 가능합니다.'); return;
    }
    // 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('파일 크기는 5MB 이하여야 합니다.'); return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // 소음 제보 허위 신고 처리
  async function submitNoiseFlag() {
    if (!flagTargetId) return;
    setFlagLoading(true);
    try {
      const res = await fetch('/api/noise-reports/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noise_report_id: flagTargetId, reason: flagReason }),
      });
      const json = await res.json();
      if (json.already_reported) {
        setFlagResult('dup');
      } else {
        setFlagResult('ok');
        // 블라인드 처리된 경우 핀 리로드
        if (json.blinded) setPinReloadKey(k => k + 1);
      }
    } catch {
      setFlagResult(null);
      alert('신고 처리 중 오류가 발생했습니다.');
    } finally {
      setFlagLoading(false);
    }
  }

  async function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      const sLat = reportLat ?? userLat ?? 37.5665;
      const sLng = reportLng ?? userLng ?? 126.9780;

      // 사진이 있으면 multipart/form-data, 없으면 JSON
      let res: Response;
      if (photoFile) {
        const fd = new FormData();
        fd.append('noise_type',  String(d.get('noise_type')));
        fd.append('time_slot',   String(d.get('time_slot')));
        fd.append('severity',    String(d.get('severity')));
        fd.append('lat',         String(sLat));
        fd.append('lng',         String(sLng));
        fd.append('description', String(d.get('description') ?? ''));
        fd.append('photo',       photoFile);
        res = await fetch('/api/noise-reports', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/noise-reports', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noise_type: d.get('noise_type'), time_slot: d.get('time_slot'), severity: Number(d.get('severity')), lat: sLat, lng: sLng, description: d.get('description') }),
        });
      }

      const json = await res.json();
      if (json.success) {
        setReportOk(true);
        setPinReloadKey(k => k + 1);
        loadNoiseStats(sLat, sLng);
        // 초기화
        setPhotoFile(null); setPhotoPreview(null); setPhotoError('');
      } else alert(json.message);
    } catch { alert('제보 저장에 실패했습니다.'); }
  }

  return (
    <div className={styles.root}>
      {/* 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo}><div className={styles.logoMark} /><span>무브IQ</span></Link>
          <form className={styles.searchForm} onSubmit={e => { e.preventDefault(); searchLocation(); }}>
            <input
              value={reverseGeo ? '주소 불러오는 중...' : searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="지도 클릭 또는 주소 입력"
              readOnly={reverseGeo}
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

      <div className={styles.layout}>
        {/* ── 사이드바 ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            <div className={styles.sidebarSection}>
              <div className={styles.sectionTitle}>🔊 실시간 소음 지도</div>
              <p className={styles.sectionDesc}>현재 위치 기준 소음 제보 현황입니다. 핀을 클릭해 상세 정보를 확인하세요.</p>
              <p className={styles.mapHint}>💡 지도를 클릭하면 해당 위치로 자동 검색됩니다</p>
            </div>

            {/* 소음 통계 */}
            <div className={styles.statsBox}>
              {statsLoading ? (
                <div className={styles.statsLoading}>현황 불러오는 중...</div>
              ) : noiseStats ? (
                [
                  ['🎵 유흥 소음', noiseStats.entertainment, '#333'],
                  ['🏗️ 공사 소음', noiseStats.construction,  'var(--main)'],
                  ['🚗 교통 소음', noiseStats.traffic,        'var(--muted)'],
                  ['🏠 층간소음',  noiseStats.floor,          'var(--muted)'],
                  ['🐕 기타 소음', noiseStats.other,          'var(--muted)'],
                ].map(([l, v, c]) => (
                  <div key={l as string} className={styles.statsRow}>
                    <span>{l}</span>
                    <strong style={{ color: (v as number) > 0 ? c as string : 'var(--muted2)' }}>
                      {(v as number) > 0 ? `${v}건` : '없음'}
                    </strong>
                  </div>
                ))
              ) : (
                <div className={styles.statsLoading}>위치 확인 후 표시됩니다.</div>
              )}
            </div>

            {/* 소음 알림 */}
            <div className={styles.alertSection}>
              <div className={styles.alertTitle}>
                🔔 소음 알림
                {notifPermission !== 'granted' && (
                  <button className={styles.btnAlertPermit} onClick={requestNotif}>알림 허용</button>
                )}
              </div>
              {notifPermission === 'denied' && <p className={styles.alertDenied}>브라우저 설정에서 알림을 허용해주세요.</p>}
              {searchInput.trim() && userLat != null && (
                <button className={styles.btnAddWatch} onClick={addWatch}>
                  📌 "{searchInput.trim().slice(0, 14)}{searchInput.trim().length > 14 ? '…' : ''}" 알림 등록
                </button>
              )}
              {watchedAddresses.length > 0 ? (
                <ul className={styles.watchList}>
                  {watchedAddresses.map(w => (
                    <li key={w.address} className={styles.watchItem}>
                      <button className={styles.watchAddr} onClick={() => { setUserLat(w.lat); setUserLng(w.lng); setSearchInput(w.address); loadNoiseStats(w.lat, w.lng); }}>
                        📍 {w.address.slice(0, 20)}{w.address.length > 20 ? '…' : ''}
                      </button>
                      <button className={styles.watchDel} onClick={() => removeWatch(w.address)}>✕</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.watchEmpty}>주소를 검색한 후 알림을 등록하세요.</p>
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

            <button className={styles.btnReport} onClick={() => setReportOpen(true)}>+ 소음 제보하기</button>
          </div>
        </aside>

        {/* ── 지도 영역 ── */}
        <div className={styles.mapArea}>
          <div className={styles.toolbar}>
            <div className={styles.filterChips}>
              {(Object.keys(FILTER_TYPE_MAP) as string[]).map(f => {
                const type = FILTER_TYPE_MAP[f];
                const isOn = activeFilters.length === 0 || activeFilters.includes(type);
                return (
                  <button key={f} className={`${styles.chip} ${isOn ? styles.chipOn : styles.chipOff}`}
                    onClick={() => setActiveFilters(prev => {
                      if (prev.length === 0) return [type];
                      const next = prev.filter(t => t !== type);
                      return next;
                    })}>
                    {f}
                  </button>
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
            onCenterChange={() => {}}
            onMapClick={handleMapClick}
            activeFilters={activeFilters}
            timeSlot={timeSlotIdx >= 0 ? TIME_SLOTS[timeSlotIdx] : 'all'}
            showHeat={mapView === 'heat'}
            osmPins={osmPins}
            pinReloadKey={pinReloadKey}
          />

          <div className={styles.timeBar}>
            <div className={styles.timeBarLabel}>
              시간대 필터
              {timeSlotIdx >= 0 && <button className={styles.btnReset} onClick={() => setTimeSlotIdx(-1)}>전체 보기</button>}
            </div>
            <input type="range" min="-1" max="4" value={timeSlotIdx} onChange={e => setTimeSlotIdx(Number(e.target.value))} className={styles.timeRange} />
            <div className={styles.timeTicks}>
              {['전체', '새벽', '오전', '오후', '저녁', '심야'].map((t, i) => (
                <span key={t} style={{ color: timeSlotIdx === i - 1 ? 'var(--main)' : '', fontWeight: timeSlotIdx === i - 1 ? '700' : '' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button className={styles.fab} onClick={() => setReportOpen(true)}>+ 소음 제보하기</button>

      {/* 모바일 하단 네비 */}
      <nav className={styles.mobileNav}>
        <Link href="/"          className={styles.mobileNavBtn}><span>🏠</span>홈</Link>
        <Link href="/noise-map" className={`${styles.mobileNavBtn} ${styles.mobileNavActive}`}><span>🔊</span>소음 지도</Link>
        <button className={styles.mobileNavBtn} onClick={() => setReportOpen(true)}><span>📝</span>제보</button>
        <Link href="/analysis"  className={styles.mobileNavBtn}><span>🏙️</span>입지 분석</Link>
        <Link href="/community" className={styles.mobileNavBtn}><span>💬</span>커뮤니티</Link>
      </nav>

      {/* 허위 제보 신고 모달 */}
      {flagOpen && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) { setFlagOpen(false); setFlagResult(null); } }}>
          <div className={styles.modal} style={{ maxWidth: 360 }}>
            <div className={styles.modalHead}>
              <h3>🚩 허위 제보 신고</h3>
              <button onClick={() => { setFlagOpen(false); setFlagResult(null); }}>✕</button>
            </div>
            {flagResult === 'ok' ? (
              <div className={styles.successState}>
                <div>✅</div>
                <h3>신고 접수 완료</h3>
                <p>검토 후 처리됩니다.<br/>3건 누적 시 자동으로 블라인드 처리됩니다.</p>
                <button onClick={() => { setFlagOpen(false); setFlagResult(null); }} className={styles.btnSubmit}>닫기</button>
              </div>
            ) : flagResult === 'dup' ? (
              <div className={styles.successState}>
                <div>ℹ️</div>
                <h3>이미 신고한 제보입니다</h3>
                <p>동일 제보에 중복으로 신고할 수 없습니다.</p>
                <button onClick={() => { setFlagOpen(false); setFlagResult(null); }} className={styles.btnSubmit}>닫기</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  허위·어뷰징 제보를 신고해 주세요.<br/>
                  <strong>3건 누적 시 자동으로 숨김 처리</strong>됩니다.
                </p>
                <div className={styles.formGroup}>
                  <label>신고 사유</label>
                  <select
                    value={flagReason}
                    onChange={e => setFlagReason(e.target.value)}
                    className={styles.formInput}
                  >
                    <option value="fake">허위 정보 / 사실과 다름</option>
                    <option value="spam">도배 / 스팸</option>
                    <option value="inappropriate">부적절한 내용</option>
                    <option value="duplicate">중복 제보</option>
                    <option value="other">기타</option>
                  </select>
                </div>
                <button
                  className={styles.btnSubmit}
                  onClick={submitNoiseFlag}
                  disabled={flagLoading}
                  style={{ marginTop: 8 }}
                >
                  {flagLoading ? '신고 처리 중...' : '신고하기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 제보 모달 */}
      {reportOpen && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) { setReportOpen(false); setReportOk(false); } }}>
          <div className={styles.modal}>
            {!reportOk ? (
              <>
                <div className={styles.modalHead}><h3>🔊 소음 제보하기</h3><button onClick={() => { setReportOpen(false); setReportOk(false); }}>✕</button></div>
                <div className={styles.reportLoc}>
                  {reportLat != null
                    ? <><span className={`${styles.locDot} ${styles.locDotGreen}`} /><span>📍 지도 클릭 위치 ({reportLat.toFixed(4)}, {reportLng?.toFixed(4)})</span></>
                    : <><span className={styles.locDot} /><span>📍 현재 위치 기준 — 지도를 클릭해 위치를 변경할 수 있습니다</span></>
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
                  {/* 사진 첨부 */}
                  <div className={styles.formGroup}>
                    <label>사진 첨부 (선택)</label>
                    <label className={styles.photoLabel} htmlFor="noise-photo-input">
                      {photoPreview
                        ? <img src={photoPreview} alt="첨부 미리보기" className={styles.photoPreview} />
                        : <span className={styles.photoPlaceholder}>📷 사진 추가 (JPEG/PNG, 최대 5MB)</span>
                      }
                    </label>
                    <input
                      id="noise-photo-input"
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handlePhotoSelect}
                      style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}
                    />
                    {photoError && <p className={styles.photoError}>{photoError}</p>}
                    {photoPreview && (
                      <button
                        type="button"
                        className={styles.photoRemove}
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoError(''); }}
                      >✕ 사진 제거</button>
                    )}
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
