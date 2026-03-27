// lib/public-data.ts
// ────────────────────────────────────────────────────────────
// 공공데이터 통합 수집 모듈 v2
//
// 소스 1 — 브이월드 (디지털트윈국토) Data API 2.0
//   GetFeature 엔드포인트: https://api.vworld.kr/req/data
//   활용 레이어:
//     LT_C_UD801  — 개발제한구역 (그린벨트)
//     LT_C_UQ111  — 용도지역지구 (주거/상업/공업/녹지/관리 등)
//     LT_C_UQ114  — 도시계획시설 (도로·공원·학교·의료 등 계획시설)
//     LT_C_UQ141  — 도시계획도로 (계획·미개설 도로)
//     LT_C_LHZONE — 지구단위계획구역 (재개발·재건축 포함)
//     LT_C_UQ113  — 개발행위허가제한지역
//     BL_DSAS_    — 재해위험지구
//     WF_FIRE_SVC — 소방서 관할구역
//
// 소스 2 — 건설CALS (calspia.go.kr)
//   OpenAPI 인증키: 환경변수 CALS_API_KEY
//   활용 서비스: 공사현황 목록 (건설인허가 포함)
//     - 공사명, 공사위치, 시작일, 종료일, 발주기관, 공사금액
//     - 진행중 공사 필터링 → 소음·환경 / 개발 잠재력 반영
//
// 소스 3 — data.go.kr (국토교통부 OpenAPI)
//   활용 서비스:
//     - 건축인허가 (신축·증축·대수선)
//     - 개발행위허가
//     - 아파트 매매 실거래가
//     - 잠재력 등급 (시군구 단위)
//     - 평균 통행시간
// ────────────────────────────────────────────────────────────

export interface PublicDataResult {
  // ── 소음·환경 ──
  active_constructions: number;      // 진행중 공사 수 (CALS)
  construction_details: string[];    // 공사명 목록 (최대 3개)
  disaster_risk: boolean;            // 재해위험지구 여부 (브이월드)
  fire_station_dist: string | null;  // 인근 소방서명

  // ── 개발 잠재력 ──
  dev_restriction: boolean;          // 개발제한구역(그린벨트)
  urban_zone: string | null;         // 용도지역 (제1종일반주거지역 등)
  district_plan: string | null;      // 지구단위계획 (재개발 포함)
  dev_act_restricted: boolean;       // 개발행위허가제한지역
  urban_facility: string[];          // 도시계획시설 종류 목록
  urban_road_plan: boolean;          // 도시계획도로 계획 여부
  redevelop_potential: number;       // 잠재력 등급 1~5
  building_permits_1y: number;       // 건축인허가 1년 건수
  dev_permits_1y: number;            // 개발행위허가 1년 건수

  // ── 교통 ──
  avg_travel_time: number | null;    // 평균 통행시간(분)

  // ── 상권 ──
  apt_avg_price: number | null;      // 아파트 평균 매매가(만원)

  // ── Claude 프롬프트용 요약 ──
  summary: string;
}

