// lib/error-handler.ts
// 클라이언트에는 일반 메시지만, 상세 정보는 서버 로그에만 기록합니다.

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const MESSAGES: Record<string, string> = {
  RATE_LIMITED:            '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  INVALID_INPUT:           '입력값을 확인해주세요.',
  INVALID_TOKEN:           '유효하지 않은 토큰입니다.',
  INVALID_COORDS:          '좌표값이 올바르지 않습니다.',
  INVALID_FILE_TYPE:       '허용되지 않는 파일 형식입니다. JPEG 또는 PNG만 가능합니다.',
  FILE_TOO_LARGE:          '파일 크기는 5MB 이하여야 합니다.',
  ADDRESS_REQUIRED:        '주소를 입력해주세요.',
  SESSION_REQUIRED:        '세션 정보가 필요합니다.',
  UNAUTHORIZED:            '인증이 필요합니다.',
  FORBIDDEN:               '접근 권한이 없습니다.',
  NOT_FOUND:               '요청한 정보를 찾을 수 없습니다.',
  EXPIRED:                 '만료된 링크입니다.',
  ANALYSIS_FAILED:         'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  REPORT_SAVE_FAILED:      '제보 저장에 실패했습니다. 다시 시도해주세요.',
  SHARE_CREATE_FAILED:     '공유 링크 생성에 실패했습니다. 다시 시도해주세요.',
  INQUIRY_SAVE_FAILED:     '문의 저장에 실패했습니다. 다시 시도해주세요.',
  DELETE_FAILED:           '계정 삭제에 실패했습니다. 다시 시도해주세요.',
  REVERSE_GEOCODE_FAILED:  '주소 변환에 실패했습니다.',
  GEOCODE_FAILED:          '주소 검색에 실패했습니다.',
  CONFIG_ERROR:            '서버 설정 오류가 발생했습니다.',
  INTERNAL_ERROR:          '서비스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

export function apiError(
  code: string,
  status: number,
  internalDetail?: unknown,
) {
  const requestId = randomUUID().slice(0, 8);

  // 서버 로그에는 상세 기록 (스택 트레이스 포함)
  if (internalDetail instanceof Error) {
    console.error(`[${requestId}] ${code}:`, internalDetail.message);
  } else {
    console.error(`[${requestId}] ${code}`, internalDetail ?? '');
  }

  // 클라이언트에는 일반 메시지만 — 코드/스택/DB정보 절대 노출 금지
  return NextResponse.json(
    {
      success:   false,
      message:   MESSAGES[code] ?? MESSAGES.INTERNAL_ERROR,
      requestId, // 고객 문의 시 추적용 (코드·경로 정보 없음)
    },
    { status },
  );
}
