export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { askGemini } from '@/lib/gemini';

// POST: Gemini API로 댓글 자동 생성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    // 관리자만 가능
    if (user.role !== 'admin') {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const landingPageId = parseInt(resolvedParams.id);
    if (isNaN(landingPageId)) {
      return NextResponse.json({ ok: false, error: '잘못된 랜딩페이지 ID' }, { status: 400 });
    }

    const body = await req.json();
    const { count, departureDate, endDate } = body;

    if (!count || !departureDate || !endDate) {
      return NextResponse.json(
        { ok: false, error: '댓글 개수, 시작일, 종료일이 필요합니다' },
        { status: 400 }
      );
    }

    // 랜딩페이지 조회
    const landingPage = await prisma.landingPage.findUnique({
      where: { id: landingPageId },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    // HTML에서 텍스트 추출 (이미지 태그 제거하고 텍스트만)
    const textContent = landingPage.htmlContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 이미지 URL 추출 (상대 경로를 절대 경로로 변환)
    const imageMatches = landingPage.htmlContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
    const imageUrls = imageMatches.map(img => {
      const match = img.match(/src=["']([^"']+)["']/);
      if (match) {
        let url = match[1];
        // 상대 경로를 절대 경로로 변환
        if (url.startsWith('/')) {
          url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${url}`;
        } else if (!url.startsWith('http')) {
          url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/${url}`;
        }
        return url;
      }
      return null;
    }).filter(Boolean);

    // Gemini API로 댓글 생성
    const prompt = `다음은 블로그형 랜딩페이지의 내용입니다:

제목: ${landingPage.title}
내용: ${textContent.substring(0, 2000)}${textContent.length > 2000 ? '...' : ''}

이 랜딩페이지에 대한 자연스러운 댓글 ${count}개를 생성해주세요.

요구사항:
1. 한국어로 작성
2. 자연스럽고 진짜 사람이 쓴 것처럼 작성
3. 이모티콘을 자연스럽게 사용 (ㅎㅎ, ㅋㅋ, ㅋ..., ..., ^^, :), 😊, 👍 등)
4. 댓글 내용은 페이지 내용과 관련되어야 함
5. 긍정적인 댓글이 대부분이지만, 일부는 중립적이거나 약간의 의문을 제기하는 댓글도 포함
6. 각 댓글은 20-100자 정도로 작성
7. 작성자 이름은 한국 이름으로 (예: 김민수, 이영희, 박지훈 등)

응답 형식은 JSON 배열로:
[
  {
    "authorName": "김민수",
    "content": "정말 좋은 정보네요! ㅎㅎ 저도 한번 신청해볼게요 ^^"
  },
  ...
]

${imageUrls.length > 0 ? `\n\n이 페이지에는 ${imageUrls.length}개의 이미지가 포함되어 있습니다. 이미지 URL: ${imageUrls.slice(0, 5).join(', ')}${imageUrls.length > 5 ? ' ...' : ''}\n이미지의 내용과 컨텍스트를 고려하여 댓글을 작성해주세요.` : ''}`;

    const messages = [
      { role: 'user' as const, content: prompt }
    ];

    let geminiResponse;
    try {
      geminiResponse = await askGemini(messages, 0.8);
    } catch (error: any) {
      console.error('[Generate Comments] Gemini API error:', error);
      return NextResponse.json(
        { ok: false, error: '댓글 생성에 실패했습니다: ' + error.message },
        { status: 500 }
      );
    }

    // Gemini 응답에서 JSON 파싱
    let comments: Array<{ authorName: string; content: string }> = [];
    try {
      const responseText = geminiResponse?.text || '';
      
      // JSON 코드 블록 찾기 (```json ... ``` 또는 ``` ... ``` 또는 직접 JSON)
      let jsonText = responseText.trim();
      
      // 1. 코드 블록 제거 (```json ... ``` 또는 ``` ... ```)
      // 여러 줄에 걸친 코드 블록도 처리
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonText = codeBlockMatch[1].trim();
      } else {
        // 2. 직접 JSON 배열 찾기 (가장 큰 배열 찾기)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonText = jsonMatch[0].trim();
        }
      }
      
      // 3. JSON 텍스트 정리 (주석, 설명 제거)
      // 괄호나 설명이 앞에 있는 경우 제거
      jsonText = jsonText.replace(/^[^(]*\(/g, '').replace(/\)[^)]*$/g, '');
      // Self-correction 같은 설명 제거
      jsonText = jsonText.replace(/\(Self-corr[^)]*\)/gi, '');
      // 앞뒤 불필요한 텍스트 제거
      jsonText = jsonText.replace(/^[^[]*\[/, '[').replace(/\][^\]]*$/, ']');
      // 코드 블록 마커가 남아있는 경우 제거
      jsonText = jsonText.replace(/^```(?:json)?\s*/gm, '').replace(/\s*```$/gm, '');
      
      // 4. 잘린 JSON 복구 시도 (닫는 따옴표나 중괄호가 없는 경우)
      // 마지막 객체가 완전하지 않은 경우 복구
      if (jsonText.includes('"content":') && !jsonText.trim().endsWith(']')) {
        // 마지막 content 필드 찾기
        const lastContentMatch = jsonText.match(/"content":\s*"([^"]*)$/);
        if (lastContentMatch) {
          // 마지막 따옴표와 중괄호, 대괄호 추가
          const incompleteContent = lastContentMatch[1];
          // 닫는 따옴표, 중괄호, 대괄호 추가
          jsonText = jsonText + '"' + '\n  }\n]';
        }
      }
      
      // 5. JSON 파싱 시도
      if (jsonText && jsonText.trim().startsWith('[')) {
        try {
          // 먼저 정상적인 JSON 파싱 시도
          if (jsonText.trim().endsWith(']')) {
            comments = JSON.parse(jsonText.trim());
          } else {
            // 잘린 JSON인 경우 복구 시도
            // 마지막 ] 찾기
            const lastBracket = jsonText.lastIndexOf(']');
            if (lastBracket > 0) {
              const cleanedJson = jsonText.substring(0, lastBracket + 1).trim();
              const firstBracket = cleanedJson.indexOf('[');
              if (firstBracket >= 0) {
                const finalJson = cleanedJson.substring(firstBracket);
                comments = JSON.parse(finalJson);
              } else {
                throw new Error('JSON 배열 시작을 찾을 수 없습니다.');
              }
            } else {
              // ]가 없는 경우 수동으로 복구
              // 마지막 객체의 닫는 중괄호와 배열 닫기 추가
              let repairedJson = jsonText.trim();
              // 마지막 따옴표가 없으면 추가
              if (!repairedJson.endsWith('"') && repairedJson.includes('"content":')) {
                const lastQuoteIndex = repairedJson.lastIndexOf('"');
                const afterLastQuote = repairedJson.substring(lastQuoteIndex + 1);
                if (!afterLastQuote.includes('"')) {
                  repairedJson = repairedJson + '"';
                }
              }
              // 마지막 중괄호가 없으면 추가
              if (!repairedJson.endsWith('}')) {
                repairedJson = repairedJson + '\n  }';
              }
              // 마지막 대괄호 추가
              if (!repairedJson.endsWith(']')) {
                repairedJson = repairedJson + '\n]';
              }
              comments = JSON.parse(repairedJson);
            }
          }
        } catch (e: any) {
          // JSON 파싱 실패 시, 더 공격적으로 정리
          console.error('[Generate Comments] JSON parse attempt failed:', e.message);
          // 부분 파싱 시도: 각 객체를 개별적으로 파싱
          const objectMatches = jsonText.match(/\{[^}]*"authorName"[^}]*"content"[^}]*\}/g);
          if (objectMatches && objectMatches.length > 0) {
            comments = objectMatches.map((objStr, idx) => {
              try {
                // 각 객체를 완전한 형태로 만들기
                let completeObj = objStr;
                if (!completeObj.endsWith('}')) {
                  completeObj = completeObj + '}';
                }
                return JSON.parse(completeObj);
              } catch {
                // 파싱 실패한 경우 기본값 사용
                return {
                  authorName: `사용자${idx + 1}`,
                  content: '좋은 정보네요!',
                };
              }
            }).filter(Boolean);
          } else {
            throw new Error('JSON 배열 형식을 찾을 수 없습니다.');
          }
        }
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다. 응답: ' + responseText.substring(0, 200));
      }
    } catch (parseError: any) {
      console.error('[Generate Comments] JSON parse error:', parseError);
      console.error('[Generate Comments] Response text:', geminiResponse?.text?.substring(0, 1000));
      return NextResponse.json(
        { ok: false, error: '댓글 파싱에 실패했습니다: ' + parseError.message },
        { status: 500 }
      );
    }

    // 댓글 개수 조정
    if (comments.length > count) {
      comments = comments.slice(0, count);
    }

    // 날짜 범위 계산
    const start = new Date(departureDate);
    const end = new Date(endDate);
    const dateRange = end.getTime() - start.getTime();

    // 댓글 생성 및 저장
    const createdComments = [];
    for (let i = 0; i < comments.length; i++) {
      // 날짜 범위 내 랜덤 날짜 생성
      const randomTime = start.getTime() + Math.random() * dateRange;
      const randomDate = new Date(randomTime);

      try {
        const comment = await prisma.landingPageComment.create({
          data: {
            landingPageId,
            authorName: comments[i].authorName || `사용자${i + 1}`,
            content: comments[i].content,
            createdAt: randomDate,
            isAutoGenerated: true,
          },
        });
        createdComments.push(comment);
      } catch (error: any) {
        console.error(`[Generate Comments] Failed to create comment ${i + 1}:`, error);
      }
    }

    return NextResponse.json({
      ok: true,
      count: createdComments.length,
      comments: createdComments,
    });
  } catch (error: any) {
    console.error('[Generate Comments] Error:', error);
    return NextResponse.json(
      { ok: false, error: '댓글 생성 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