// ── 공통 헬퍼: 브이월드 GetFeature ──────────────────────────
async function vworldGetFeature(
  key: string,
  layerId: string,
  lat: number,
  lng: number,
  buffer = 0,
  size = 1,
): Promise<any[]> {
  try {
    const url =
      `https://api.vworld.kr/req/data?service=data&request=GetFeature` +
      `&data=${layerId}&key=${key}` +
      `&geomFilter=POINT(${lng} ${lat})` +
      (buffer > 0 ? `&buffer=${buffer}` : '') +
      `&format=json&size=${size}&geometry=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    return json?.response?.result?.featureCollection?.features ?? [];
  } catch {
    return [];
  }
}

// ── 소스 1: 브이월드 ─────────────────────────────────────────
async function fetchVworld(lat: number, lng: number): Promise<Partial<PublicDataResult>> {
  const key = process.env.VWORLD_API_KEY;
  if (!key) return {};

  const result: Partial<PublicDataResult> = {};

  const [
    grBelt,        // 개발제한구역
    urbanZone,     // 용도지역지구
    urbanFacility, // 도시계획시설
    urbanRoad,     // 도시계획도로
    districtPlan,  // 지구단위계획구역
    devActRestr,   // 개발행위허가제한지역
    disasterRisk,  // 재해위험지구
    fireStation,   // 소방서 관할구역
  ] = await Promise.all([
    vworldGetFeature(key, 'LT_C_UD801',   lat, lng, 0,   1),
    vworldGetFeature(key, 'LT_C_UQ111',   lat, lng, 0,   1),
    vworldGetFeature(key, 'LT_C_UQ114',   lat, lng, 500, 10),
    vworldGetFeature(key, 'LT_C_UQ141',   lat, lng, 500, 1),
    vworldGetFeature(key, 'LT_C_LHZONE',  lat, lng, 0,   1),
    vworldGetFeature(key, 'LT_C_UQ113',   lat, lng, 0,   1),
    vworldGetFeature(key, 'BL_DSAS_',     lat, lng, 500, 1),
    vworldGetFeature(key, 'WF_FIRE_SVC',  lat, lng, 0,   1),
  ]);

  // 개발제한구역
  result.dev_restriction = grBelt.length > 0;

  // 용도지역 (속성명: UFD_NM 또는 UQ_NM 등 레이어마다 다름)
  const zoneProp = urbanZone[0]?.properties;
  result.urban_zone =
    zoneProp?.UFD_NM ?? zoneProp?.UQ_NM ?? zoneProp?.ZONE_NM ?? null;

  // 도시계획시설 종류 (속성: FCLTS_NM 또는 UQ_NM)
  result.urban_facility = urbanFacility
    .map((f: any) => f.properties?.FCLTS_NM ?? f.properties?.UQ_NM ?? '')
    .filter(Boolean)
    .slice(0, 5);

  // 도시계획도로 계획 여부
  result.urban_road_plan = urbanRoad.length > 0;

  // 지구단위계획구역 (재개발·재건축 포함)
  const dpProp = districtPlan[0]?.properties;
  result.district_plan =
    dpProp?.ZONE_NM ?? dpProp?.DT_NM ?? dpProp?.JI_GU_NM ?? null;

  // 개발행위허가제한지역
  result.dev_act_restricted = devActRestr.length > 0;

  // 재해위험지구
  result.disaster_risk = disasterRisk.length > 0;

  // 소방서 관할구역
  const fireProp = fireStation[0]?.properties;
  result.fire_station_dist =
    fireProp?.FIRE_SVC_NM ?? fireProp?.ORG_NM ?? null;

  return result;
}

// ── 소스 2: 건설CALS ─────────────────────────────────────────
async function fetchCals(lat: number, lng: number): Promise<Partial<PublicDataResult>> {
  const key = process.env.CALS_API_KEY;
  if (!key) return { active_constructions: 0, construction_details: [] };

  try {
    // 공사현황 목록 조회 — 반경 1km, 진행중 공사
    // CALS OpenAPI: /openApiSvc/selectConstrWrkList
    const res = await fetch(
      `https://www.calspia.go.kr/openApiSvc/selectConstrWrkList` +
      `?authKey=${key}&lat=${lat}&lon=${lng}&radius=1000` +
      `&wrkStts=ING&pageNo=1&numOfRows=20`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    const items: any[] = data?.list ?? data?.items ?? data?.data ?? [];

    const names = items
      .map((i: any) => i.constrWrkNm ?? i.wrkNm ?? i.constrNm ?? '')
      .filter(Boolean)
      .slice(0, 3);

    return {
      active_constructions: items.length,
      construction_details: names,
    };
  } catch {
    return { active_constructions: 0, construction_details: [] };
  }
}

// ── 소스 3: data.go.kr ───────────────────────────────────────
async function fetchDataGov(lat: number, lng: number, address: string): Promise<Partial<PublicDataResult>> {
  const key = process.env.PUBLIC_DATA_API_KEY;
  if (!key) return {};

  const result: Partial<PublicDataResult> = {};
  const sigungu = address.split(' ')[0] ?? '';

  await Promise.all([
    // 1. 잠재력 등급 (시군구 단위)
    (async () => {
      try {
        const res = await fetch(
          `https://apis.data.go.kr/1613000/PotentialGradeService/getPotentialGradeList` +
          `?serviceKey=${key}&sigungu=${encodeURIComponent(sigungu)}&numOfRows=1&pageNo=1&type=json`,
          { signal: AbortSignal.timeout(5000) }
        );
        const data = await res.json();
        const grade = data?.response?.body?.items?.item?.[0]?.potentialGrade;
        result.redevelop_potential = grade ? parseInt(grade, 10) : 3;
      } catch { result.redevelop_potential = 3; }
    })(),

    // 2. 건축인허가 1년 건수
    (async () => {
      try {
        const fromDate = new Date();
        fromDate.setFullYear(fromDate.getFullYear() - 1);
        const fromStr = fromDate.toISOString().slice(0, 10).replace(/-/g, '');
        const res = await fetch(
          `https://apis.data.go.kr/1613000/ArchPmsService/getApBasisOulnInfo` +
          `?serviceKey=${key}&sigunguCd=${encodeURIComponent(sigungu)}` +
          `&searchStartDt=${fromStr}&numOfRows=1&pageNo=1&type=json`,
          { signal: AbortSignal.timeout(5000) }
        );
        const data = await res.json();
        result.building_permits_1y = data?.response?.body?.totalCount ?? 0;
      } catch { result.building_permits_1y = 0; }
    })(),

    // 3. 개발행위허가 1년 건수
    (async () => {
      try {
        const res = await fetch(
          `https://apis.data.go.kr/1613000/DevActs2Service/getDevActsList` +
          `?serviceKey=${key}&sigunguNm=${encodeURIComponent(sigungu)}&numOfRows=1&pageNo=1&type=json`,
          { signal: AbortSignal.timeout(5000) }
        );
        const data = await res.json();
        result.dev_permits_1y = data?.response?.body?.totalCount ?? 0;
      } catch { result.dev_permits_1y = 0; }
    })(),

    // 4. 아파트 평균 매매가
    (async () => {
      try {
        const now = new Date();
        const dealYmd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const res = await fetch(
          `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev` +
          `?serviceKey=${key}&LAWD_CD=${encodeURIComponent(sigungu)}` +
          `&DEAL_YMD=${dealYmd}&numOfRows=100&pageNo=1`,
          { signal: AbortSignal.timeout(5000) }
        );
        const text = await res.text();
        const regex = /<거래금액>([\d,]+)<\/거래금액>/g;
        const prices: number[] = [];
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
          const v = parseInt(m[1].replace(/,/g, ''), 10);
          if (!isNaN(v)) prices.push(v);
        }
        result.apt_avg_price = prices.length
          ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
          : null;
      } catch { result.apt_avg_price = null; }
    })(),

    // 5. 평균 통행시간
    (async () => {
      try {
        const res = await fetch(
          `https://apis.data.go.kr/1613000/TravelTimeService/getTravelTimeList` +
          `?serviceKey=${key}&sigunguNm=${encodeURIComponent(sigungu)}&numOfRows=1&pageNo=1&type=json`,
          { signal: AbortSignal.timeout(5000) }
        );
        const data = await res.json();
        const time = data?.response?.body?.items?.item?.[0]?.avgTravelTime;
        result.avg_travel_time = time ? parseFloat(time) : null;
      } catch { result.avg_travel_time = null; }
    })(),
  ]);

  return result;
}

