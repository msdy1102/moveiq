// lib/error-handler.ts
// 클라이언트에는 일반 메시지만, 상세 정보는 서버 로그에만 기록합니다.

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const MESSAGES: Record<string, string> = {
  RATE_LIMITED:            '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  INVALID_INPUT:           '입력값을 확인해주세요.',
  ADDRESS_REQUIRED:        '주소를 입력해주세요.',
  ANALYSIS_FAILED:         'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  REPORT_SAVE_FAILED:      '제보 저장에 실패했습니다. 다시 시도해주세요.',
  INTERNAL_ERROR:          '서비스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  UNAUTHORIZED:            '인증이 필요합니다.',
  FORBIDDEN:               '접근 권한이 없습니다.',
};

// 기본 메시지 (알 수 없는 코드 전달 시 런타임 오류 방지)
const DEFAULT_MESSAGE = '서비스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

export function apiError(
  code: string,
  status: number,
  internalDetail?: unknown,
) {
  const requestId = randomUUID().slice(0, 8);

  // 서버 로그에는 상세 기록
  console.error(`[${requestId}] ${code}`, internalDetail ?? '');

  // 클라이언트에는 일반 메시지만 — 알 수 없는 코드도 안전하게 처리
  const message = MESSAGES[code] ?? DEFAULT_MESSAGE;

  return NextResponse.json(
    { success: false, message, requestId },
    { status },
  );
}
