# Aligo IP Whitelist 자동 검사 가이드

## 개요

Vercel의 아웃바운드 IP는 동적으로 변경되므로 Aligo API 호출 시 IP 화이트리스트 미등록 오류 발생 가능.

## 핵심 함수

### 1. detectAligoSendingIP(req?: NextRequest): string
NextRequest에서 발신 IP 감지 (x-forwarded-for, cf-connecting-ip, x-real-ip)

### 2. getServerPublicIP(): Promise<string>
서버의 public outbound IP 조회 (캐싱 5분)

### 3. validateAligoIPWhitelist(client: AligoClient, currentIP?: string): Promise<IPWhitelistStatus>
현재 IP가 Aligo 화이트리스트에 등록되어 있는지 검증

## 사용 예시

\\\	ypescript
import { createAligoClient, detectAligoSendingIP, validateAligoIPWhitelist } from '@/lib/aligo';

const sendingIP = detectAligoSendingIP(req);
const client = createAligoClient({...});
const status = await validateAligoIPWhitelist(client, sendingIP);

if (!status.isWhitelisted) {
  logger.warn(status.suggestion);
}
\\\

## Aligo 대시보드 등록

1. https://aligo.in/mypage/api_management/ 접속
2. 설정 → API 설정 → IP 화이트리스트
3. 추가 → 현재 IP 입력 → 저장
4. 5-10분 대기

## 캐싱

- TTL: 5분
- 메모리 기반 (서버 재시작 시 초기화)
- clearIPCache()로 수동 초기화 가능

## 파일 위치

src/lib/aligo/ip-whitelist.ts (266줄)

마지막 업데이트: 2026-06-08
