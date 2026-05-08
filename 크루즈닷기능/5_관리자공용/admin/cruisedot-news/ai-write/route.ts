export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

// Zod 스키마: 선택된 이미지 항목
const selectedImageSchema = z.object({
  id: z.string().min(1).max(255),
  webpUrl: z.string().url().nullable(),
  driveFileId: z.string().max(255).nullable(),
  fileName: z.string().min(1).max(500),
  altHint: z.string().max(300).optional(),
});

// Zod 스키마: POST 요청 본문
const aiWriteBodySchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200),
  mainKeyword: z.string().min(1).max(200),
  subKeywords: z.string().max(500).optional().default(''),
  description: z.string().max(500).optional().default(''),
  category: z.string().max(100).optional().default(''),
  emoji: z.string().max(10).optional().default(''),
  articleType: z.string().max(100).optional().default(''),
  youtubeUrls: z.array(z.string().url()).optional().default([]),
  heroImage: z.string().optional().default(''),
  targetAudience: z.string().max(200).optional().default(''),
  contentOutline: z.string().max(5000).optional().default(''),
  internalLinks: z.array(z.string()).optional().default([]),
  tone: z.string().max(100).optional().default(''),
  selectedImages: z.array(selectedImageSchema).optional().default([]),
});

type AiWriteRequestBody = z.infer<typeof aiWriteBodySchema>;

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/);
  return match ? match[1]! : null;
}

async function loadKeywordContext(): Promise<string> {
  const wosDir = join(process.cwd(), '.claude/wos');

  const allFiles: Array<{ name: string; limit: number }> = [
    { name: '크루즈 키워드 100개 분석 리포트.md', limit: 3000 },
    { name: '키워드 매핑 가이드.md', limit: 3000 },
    { name: '크루즈키워드와 컨텐츠 셋팅.md', limit: 3000 },
    { name: '크루즈 키워드 100개 분석 리포트 1.md', limit: 1500 },
    { name: '크루즈 키워드 100개 분석 리포트 2 테마별.md', limit: 1500 },
    { name: '6개 테마별 트렌드 및 검색 키워드 분석 (2025-2026).md', limit: 1500 },
    { name: '동영상, 이미지  카테고리 키워드 최종 검토 완료.md', limit: 1500 },
  ];

  const results = await Promise.all(
    allFiles.map(async ({ name, limit }) => {
      try {
        const content = (await readFile(join(wosDir, name), 'utf-8')).slice(0, limit);
        return { section: `### ${name}\n${content}`, ok: true };
      } catch {
        logger.warn('[admin/cruisedot-news/ai-write] 키워드 파일 로드 실패', { file: name });
        return { section: '', ok: false };
      }
    })
  );

  const loaded = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const sections = results.map(r => r.section).filter(Boolean);

  logger.debug('[admin/cruisedot-news/ai-write] 키워드 컨텍스트 로드', {
    loaded,
    failed,
    totalFiles: allFiles.length,
    estimatedChars: sections.reduce((acc, s) => acc + s.length, 0),
  });

  return sections.join('\n\n---\n\n');
}

