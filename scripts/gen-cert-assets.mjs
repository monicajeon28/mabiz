/**
 * 증서 PNG 캡처용 로고·직인을 base64 data URI로 인라인 생성.
 *   html2canvas-pro는 data URI를 inline 이미지로 처리 → CORS/네트워크/배포/타이밍 의존 0
 *   → "미리보기엔 보이는데 PNG 다운로드엔 로고·도장이 안 들어감" 문제를 구조적으로 종결.
 * 실행: node scripts/gen-cert-assets.mjs  (public PNG 교체 시 재실행)
 */
import fs from 'fs';

const enc = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const logo = enc('public/logo-cruisedot.png');
const seal = enc('public/cruise-stamp.png');

const out = `// ⚠️ 자동생성 — scripts/gen-cert-assets.mjs (직접 수정 금지, PNG 교체 시 재생성)
// 증서 PNG 캡처(html2canvas-pro)에서 로고·직인 누락 방지: data URI 인라인(CORS/배포/타이밍 무관 항상 렌더).
export const CERT_LOGO_DATA_URI = ${JSON.stringify(logo)};
export const CERT_SEAL_DATA_URI = ${JSON.stringify(seal)};
`;
const target = 'src/app/(dashboard)/documents-approval/_components/cert-assets.ts';
fs.writeFileSync(target, out);
console.log(`✅ ${target}\n  logo ${(logo.length / 1024).toFixed(0)}KB / seal ${(seal.length / 1024).toFixed(0)}KB (base64)`);