// ── 메인 함수 — 3개 소스 병렬 수집 후 합산 ──────────────────
export async function fetchPublicData(
  lat: number,
  lng: number,
  address: string,
): Promise<PublicDataResult | null> {
  try {
    const [vworld, cals, dataGov] = await Promise.all([
      fetchVworld(lat, lng),
      fetchCals(lat, lng),
      fetchDataGov(lat, lng, address),
    ]);

    const merged: PublicDataResult = {
      // 소음·환경
      active_constructions:  cals.active_constructions   ?? 0,
      construction_details:  cals.construction_details   ?? [],
      disaster_risk:         vworld.disaster_risk         ?? false,
      fire_station_dist:     vworld.fire_station_dist     ?? null,

      // 개발 잠재력
      dev_restriction:       vworld.dev_restriction       ?? false,
      urban_zone:            vworld.urban_zone            ?? null,
      district_plan:         vworld.district_plan         ?? null,
      dev_act_restricted:    vworld.dev_act_restricted    ?? false,
      urban_facility:        vworld.urban_facility        ?? [],
      urban_road_plan:       vworld.urban_road_plan       ?? false,
      redevelop_potential:   dataGov.redevelop_potential  ?? 3,
      building_permits_1y:   dataGov.building_permits_1y ?? 0,
      dev_permits_1y:        dataGov.dev_permits_1y       ?? 0,

      // 교통
      avg_travel_time:       dataGov.avg_travel_time      ?? null,

      // 상권
      apt_avg_price:         dataGov.apt_avg_price        ?? null,

      summary: '',
    };

    // ── 요약 텍스트 생성 (Claude 프롬프트용) ──────────────────
    const parts: string[] = [];

    // 소음·환경
    if (merged.active_constructions > 0) {
      parts.push(`현재 진행중 공사 ${merged.active_constructions}건`
        + (merged.construction_details.length
          ? ` (${merged.construction_details.join(', ')})` : ''));
    }
    if (merged.disaster_risk)       parts.push('재해위험지구 내 위치');
    if (merged.fire_station_dist)   parts.push(`소방서 관할: ${merged.fire_station_dist}`);

    // 개발 잠재력
    if (merged.dev_restriction)     parts.push('개발제한구역(그린벨트) 내 — 개발 불가');
    if (merged.urban_zone)          parts.push(`용도지역: ${merged.urban_zone}`);
    if (merged.district_plan)       parts.push(`지구단위계획: ${merged.district_plan}`);
    if (merged.dev_act_restricted)  parts.push('개발행위허가제한지역');
    if (merged.urban_facility.length)
      parts.push(`도시계획시설: ${merged.urban_facility.join(', ')}`);
    if (merged.urban_road_plan)     parts.push('도시계획도로 계획구역 인근');
    parts.push(`잠재력 등급 ${merged.redevelop_potential}등급`);
    parts.push(`건축인허가 1년 ${merged.building_permits_1y}건`);
    parts.push(`개발행위허가 ${merged.dev_permits_1y}건`);

    // 교통
    if (merged.avg_travel_time)     parts.push(`평균 통행시간 ${merged.avg_travel_time}분`);

    // 상권
    if (merged.apt_avg_price)
      parts.push(`아파트 평균 매매가 ${merged.apt_avg_price.toLocaleString()}만원`);

    merged.summary = parts.join(' / ');
    return merged;

  } catch {
    return null;
  }
}
