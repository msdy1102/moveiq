// lib/public-data.ts
// ────────────────────────────────────────────────────────────
// 공공데이터 수집 모듈
// 출처 3곳:
//   1. 브이월드 (디지털트윈국토) — 개발제한구역, 도시지역, 도시계획시설
//   2. 건설CALS  — 공사중인 시설물(교량/옹벽/절개사면 등)
//   3. data.go.kr (국토교통부) — 건축인허가, 개발행위허가, 잠재력등급,
//                                아파트 실거래가, 평균통행시간
// ────────────────────────────────────────────────────────────

export interface PublicDataResult {
  // 개발 잠재력
  dev_restriction: boolean;        // 개발제한구역 여부
  urban_zone: string | null;       // 도시지역 용도 (주거/상업/공업/녹지)
  redevelop_potential: number;     // 잠재력 등급 (1~5, 높을수록 좋음)
  building_permits_1y: number;     // 최근 1년 건축인허가 건수
  dev_permits_1y: number;          // 최근 1년 개발행위허가 건수

  // 교통
  avg_travel_time: number | null;  // 평균 통행시간(분)

  // 소음/환경 (공사)
  active_constructions: number;    // 현재 공사중 시설물 수

  // 상권
  apt_avg_price: number | null;    // 아파트 평균 매매가(만원/㎡)

  // 요약 텍스트 (Claude 프롬프트용)
  summary: string;
}

// ── 브이월드 API (디지털트윈국토) ────────────────────────────
// 좌표계: WGS84 (lat/lng)
async function fetchVworld(lat: number, lng: number): Promise<Partial<PublicDataResult>> {
  const key = process.env.VWORLD_API_KEY;
  if (!key) return {};

  const result: Partial<PublicDataResult> = {};

  try {
    // 1. 개발제한구역 조회
    const grBeltRes = await fetch(
      `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_C_UQ111&key=${key}` +
      `&geomFilter=POINT(${lng} ${lat})&buffer=100&format=json&size=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    const grBeltData = await grBeltRes.json();
    result.dev_restriction = (grBeltData?.response?.result?.featureCollection?.totalCount ?? 0) > 0;

    // 2. 도시지역 용도 조회 (국토계획구역)
    const urbanRes = await fetch(
      `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_C_UQ111&key=${key}` +
      `&geomFilter=POINT(${lng} ${lat})&buffer=0&format=json&size=1&attrFilter=UFD_NM:like:`,
      { signal: AbortSignal.timeout(5000) }
    );
    const urbanData = await urbanRes.json();
    const features = urbanData?.response?.result?.featureCollection?.features;
    result.urban_zone = features?.[0]?.properties?.UFD_NM ?? null;

  } catch {
    // 실패 시 기본값 유지
  }

  return result;
}

// ── 건설CALS API ─────────────────────────────────────────────
// 공사중인 시설물 수 조회
async function fetchCals(lat: number, lng: number): Promise<Partial<PublicDataResult>> {
  const key = process.env.CALS_API_KEY;
  if (!key) return {};

  try {
    // 반경 1km 내 공사중 시설물 (교량, 옹벽, 절개사면 합산)
    const types = ['BRIDGE', 'RETAINING_WALL', 'CUT_SLOPE'];
    let total = 0;

    await Promise.all(types.map(async (type) => {
      try {
        const res = await fetch(
          `https://www.calspia.go.kr/openapi/rest/facility/list?authKey=${key}` +
          `&facilityType=${type}&lat=${lat}&lon=${lng}&radius=1000&pageNo=1&numOfRows=1`,
          { signal: AbortSignal.timeout(5000) }
        );
        const data = await res.json();
        total += parseInt(data?.totalCount ?? '0', 10);
      } catch { /* 개별 실패 무시 */ }
    }));

    return { active_constructions: total };
  } catch {
    return { active_constructions: 0 };
  }
}

// ── data.go.kr (국토교통부) ───────────────────────────────────
async function fetchDataGov(lat: number, lng: number, address: string): Promise<Partial<PublicDataResult>> {
  const key = process.env.PUBLIC_DATA_API_KEY;
  if (!key) return {};

  const result: Partial<PublicDataResult> = {};

  // 주소에서 시군구 추출 (예: "마포구 성산동" → "마포구")
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

    // 2. 건축인허가 (최근 1년, 반경 내)
    (async () => {
      try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const fromDate = oneYearAgo.toISOString().slice(0, 10).replace(/-/g, '');

        const res = await fetch(
          `https://apis.data.go.kr/1613000/ArchPmsService/getApBasisOulnInfo` +
          `?serviceKey=${key}&sigunguCd=${encodeURIComponent(sigungu)}` +
          `&searchStartDt=${fromDate}&numOfRows=1&pageNo=1&type=json`,
          { signal: AbortSignal.timeout(5000) }
        );
        const data = await res.json();
        result.building_permits_1y = data?.response?.body?.totalCount ?? 0;
      } catch { result.building_permits_1y = 0; }
    })(),

    // 3. 개발행위허가
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

    // 4. 아파트 평균 매매가 (최근 3개월)
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
        // XML 파싱 (data.go.kr 아파트 API는 XML 반환)
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
      dev_restriction:      vworld.dev_restriction      ?? false,
      urban_zone:           vworld.urban_zone           ?? null,
      redevelop_potential:  dataGov.redevelop_potential ?? 3,
      building_permits_1y:  dataGov.building_permits_1y ?? 0,
      dev_permits_1y:       dataGov.dev_permits_1y      ?? 0,
      avg_travel_time:      dataGov.avg_travel_time     ?? null,
      active_constructions: cals.active_constructions   ?? 0,
      apt_avg_price:        dataGov.apt_avg_price       ?? null,
      summary: '',
    };

    // 요약 텍스트 생성 (Claude 프롬프트용)
    const parts: string[] = [];
    if (merged.dev_restriction) parts.push('개발제한구역(그린벨트) 내 위치');
    if (merged.urban_zone)      parts.push(`용도지역: ${merged.urban_zone}`);
    parts.push(`잠재력 등급: ${merged.redevelop_potential}등급`);
    parts.push(`최근 1년 건축인허가 ${merged.building_permits_1y}건`);
    parts.push(`개발행위허가 ${merged.dev_permits_1y}건`);
    if (merged.active_constructions > 0) parts.push(`주변 공사중 시설물 ${merged.active_constructions}개소`);
    if (merged.avg_travel_time)  parts.push(`평균 통행시간 ${merged.avg_travel_time}분`);
    if (merged.apt_avg_price)    parts.push(`아파트 평균 매매가 ${merged.apt_avg_price.toLocaleString()}만원`);

    merged.summary = parts.join(' / ');
    return merged;

  } catch {
    return null;
  }
}
