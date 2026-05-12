import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * IndexNow API — 검색 엔진에 URL 변경 즉시 알림
 *
 * 동작:
 * - Bing, Yandex, Seznam에 변경된 URL을 즉시 통보
 * - 일반 SEO: 구글봇이 크롤링할 때까지 수일~수주 소요
 * - IndexNow: 핑 전송 후 수 시간 내 인덱싱
 *
 * 스케줄: 매일 03:00 KST (변경된 상품이 없으면 조용히 종료)
 */

interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

async function pingIndexNow(payload: IndexNowPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      logger.info('[IndexNow] 핑 전송 성공', {
        host: payload.host,
        urlCount: payload.urlList.length,
      });
      return { success: true };
    } else {
      const errorText = await response.text();
      logger.warn('[IndexNow] 핑 전송 실패', {
        status: response.status,
        error: errorText,
      });
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    logger.error('[IndexNow] 네트워크 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function GET(req: NextRequest) {
  // CRON_SECRET 검증
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const indexNowKey = process.env.INDEXNOW_KEY;
    if (!indexNowKey) {
      logger.warn('[IndexNow] INDEXNOW_KEY 환경변수 미설정');
      return NextResponse.json(
        { message: 'IndexNow key not configured' },
        { status: 200 }
      );
    }

    // 최근 24시간 내 업데이트된 상품 URL들
    // 실제 구현: DB에서 updatedAt이 최근 24시간인 상품 조회
    // 현재는 기본 URL들만 전송하고, 나중에 동적 상품 URL 추가 가능
    const baseUrls = [
      'https://www.cruisedot.co.kr',
      'https://www.cruisedot.co.kr/cruisedot-mall',
      'https://www.cruisedot.co.kr/sitemap.xml',
    ];

    // 미래: Prisma를 사용하여 실제 변경된 상품 가져오기
    // const changedProducts = await prisma.cruiseProduct.findMany({
    //   where: {
    //     updatedAt: {
    //       gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
    //     },
    //   },
    //   select: { productCode: true },
    //   take: 100,
    // });
    // const productUrls = changedProducts.map(
    //   p => `https://www.cruisedot.co.kr/cruisedot-mall/${p.productCode}`
    // );

    const payload: IndexNowPayload = {
      host: 'www.cruisedot.co.kr',
      key: indexNowKey,
      keyLocation: 'https://www.cruisedot.co.kr/indexnow.txt',
      urlList: baseUrls,
    };

    const result = await pingIndexNow(payload);

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: `IndexNow 핑 전송 완료 (${baseUrls.length}개 URL)`,
          urlCount: baseUrls.length,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: `IndexNow 핑 전송 실패: ${result.error}`,
        },
        { status: 202 } // Accepted: 비동기 작업이므로 202 반환
      );
    }
  } catch (error) {
    logger.error('[IndexNow Cron] 예기치 않은 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
