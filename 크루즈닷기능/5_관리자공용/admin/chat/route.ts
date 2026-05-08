export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { askGemini } from '@/lib/gemini';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { role: true },
        },
      },
    });

    return session?.User.role === 'admin';  // ✅ 대문자 U로 변경
  } catch (error) {
    console.error('[Admin Chat] Auth check error:', error);
    return false;
  }
}

// 관리자용 데이터 조회 함수들
async function searchCustomers(query: string) {
  try {
    const customers = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        tripCount: true,
        isHibernated: true,
        isLocked: true,
        createdAt: true,
      },
      take: 5,
    });

    return customers.map(c => ({
      id: c.id,
      name: c.name || '이름 없음',
      phone: c.phone || '없음',
      email: c.email || '없음',
      tripCount: c.tripCount || 0,
      status: c.isLocked ? '잠금' : c.isHibernated ? '동면' : '활성',
      createdAt: c.createdAt.toLocaleDateString('ko-KR'),
    }));
  } catch (error) {
    console.error('[Admin Chat] Search customers error:', error);
    return [];
  }
}

async function getDashboardStats() {
  try {
    const [totalUsers, activeUsers, totalTrips, inProgressTrips] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isHibernated: false, isLocked: false } }),
      prisma.trip.count(),
      prisma.trip.count({ where: { status: 'InProgress' } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalTrips,
      inProgressTrips,
    };
  } catch (error) {
    console.error('[Admin Chat] Get stats error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[Admin Chat API] Request received');
    
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      console.error('[Admin Chat API] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const { message, history } = await req.json();
    console.log('[Admin Chat API] Message received:', message?.substring(0, 50) + '...');

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok: false, error: 'Message is required' }, { status: 400 });
    }

    // 관리자 전용 시스템 프롬프트
    const systemPrompt = `당신은 크루즈 가이드 관리자 시스템의 AI 도우미입니다. 관리자가 다음을 도와주세요:

1. **기능 설명**: 관리자 페이지의 각 기능(대시보드, 고객 관리, 메시지 발송, 데이터 분석 등)에 대해 설명
2. **고객 검색**: 고객 이름, 전화번호, 이메일로 검색하는 방법 안내
3. **데이터 조회**: 통계 데이터, 분석 데이터 조회 방법 안내
4. **시스템 사용법**: 관리자 패널 사용 방법 안내

답변은 간결하고 실용적으로 작성하세요. 한국어로 답변하세요.

고객 검색 결과가 제공되면:
- 반드시 고객 정보를 자세히 설명하세요
- 고객 ID, 이름, 전화번호, 이메일, 여행 횟수, 상태, 가입일을 포함하세요
- 고객 상세 페이지로 이동하는 방법도 안내하세요 (/admin/users/[userId])
- 검색 결과가 없으면 정확한 검색어를 확인하도록 안내하세요`;

    // 의도 파악
    const lowerMessage = message.toLowerCase();
    let contextData = '';

    // 고객 검색 의도 - 이름, 전화번호, 이메일로 검색
    if (lowerMessage.includes('고객') || lowerMessage.includes('사용자') || lowerMessage.includes('검색') || lowerMessage.includes('찾기') || lowerMessage.includes('정보') || lowerMessage.includes('보고싶')) {
      // 이름 추출 시도 (예: "이름이 모니카", "모니카 고객", "모니카 찾아줘")
      let searchQuery = '';
      
      // 패턴 1: "이름이 [이름]라고 되어 있는" 또는 "이름이 [이름]이라고"
      const namePattern1 = /이름이?\s*([가-힣a-zA-Z]+?)\s*(?:라고\s*(?:되어\s*있는?|인|인데|이고)|이라고|인|인데|이고)/i;
      const nameMatch1 = message.match(namePattern1);
      if (nameMatch1 && nameMatch1[1]) {
        searchQuery = nameMatch1[1].trim();
        console.log('[Admin Chat API] Pattern 1 matched:', searchQuery);
      }
      
      // 패턴 1-2: "이름이 [이름]" (간단한 형태)
      if (!searchQuery) {
        const namePattern1Simple = /이름이?\s*([가-힣a-zA-Z]{2,})(?:\s|$)/i;
        const nameMatch1Simple = message.match(namePattern1Simple);
        if (nameMatch1Simple && nameMatch1Simple[1]) {
          searchQuery = nameMatch1Simple[1].trim();
          console.log('[Admin Chat API] Pattern 1-2 matched:', searchQuery);
        }
      }
      
      // 패턴 2: "[이름] 고객" 또는 "[이름] 사용자" 또는 "[이름] 정보" (이름만 추출)
      // "모니카 고객 정보 보고싶어" -> "모니카" 추출
      if (!searchQuery) {
        // 패턴 2-1: "[이름] 고객 정보" 또는 "[이름] 고객"
        const namePattern2a = /([가-힣a-zA-Z]{2,})\s+(?:고객|사용자)\s*(?:정보|보고싶|찾|검색)?/i;
        const nameMatch2a = message.match(namePattern2a);
        if (nameMatch2a && nameMatch2a[1]) {
          searchQuery = nameMatch2a[1].trim();
          console.log('[Admin Chat API] Pattern 2-1 matched:', searchQuery);
        }
      }
      
      // 패턴 2-2: "[이름] 정보" 또는 "[이름] 보고싶"
      if (!searchQuery) {
        const namePattern2b = /([가-힣a-zA-Z]{2,})\s+(?:정보|보고싶|찾|검색)/i;
        const nameMatch2b = message.match(namePattern2b);
        if (nameMatch2b && nameMatch2b[1]) {
          searchQuery = nameMatch2b[1].trim();
          console.log('[Admin Chat API] Pattern 2-2 matched:', searchQuery);
        }
      }
      
      // 패턴 2-3: "[이름] 고객" (간단한 형태)
      if (!searchQuery) {
        const namePattern2c = /([가-힣a-zA-Z]{2,})\s+(?:고객|사용자)/i;
        const nameMatch2c = message.match(namePattern2c);
        if (nameMatch2c && nameMatch2c[1]) {
          searchQuery = nameMatch2c[1].trim();
          console.log('[Admin Chat API] Pattern 2-3 matched:', searchQuery);
        }
      }
      
      // 패턴 3: 전화번호 패턴 (숫자와 하이픈 포함)
      if (!searchQuery) {
        const phonePattern = /(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})/;
        const phoneMatch = message.match(phonePattern);
        if (phoneMatch) {
          searchQuery = phoneMatch[1].replace(/\s/g, '');
        }
      }
      
      // 패턴 4: 이메일 패턴
      if (!searchQuery) {
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const emailMatch = message.match(emailPattern);
        if (emailMatch) {
          searchQuery = emailMatch[1];
        }
      }
      
      // 패턴 5: 나머지 텍스트에서 검색어 추출 (불필요한 단어 제거)
      if (!searchQuery) {
        const cleaned = message
          .replace(/고객|사용자|검색|찾기|정보|보고싶|이름이|이름|을|를|이|가|에게|에게서|어|요|해줘|해주세요|라고|되어|있는/gi, '')
          .trim();
        
        // 한글 또는 영문 이름만 추출 (2글자 이상)
        const nameOnly = cleaned.match(/([가-힣a-zA-Z]{2,})/);
        if (nameOnly && nameOnly[1]) {
          searchQuery = nameOnly[1].trim();
          console.log('[Admin Chat API] Pattern 5 matched:', searchQuery);
        }
      }

      // 검색 쿼리 정제: 불필요한 단어 제거 및 공백 정리
      if (searchQuery) {
        searchQuery = searchQuery
          .replace(/\s*(고객|사용자|정보|검색|찾기|이름|이름이|보고싶|찾|해줘|해주세요)\s*/gi, '')
          .replace(/\s+/g, ' ')  // 여러 공백을 하나로
          .trim();
        
        // 이름만 추출 (공백 제거 후 첫 번째 단어만)
        const words = searchQuery.split(/\s+/);
        if (words.length > 0) {
          searchQuery = words[0].trim();
        }
      }

      if (searchQuery && searchQuery.length >= 1) {
        console.log('[Admin Chat API] Searching customers with query:', searchQuery);
        try {
          const customers = await searchCustomers(searchQuery);
          console.log('[Admin Chat API] Search results:', customers.length, 'customers found');
          if (customers.length > 0) {
            contextData = `\n\n[고객 검색 결과 - ${customers.length}명 발견]\n${JSON.stringify(customers, null, 2)}\n\n위 고객 정보를 바탕으로 친절하고 자세하게 답변하세요. 각 고객에 대해 다음 정보를 포함하여 설명하세요:\n- 고객 ID\n- 이름\n- 전화번호\n- 이메일\n- 여행 횟수\n- 상태 (활성/동면/잠금)\n- 가입일\n\n고객 상세 정보를 보려면 /admin/users/[고객ID] 페이지로 이동하세요.`;
          } else {
            contextData = `\n\n[고객 검색 결과] "${searchQuery}"로 검색한 결과가 없습니다.\n\n다음을 확인해 주세요:\n1. 이름 철자가 정확한지 확인\n2. 전화번호 또는 이메일로 검색 시도\n3. 고객 관리 페이지에서 검색 기능 사용\n\n검색어를 정확히 입력해 주세요.`;
          }
        } catch (error) {
          console.error('[Admin Chat] Search customers error:', error);
          contextData = '\n\n[고객 검색 오류] 검색 중 오류가 발생했습니다.';
        }
      } else {
        console.log('[Admin Chat API] No search query extracted from message');
      }
    }

    // 통계 데이터 의도
    if (lowerMessage.includes('통계') || lowerMessage.includes('데이터') || lowerMessage.includes('현황') || lowerMessage.includes('몇 명')) {
      const stats = await getDashboardStats();
      if (stats) {
        contextData = `\n\n[시스템 통계]\n${JSON.stringify(stats, null, 2)}\n\n위 통계 데이터를 바탕으로 답변하세요.`;
      }
    }

    // Gemini API 호출
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      {
        role: 'user',
        content: `${systemPrompt}${contextData}\n\n사용자 질문: ${message}`,
      },
    ];

    // 이전 대화 히스토리 추가
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-5)) { // 최근 5개만
        if (h.role === 'user' || h.role === 'assistant') {
          messages.unshift({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.content || '',
          });
        }
      }
    }

    let response;
    try {
      console.log('[Admin Chat API] Calling Gemini API with', messages.length, 'messages');
      response = await askGemini(messages);
      console.log('[Admin Chat API] Gemini response received:', typeof response, response ? Object.keys(response) : 'null');
      
      // askGemini는 { text: string, toolCalls: any[] } 형태를 반환
      let responseText = '';
      if (typeof response === 'object' && response !== null) {
        if ('text' in response) {
          responseText = response.text || '';
        } else if ('content' in response) {
          responseText = response.content || '';
        } else {
          responseText = JSON.stringify(response);
        }
      } else if (typeof response === 'string') {
        responseText = response;
      } else {
        responseText = '응답을 생성할 수 없습니다.';
      }

      if (!responseText || responseText.trim() === '') {
        console.warn('[Admin Chat API] Empty response from Gemini');
        responseText = contextData 
          ? `검색 결과를 바탕으로 답변드리겠습니다:\n\n${contextData}`
          : '죄송합니다. 응답을 생성할 수 없었습니다. 다시 시도해 주세요.';
      }

      console.log('[Admin Chat API] Returning response, length:', responseText.length);
      return NextResponse.json({
        ok: true,
        response: responseText,
      });
    } catch (geminiError) {
      console.error('[Admin Chat API] Gemini API Error:', geminiError);
      const errorMessage = geminiError instanceof Error ? geminiError.message : '알 수 없는 오류';
      
      // Gemini API 오류 시에도 검색 결과가 있으면 그대로 제공
      if (contextData) {
        // 검색 결과를 직접 파싱하여 사용자 친화적인 답변 생성
        try {
          const customersMatch = contextData.match(/\[고객 검색 결과[^\]]*\]\n(.*?)\n\n/gs);
          if (customersMatch) {
            const jsonMatch = contextData.match(/\[고객 검색 결과[^\]]*\]\n(\[[\s\S]*?\])/);
            if (jsonMatch && jsonMatch[1]) {
              const customers = JSON.parse(jsonMatch[1]);
              let responseText = `📋 고객 검색 결과 (${customers.length}명)\n\n`;
              customers.forEach((c: any, idx: number) => {
                responseText += `${idx + 1}. ${c.name || '이름 없음'} (ID: ${c.id})\n`;
                responseText += `   📞 전화번호: ${c.phone || '없음'}\n`;
                responseText += `   📧 이메일: ${c.email || '없음'}\n`;
                responseText += `   ✈️ 여행 횟수: ${c.tripCount || 0}회\n`;
                responseText += `   📊 상태: ${c.status || '알 수 없음'}\n`;
                responseText += `   📅 가입일: ${c.createdAt || '알 수 없음'}\n\n`;
              });
              responseText += `💡 상세 정보를 보려면 고객 관리 페이지에서 해당 고객을 클릭하거나, /admin/users/[고객ID]로 이동하세요.`;
              
              return NextResponse.json({
                ok: true,
                response: responseText,
              });
            }
          }
          
          // 검색 결과가 없는 경우
          if (contextData.includes('검색한 결과가 없습니다')) {
            return NextResponse.json({
              ok: true,
              response: `검색 결과를 찾을 수 없습니다.\n\n다음을 시도해 보세요:\n1. 이름 철자를 정확히 확인\n2. 전화번호나 이메일로 검색\n3. 고객 관리 페이지(/admin/customers)에서 검색 기능 사용`,
            });
          }
          
          // 기타 경우
          return NextResponse.json({
            ok: true,
            response: contextData,
          });
        } catch (parseError) {
          console.error('[Admin Chat API] Error parsing context data:', parseError);
          return NextResponse.json({
            ok: true,
            response: contextData || '죄송합니다. 응답을 생성할 수 없었습니다. 다시 시도해 주세요.',
          });
        }
      }
      
      // 검색 결과도 없고 Gemini API도 실패한 경우
      return NextResponse.json({
        ok: true,
        response: '죄송합니다. AI 응답 생성 중 오류가 발생했습니다.\n\n다시 시도해 주세요.',
      });
    }
  } catch (error) {
    console.error('[Admin Chat API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { 
        ok: false, 
        error: `서버 오류가 발생했습니다: ${errorMessage}` 
      },
      { status: 500 }
    );
  }
}
