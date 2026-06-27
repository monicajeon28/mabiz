/**
 * 알리고 고정 IP 프록시 라우팅 (발송 서버 IP 화이트리스트 영구 고정용)
 * ────────────────────────────────────────────────────────────────────────
 * 문제: Vercel은 출발(egress) IP가 동적이라, 알리고 콘솔에 IP를 등록해도
 *       IP가 바뀌면 -101(인증오류·IP)로 전건 거부된다.
 * 해결: 고정 IP를 가진 프록시(QuotaGuard/Fixie/자체 VPS 등)를 경유시키면
 *       알리고가 보는 발송 IP가 항상 그 1개로 고정 → 한 번만 등록하면 영구.
 *
 * 동작:
 *  - 환경변수 ALIGO_PROXY_URL(예: http://user:pass@host:port)이 설정된 경우에만 활성.
 *    미설정 시 아무것도 바꾸지 않아 기존과 100% 동일하게 직접 발송한다(영향 0).
 *  - 글로벌 fetch 디스패처를 host 기반 라우터로 교체한다.
 *    *.aligo.in 으로 가는 요청만 프록시로 보내고, 그 외(구글 드라이브·Neon·Supabase 등)는
 *    기존 디스패처로 그대로 직접 보낸다.
 *  - 코드 전역의 알리고 호출(aligo.ts + 크론/여권/PNR/카카오 등 25곳+)을 한 곳에서 커버한다.
 *
 * 초기화는 instrumentation.ts(register)에서 1회. 실패 시 직접 발송으로 안전 폴백(앱 무중단).
 */
import { logger } from "@/lib/logger";

let _initialized = false;

/** opts.origin(string | URL)에서 host 문자열을 안전하게 추출 */
function originHost(origin: unknown): string {
  if (typeof origin === "string") {
    try {
      return new URL(origin).host;
    } catch {
      return origin;
    }
  }
  if (origin && typeof origin === "object" && "host" in origin) {
    const h = (origin as { host?: unknown }).host;
    return typeof h === "string" ? h : "";
  }
  return "";
}

export function initAligoProxyRouting(): void {
  if (_initialized) return;
  _initialized = true;

  const proxyUrl = process.env.ALIGO_PROXY_URL?.trim();
  if (!proxyUrl) return; // 미설정 → 직접 발송(기존 동작 유지)

  try {
    // 동기 require로 즉시 적용 (instrumentation 시작 시점)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require("undici") as typeof import("undici");
    const { ProxyAgent, getGlobalDispatcher, setGlobalDispatcher } = undici;

    const proxy = new ProxyAgent(proxyUrl);
    const direct = getGlobalDispatcher(); // 기존 글로벌(비-알리고 트래픽 보존)

    // undici Dispatcher의 close/destroy 오버로드 타입이 까다로워, 얇은 런타임 어댑터는
    // any 경계로 확장해 dispatch만 host 기반 라우팅한다(런타임 동작은 정확).
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const Base = undici.Dispatcher as unknown as { new (): any };
    class AligoHostRouter extends Base {
      dispatch(opts: any, handler: any): boolean {
        const host = originHost(opts?.origin).toLowerCase();
        const isAligo = host === "aligo.in" || host.endsWith(".aligo.in");
        const target = isAligo ? proxy : direct;
        return (target as any).dispatch(opts, handler);
      }
      close(callback?: any): any {
        const p = Promise.allSettled([proxy.close(), direct.close()]).then(() => undefined);
        if (typeof callback === "function") { void p.then(() => callback()); return undefined; }
        return p;
      }
      destroy(err?: any, callback?: any): any {
        if (typeof err === "function") { callback = err; err = null; }
        const p = Promise.allSettled([proxy.destroy(err ?? null), direct.destroy(err ?? null)]).then(() => undefined);
        if (typeof callback === "function") { void p.then(() => callback()); return undefined; }
        return p;
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setGlobalDispatcher(new AligoHostRouter() as any);
    logger.log("[Aligo] 고정 IP 프록시 라우팅 활성화 (*.aligo.in → 프록시)");
  } catch (err) {
    // 초기화 실패해도 앱은 정상 — 직접 발송으로 폴백(IP 미고정 상태)
    logger.error("[Aligo] 프록시 라우팅 초기화 실패 — 직접 발송으로 폴백", { err });
  }
}
