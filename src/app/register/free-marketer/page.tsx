import { redirect } from 'next/navigation';

/**
 * ⛔ 이 페이지는 폐기되었습니다.
 *
 * '본사 직속 3% 수당 프리마케터' 즉시 가입 플로우는 더 이상 사용하지 않습니다.
 * (3% 고정 수당 정책 폐지 — 2026-06)
 *
 * 모든 가입은 초대 링크(/join/[token])를 통해서만 진행됩니다.
 * 이 경로로 접근하면 로그인 페이지로 이동합니다.
 */
export default function FreeMarketerRegisterPage() {
  redirect('/sign-in');
}