export async function POST(req: Request) {
  try {
    // 인증: admin 세션 또는 내부 cron 호출 허용
    const internalCronKey = req.headers.get('x-internal-cron');
    const cronSecret = process.env.CRON_SECRET;
    const isInternalCron = cronSecret && internalCronKey === cronSecret;

    if (!isInternalCron) {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
      }
      if (!['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
        return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 401 });
      }
    }

    const parseResult = aiWriteBodySchema.safeParse(await req.json());
    if (!parseResult.success) {
      logger.warn('[admin/cruisedot-news/ai-write] 요청 본문 검증 실패', {
        issues: parseResult.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
      return NextResponse.json(
        { ok: false, error: '요청 데이터가 올바르지 않습니다.', details: parseResult.error.issues },
        { status: 400 }
      );
    }
    const {
      title,
      slug,
      mainKeyword,
      subKeywords,
      description,
      category,
      articleType,
      youtubeUrls,
      heroImage,
      targetAudience,
      contentOutline,
      internalLinks,
      tone,
      selectedImages,
    }: AiWriteRequestBody = parseResult.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error('[admin/cruisedot-news/ai-write] GEMINI_API_KEY 없음');
      return NextResponse.json({ ok: false, error: 'AI 서비스를 사용할 수 없습니다.' }, { status: 500 });
    }

    const model = resolveGeminiModelName();

    // YouTube ID 추출
    const youtubeIds = (youtubeUrls ?? [])
      .map(extractYoutubeId)
      .filter((id): id is string => id !== null);

    const youtubeIdsStr =
      youtubeIds.length > 0 ? youtubeIds.join(', ') : '(없음 — 채널 링크 텍스트 박스 사용)';

    const internalLinksStr =
      internalLinks && internalLinks.length > 0 ? internalLinks.join(', ') : '/products';

    // 키워드 컨텍스트 로드
    const keywordContext = await loadKeywordContext();

    // 발행일 (오늘 날짜 UTC 기준)
    const publishedAt = new Date().toISOString().slice(0, 10);

    // 선택된 이미지를 HTML figure 블록으로 변환
    const imageBlocks = selectedImages
      .map((img) => {
        const src = img.webpUrl || (img.driveFileId
          ? `/api/admin/cruise-photos/image?id=${img.driveFileId}`
          : null);
        if (!src) return '';
        const altText = img.altHint || img.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        return `<figure class="news-figure">
  <img src="${src}" alt="${altText} - 크루즈닷" loading="lazy" width="900" height="600" decoding="async">
  <figcaption>${altText}</figcaption>
</figure>`;
      })
      .filter(Boolean);

    const prompt = `당신은 크루즈닷(cruisedot.co.kr)의 고급 랜딩페이지 작가입니다.
SEO 최상위 노출 + 일일 매출 전환 극대화를 목표로 하는 블로그형 랜딩페이지를 작성하세요.

[크루즈닷 브랜드 포지셔닝]
- "가성비 여행사" ❌
- "신뢰할 수 있는 프리미엄 파트너" ✓
- 20년 경험 + 투명한 상담 + 회원 커뮤니티

[글 정보]
- 제목: ${title}
- 메인 키워드: ${mainKeyword}
- 서브 키워드: ${subKeywords}
- SEO 설명: ${description}

[키워드 컨텍스트]
${keywordContext}

[미리 준비된 이미지 블록]
${imageBlocks.length > 0 ? imageBlocks.map((b, i) => `이미지${i + 1}:\n${b}`).join('\n\n') : '(선택된 이미지 없음)'}

[HTML 구조 — 패턴 2: 고급 랜딩 페이지]

<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | 크루즈닷</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${heroImage}">
  <meta property="og:url" content="https://www.cruisedot.co.kr/cruisedot-news/${slug}">
  <meta property="og:type" content="article">
  <link rel="canonical" href="https://www.cruisedot.co.kr/cruisedot-news/${slug}">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"NewsArticle","headline":"${title}","description":"${description}","image":"${heroImage}","datePublished":"${publishedAt}","author":{"@type":"Organization","name":"크루즈닷"},"publisher":{"@type":"Organization","name":"크루즈닷","logo":{"@type":"ImageObject","url":"https://www.cruisedot.co.kr/logo.png"}}}
  </script>
</head>
<body>

<!-- [상단 고정 배너] — 카카오톡 공유 유도 -->
<div class="fixed-banner top">
  <a href="https://open.kakao.com/o/s8j0U3Af">카카오톡 오픈채팅 '크루즈닷 커뮤니티' 입장하기</a>
</div>

<!-- [배너 섹션] — 고객 후기 유도 -->
<div style="position:relative;width:100%;background:linear-gradient(135deg,#0a192f,#1a2f45);padding:24px;text-align:center;color:white;">
  <p style="margin:0;font-weight:700;color:#d4af37;">💬 <a href="https://www.cruisedot.co.kr/products" style="color:#d4af37;text-decoration:none;">고객 후기 보러가기</a></p>
</div>

<!-- [메인 제목 — 패턴 2 스타일] -->
<div class="pattern2-main-title">
  <h1>${title}</h1>
  <p>${description}</p>
</div>

<!-- [YouTube 자동 삽입] -->
${youtubeIds.length > 0 ? `<div style="max-width:900px;margin:48px auto;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(10,25,47,.2);">
  <iframe width="100%" height="506" src="https://www.youtube.com/embed/${youtubeIds[0]}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeIds[0]}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</div>` : ''}

<!-- [섹션 1: ${mainKeyword}를 경험해야 하는 이유] -->
<article style="max-width:900px;margin:48px auto;padding:0 20px;">
  <h2 style="font-family:'Noto Serif KR',serif;font-size:32px;color:#0a192f;margin-bottom:20px;">${mainKeyword}를 경험해야 하는 이유</h2>
  <p style="font-size:18px;line-height:1.8;color:#374151;margin-bottom:24px;">처음 크루즈 여행을 고민하시나요? 대부분의 사람들은 "배 위에서 얼마나 재미있을까?" 의심합니다. 하지만 크루즈를 경험한 사람들의 이야기는 다릅니다. 7박 동안 호텔 + 식사 + 엔터테인먼트가 모두 포함된 프리미엄 경험이 기다리고 있기 때문입니다.</p>

  <!-- [통계 카드] -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;margin:48px 0;">
    <div style="background:#fff;border-radius:20px;padding:28px 20px;text-align:center;box-shadow:0 8px 28px rgba(15,23,42,.09);border-top:4px solid #f43f5e;">
      <div style="font-family:'Noto Serif KR',serif;font-size:54px;font-weight:900;color:#f43f5e;margin-bottom:8px;">70%</div>
      <div style="font-size:14px;font-weight:600;color:#6b7280;">재구매율 (만족도)</div>
    </div>
    <div style="background:#fff;border-radius:20px;padding:28px 20px;text-align:center;box-shadow:0 8px 28px rgba(15,23,42,.09);border-top:4px solid #d4af37;">
      <div style="font-family:'Noto Serif KR',serif;font-size:54px;font-weight:900;color:#d4af37;margin-bottom:8px;">20+</div>
      <div style="font-size:14px;font-weight:600;color:#6b7280;">크루즈 경험 (신뢰도)</div>
    </div>
    <div style="background:#fff;border-radius:20px;padding:28px 20px;text-align:center;box-shadow:0 8px 28px rgba(15,23,42,.09);border-top:4px solid #2563eb;">
      <div style="font-family:'Noto Serif KR',serif;font-size:54px;font-weight:900;color:#2563eb;margin-bottom:8px;">100%</div>
      <div style="font-size:14px;font-weight:600;color:#6b7280;">투명 가격 정책</div>
    </div>
  </div>

  ${imageBlocks.length > 0 ? imageBlocks[0] : ''}

  <p style="font-size:18px;line-height:1.8;color:#374151;margin-top:24px;"><span style="background:linear-gradient(180deg,transparent 60%,rgba(250,204,21,.55) 60%);padding:3px 8px;font-weight:700;color:#ca8a04;">7박 동안 배가 움직이는 동안 24시간 서비스</span>를 받으며, 세계의 다양한 항구에서 내려 자유시간을 즐깁니다. 이것이 <span style="background:linear-gradient(180deg,transparent 60%,rgba(239,68,68,.35) 60%);padding:3px 8px;font-weight:700;color:#dc2626;">호텔 여행이나 자유여행과 완전히 다른 경험</span>이 되는 이유입니다.</p>
</article>

<!-- [섹션 2: 이미지 + 포인트박스 -- 실제 경험 중심] -->
<article style="max-width:900px;margin:48px auto;padding:0 20px;">
  <h2 style="font-family:'Noto Serif KR',serif;font-size:32px;color:#0a192f;margin-bottom:20px;">${contentOutline.split('\\n')[0] || '첫 크루즈 여행자들이 가장 놀라는 순간들'}</h2>

  ${imageBlocks.length > 1 ? imageBlocks[1] : ''}

  <!-- [포인트박스] -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:24px;margin:48px 0;">
    <div style="background:#fff;border-radius:20px;padding:32px 24px;text-align:center;box-shadow:0 8px 24px rgba(15,23,42,.08);border:2px solid transparent;transition:all 0.3s;">
      <div style="font-size:48px;margin-bottom:16px;">🚢</div>
      <h3 style="font-size:20px;font-weight:700;color:#0a192f;margin-bottom:12px;">프리미엄 선실</h3>
      <p style="font-size:15px;color:#6b7280;line-height:1.7;">대양 뷰 선실에서 깨어나 아침 일출을 감상하세요.</p>
    </div>
    <div style="background:#fff;border-radius:20px;padding:32px 24px;text-align:center;box-shadow:0 8px 24px rgba(15,23,42,.08);border:2px solid transparent;transition:all 0.3s;">
      <div style="font-size:48px;margin-bottom:16px;">🍽️</div>
      <h3 style="font-size:20px;font-weight:700;color:#0a192f;margin-bottom:12px;">무제한 식사</h3>
      <p style="font-size:15px;color:#6b7280;line-height:1.7;">선 위 매 끼마다 다양한 뷔페와 파인다이닝을 즐기세요.</p>
    </div>
    <div style="background:#fff;border-radius:20px;padding:32px 24px;text-align:center;box-shadow:0 8px 24px rgba(15,23,42,.08);border:2px solid transparent;transition:all 0.3s;">
      <div style="font-size:48px;margin-bottom:16px;">🎪</div>
      <h3 style="font-size:20px;font-weight:700;color:#0a192f;margin-bottom:12px;">24시간 엔터테인먼트</h3>
      <p style="font-size:15px;color:#6b7280;line-height:1.7;">쇼, 이벤트, 스포츠, 라이브뮤직이 계속됩니다.</p>
    </div>
  </div>

  <!-- [혜택박스] -->
  <div style="background:linear-gradient(135deg,#d4af37,#f59e0b);border-radius:20px;padding:40px 32px;margin:48px 0;color:#0a192f;">
    <h3 style="font-size:28px;font-weight:700;margin-bottom:24px;color:#0a192f;">크루즈닷 상담받기의 장점</h3>
    <ul style="list-style:none;padding:0;margin:0;display:grid;gap:16px;">
      <li style="font-size:17px;font-weight:600;padding:14px 20px;background:rgba(255,255,255,.8);border-radius:12px;display:flex;align-items:center;gap:12px;">
        <span style="flex-shrink:0;width:28px;height:28px;background:#0a192f;color:#d4af37;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:16px;">✓</span>
        맞춤형 선택 — 당신의 예산과 취향에 맞는 크루즈
      </li>
      <li style="font-size:17px;font-weight:600;padding:14px 20px;background:rgba(255,255,255,.8);border-radius:12px;display:flex;align-items:center;gap:12px;">
        <span style="flex-shrink:0;width:28px;height:28px;background:#0a192f;color:#d4af37;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:16px;">✓</span>
        투명한 가격 — 숨겨진 추가요금 없이 처음부터 명확하게
      </li>
      <li style="font-size:17px;font-weight:600;padding:14px 20px;background:rgba(255,255,255,.8);border-radius:12px;display:flex;align-items:center;gap:12px;">
        <span style="flex-shrink:0;width:28px;height:28px;background:#0a192f;color:#d4af37;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:16px;">✓</span>
        지속적 지원 — 여행 전·중·후 365일 함께
      </li>
    </ul>
  </div>

  ${imageBlocks.length > 2 ? imageBlocks[2] : ''}
</article>

<!-- [섹션 3: 강조박스 + FAQ] -->
<article style="max-width:900px;margin:48px auto;padding:0 20px;">
  <h2 style="font-family:'Noto Serif KR',serif;font-size:32px;color:#0a192f;margin-bottom:20px;">자주 묻는 질문</h2>

  <div style="margin:56px 0;">
    <div style="border-bottom:1px solid rgba(15,23,42,.08);padding:20px 0;">
      <div style="font-size:17px;font-weight:700;color:#1f2937;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start;">
        <span style="flex-shrink:0;width:28px;height:28px;background:#f43f5e;color:#fff;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:900;">Q</span>
        <span>${mainKeyword}은 처음인데 어디서부터 시작할까요?</span>
      </div>
      <div style="padding-left:38px;font-size:16px;color:#6b7280;line-height:1.9;">크루즈닷 상담팀에 문의하시면 당신의 예산과 취향을 듣고 맞춤형 크루즈를 추천해드립니다. 선택부터 예약, 여행 후까지 모든 과정을 함께합니다.</div>
    </div>
    <div style="border-bottom:1px solid rgba(15,23,42,.08);padding:20px 0;">
      <div style="font-size:17px;font-weight:700;color:#1f2937;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start;">
        <span style="flex-shrink:0;width:28px;height:28px;background:#f43f5e;color:#fff;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:900;">Q</span>
        <span>예약 후 혹시 취소하거나 변경할 수 있나요?</span>
      </div>
      <div style="padding-left:38px;font-size:16px;color:#6b7280;line-height:1.9;">크루즈 회사별로 정책이 다릅니다. 상담팀이 예약 전에 취소·변경 조건을 상세히 설명해드립니다.</div>
    </div>
    <div style="border-bottom:1px solid rgba(15,23,42,.08);padding:20px 0;">
      <div style="font-size:17px;font-weight:700;color:#1f2937;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start;">
        <span style="flex-shrink:0;width:28px;height:28px;background:#f43f5e;color:#fff;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:900;">Q</span>
        <span>여행 후 추가 요금이 나올 수도 있나요?</span>
      </div>
      <div style="padding-left:38px;font-size:16px;color:#6b7280;line-height:1.9;">아닙니다. 크루즈 요금에는 객실, 식사, 기본 엔터테인먼트가 모두 포함됩니다. 추가로 드는 비용은 개인 활동(스파, 바 음료 등)에 한정됩니다.</div>
    </div>
  </div>

  <!-- [강조박스] -->
  <div style="position:relative;margin:40px 0;padding:28px 32px 28px 44px;background:linear-gradient(135deg,#fffbeb,#fef9c3);border-radius:18px;border-left:5px solid #fbbf24;font-size:18px;font-weight:600;color:#78350f;line-height:1.8;">
    <span style="position:absolute;left:14px;top:28px;font-size:16px;color:#f59e0b;">✦</span>
    크루즈 여행의 가장 큰 장점은 짐을 한 번만 꾸리고 매일 다른 도시를 여행한다는 점입니다. 피로감을 최소화하면서 최대한 많은 경험을 할 수 있습니다.
  </div>
</article>

<!-- [고객 후기] -->
<article style="max-width:900px;margin:56px auto;padding:0 20px;">
  <h2 style="font-family:'Noto Serif KR',serif;font-size:24px;font-weight:700;color:#111827;margin-bottom:28px;text-align:center;">회원님의 생생한 경험</h2>

  <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #f0f0f0;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 12px rgba(15,23,42,.06);margin-bottom:20px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;gap:12px;">
      <div>
        <div style="font-weight:700;color:#111827;font-size:16px;">김○님 (30대)</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">로얄캐리비안 보스턴</div>
        <div style="display:flex;gap:4px;color:#fbbf24;font-size:16px;">★★★★★</div>
      </div>
    </div>
    <div style="font-weight:600;color:#1f2937;margin-bottom:12px;font-size:16px;line-height:1.5;">처음 크루즈 여행이 이렇게 편할 줄 몰랐어요</div>
    <div style="font-size:15px;color:#6b7280;line-height:1.7;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">예약부터 탑승까지 모든 과정이 너무 쉬웠고, 배 위에서도 크루즈닷 상담팀이 항상 도와줬어요. 다음에도 꼭 다시 가고 싶습니다!</div>
    <span style="display:inline-block;background:linear-gradient(135deg,#f43f5e,#be123c);color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;">클릭해서 전체 후기 보기 →</span>
  </div>
</article>

<!-- [카카오 오픈채팅 배너] -->
<div style="position:relative;width:100%;background:linear-gradient(135deg,#0a192f,#1a2f45);padding:40px 20px;text-align:center;color:white;margin-top:48px;">
  <p style="margin:0 0 16px;font-weight:700;font-size:20px;">더 알고 싶으신가요?</p>
  <a href="https://open.kakao.com/o/s8j0U3Af" style="display:inline-block;background:#d4af37;color:#0a192f;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;transition:all 0.2s;">크루즈닷 커뮤니티 입장하기</a>
</div>

<!-- [하단 고정 배너] — 상담 신청 유도 -->
<div class="fixed-banner bottom">
  <a href="https://www.cruisedot.co.kr/products">지금 바로 무료 상담 신청하기</a>
</div>

<!-- [리뷰 모달] -->
<div id="review-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:1000;align-items:center;justify-content:center;padding:20px;">
  <div style="background:#fff;border-radius:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;padding:32px;position:relative;">
    <button onclick="document.getElementById('review-modal').style.display='none'" style="position:absolute;top:20px;right:20px;width:40px;height:40px;background:#f3f4f6;border:none;border-radius:50%;cursor:pointer;font-size:24px;color:#6b7280;transition:all 0.2s;">✕</button>
    <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
      <div id="review-title" style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px;"></div>
      <div id="review-author" style="font-size:14px;color:#6b7280;"></div>
    </div>
    <div id="review-body" style="font-size:16px;color:#374151;line-height:1.8;margin-bottom:24px;"></div>
  </div>
</div>

</body>
</html>

[og:description 제약]
- 반드시 120~160자 범위 (소셜 미디어 노출용 최적화)
- 평문만 (HTML 태그 금지)
- 제목 + 본문 요약으로 구성
- 예시: "MSC는 유럽의 대표 크루즈 선사로 14개 선박을 보유하고 있습니다. 지중해 항로에 강하며, 다양한 연령층을 위한 프로그램과 현대적인 선박이 특징입니다."

[마지막 필수 규칙]
- 절대 금지 단어: "크달", "최저가", "무조건 싼", leadgen.kr 도메인 경로
- 금지 방식: console.log, alert, confirm, prompt
- 이미지 src/alt 절대 수정 금지
- 모든 CTA href: https://www.cruisedot.co.kr/products
- 유튜브 자동재생: autoplay=1&mute=1&controls=0&loop=1&playlist=VIDEO_ID
- JSON-LD: NewsArticle 기본 포함, FAQPage 선택

HTML만 반환 (<!DOCTYPE html>로 시작, 설명 텍스트 없이).`;

    logger.debug('[admin/cruisedot-news/ai-write] Gemini 호출 시작', {
      slug,
      mainKeyword,
      model,
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 16000,
          topK: 40,
        },
      }),
    });

    const data = await res.json();

    if (data.error) {
      logger.error('[admin/cruisedot-news/ai-write] Gemini API 오류', {
        slug,
      });
      return NextResponse.json(
        { ok: false, error: 'AI 콘텐츠 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const rawHtml: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!rawHtml) {
      logger.error('[admin/cruisedot-news/ai-write] Gemini 응답 비어있음', { slug });
      return NextResponse.json(
        { ok: false, error: 'AI 응답이 비어 있습니다. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    // HTML 블록 펜스 제거
    const html = rawHtml
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    logger.debug('[admin/cruisedot-news/ai-write] 생성 완료', {
      slug,
      htmlLength: html.length,
    });

    return NextResponse.json({ ok: true, html });
  } catch (e: unknown) {
    logger.error('[admin/cruisedot-news/ai-write] 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: 'AI 글쓰기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
