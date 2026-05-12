export const dynamic = 'force-dynamic';

// app/api/cron/community-bot/route.ts
// 커뮤니티 자동 게시글/댓글 생성 봇 (1시간마다 실행)

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { askGemini } from '@/lib/gemini';
import { buildNewsHtml, type NewsBlock, type NewsIntroBlock, type NewsSectionBlock, type NewsImageBlock, type NewsSummaryBlock, type NewsInfoBlock } from '@/lib/cruisedot-news-template';

// 한글 아이디 목록 (유튜브 댓글 스타일 - 다양하고 자연스러운 닉네임)
const KOREAN_NICKNAMES = [
  '송이엄마', '찡찡', '크루즈닷만세', '바다사랑', '여행러버', '크루즈킹', '해외여행러', 
  '선상낭만', '오션뷰', '크루즈매니아', '여행의신', '바다의왕자', '선상요리사', 
  '크루즈여행자', '해외탐험가', '선상파티', '오션드림', '크루즈마스터', '여행스타', 
  '바다의별', '선상로맨스', '크루즈러버', '해외여행러버', '선상낭만주의자',
  '민수아빠', '지영맘', '해외여행꿈나무', '크루즈초보', '바다를사랑해', '여행덕후', 
  '크루즈여행기', '선상에서커피한잔', '오션러버', '크루즈신', '바다의요정', '여행마니아',
  '크루즈여행러', '해외여행러버', '선상낭만가', '오션드리머', '크루즈매니아킹', '여행스타일',
  '바다의별빛', '선상로맨티스트', '크루즈러버킹', '해외여행러버킹', '선상낭만주의자킹',
  '김민수', '이영희', '박철수', '최지영', '정수진', '강민호', '윤서연', '장동혁',
  '한소희', '오지훈', '임태현', '신유진', '조민석', '배수지', '홍길동', '김철수',
  '이미영', '박준호', '최민지', '정현우', '강서연', '윤지훈', '장수진', '한동혁',
  '오소희', '임지훈', '신태현', '조유진', '배민석', '홍수지', '김영수', '이지은',
  '박민수', '최영희', '정철수', '강지영', '윤수진', '장민호', '한서연', '오동혁',
  '임소희', '신지훈', '조태현', '배유진', '홍민석', '김수지', '이철수', '박미영',
  '최준호', '정민지', '강현우', '윤서연', '장지훈', '한수진', '오동혁', '임소희',
  '신지훈', '조태현', '배유진', '홍민석', '김수지', '이철수', '박미영', '최준호',
  '정민지', '강현우', '윤서연', '장지훈', '한수진', '오동혁', '임소희', '신지훈',
  '크루즈좋아', '바다사랑이', '여행꿈나무', '선상낭만가', '오션드리머', '크루즈매니아킹',
  '여행스타일러', '바다의별빛', '선상로맨티스트', '크루즈러버킹', '해외여행러버킹',
  '크루즈초보자', '바다를사랑해요', '여행덕후킹', '크루즈여행기록', '선상에서커피',
  '오션러버킹', '크루즈신', '바다의요정', '여행마니아킹', '크루즈여행러버',
  '해외여행러버킹', '선상낭만가킹', '오션드리머킹', '크루즈매니아킹', '여행스타일러킹'
];

// 카테고리 목록 (여행팁, 질문답변, 관광지추천)
const CATEGORIES = ['travel-tip', 'qna', 'destination'];

// 크루즈뉘우스 주제 목록
const NEWS_TOPICS = [
  { name: '세계 여행 정보', keyword: 'world travel cruise', emoji: '🌍' },
  { name: '세계 여행 뉴스', keyword: 'cruise travel news', emoji: '📰' },
  { name: '세계 크루즈뉴스', keyword: 'cruise ship news', emoji: '🚢' },
  { name: '크루즈 꿀팁정보', keyword: 'cruise tips advice', emoji: '💡' }
];

// 봇 사용자 ID (봇 전용 계정)
const BOT_USER_ID = 1; // 관리자 계정 또는 봇 전용 계정 ID

/**
 * 2023년 6월 1일부터 현재까지 랜덤 날짜 생성
 */
function getRandomPostDate(): Date {
  const startDate = new Date('2023-06-01T00:00:00.000Z');
  const endDate = new Date();
  const timeDiff = endDate.getTime() - startDate.getTime();
  const randomTime = Math.random() * timeDiff;
  return new Date(startDate.getTime() + randomTime);
}

/**
 * 게시글 날짜 기준 7일 이내 랜덤 댓글 날짜 생성
 */
function getRandomCommentDate(postDate: Date): Date {
  const maxDaysAfter = 7;
  const randomDays = Math.random() * maxDaysAfter; // 0~7일 사이
  const randomHours = Math.random() * 24; // 0~24시간 사이
  const randomMinutes = Math.random() * 60; // 0~60분 사이
  
  const commentDate = new Date(postDate);
  commentDate.setDate(commentDate.getDate() + randomDays);
  commentDate.setHours(commentDate.getHours() + randomHours);
  commentDate.setMinutes(commentDate.getMinutes() + randomMinutes);
  
  // 현재 날짜를 넘지 않도록 제한
  const now = new Date();
  if (commentDate > now) {
    return now;
  }
  
  return commentDate;
}

/**
 * 댓글 날짜 기준 랜덤 대댓글 날짜 생성 (댓글 날짜 이후, 게시글 기준 7일 이내)
 */
function getRandomReplyDate(commentDate: Date, postDate: Date): Date {
  const maxDaysAfterPost = 7;
  const postMaxDate = new Date(postDate);
  postMaxDate.setDate(postMaxDate.getDate() + maxDaysAfterPost);
  
  // 댓글 날짜 이후, 게시글 기준 7일 이내
  const endDate = postMaxDate > new Date() ? new Date() : postMaxDate;
  const timeDiff = endDate.getTime() - commentDate.getTime();
  
  if (timeDiff <= 0) {
    // 댓글 날짜가 이미 게시글 기준 7일을 넘었으면 댓글 날짜 + 1시간
    const replyDate = new Date(commentDate);
    replyDate.setHours(replyDate.getHours() + 1);
    return replyDate > new Date() ? new Date() : replyDate;
  }
  
  const randomTime = Math.random() * timeDiff;
  const replyDate = new Date(commentDate.getTime() + randomTime);
  
  // 현재 날짜를 넘지 않도록 제한
  if (replyDate > new Date()) {
    return new Date();
  }
  
  return replyDate;
}

/**
 * 게시글 길이 범위 선택 (100자, 300자, 500자, 1000자, 1500자 골고루)
 */
function selectPostLengthRange(): { min: number; max: number } {
  const random = Math.random();
  
  if (random < 0.2) {
    // 20%: 100자
    return { min: 80, max: 120 };
  } else if (random < 0.4) {
    // 20%: 300자
    return { min: 250, max: 350 };
  } else if (random < 0.6) {
    // 20%: 500자
    return { min: 450, max: 550 };
  } else if (random < 0.8) {
    // 20%: 1000자
    return { min: 900, max: 1100 };
  } else {
    // 20%: 1500자
    return { min: 1400, max: 1600 };
  }
}

/**
 * 이모지 사용 여부 결정 (10% 확률)
 */
function shouldUseEmoji(): boolean {
  return Math.random() < 0.1; // 10% 확률
}

// 이미지 중복 방지를 위한 전역 변수 (세션별로 관리)
const usedImages = new Set<string>();

/**
 * 크루즈정보사진 폴더에서 크루즈 관련 이미지 URL 가져오기 (중복 방지)
 */
async function getCruiseImage(keyword: string, excludeImages: string[] = []): Promise<string> {
  try {
    // 크루즈정보사진 폴더 경로
    const cruisePhotoDir = path.join(process.cwd(), 'public', '크루즈정보사진');
    
    // 크루즈 관련 폴더 목록 (더 다양하게)
    const cruiseFolders = [
      '코스타세레나',
      'MSC벨리시마',
      'MSC그란디오사',
      'MSC유리비아호',
      '로얄캐리비안 스펙트럼',
      '로얄캐리비안 퀀텀',
      '로얄 브릴리앙스호',
      '로얄 얼루어호',
      '크루즈배경이미지',
      '상품이미지',
      '고객 후기 자료',
      'landing_exposure',
      'landing_attachments'
    ];
    
    // 모든 폴더에서 이미지 수집
    const allImages: Array<{ folder: string; file: string; path: string }> = [];
    
    for (const folder of cruiseFolders) {
      const folderPath = path.join(cruisePhotoDir, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        const imageFiles = files.filter((file: string) => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        });
        
        for (const file of imageFiles) {
          const imagePath = `/크루즈정보사진/${folder}/${file}`;
          // 중복 제외 목록과 사용된 이미지 목록에서 제외
          if (!excludeImages.includes(imagePath) && !usedImages.has(imagePath)) {
            allImages.push({ folder, file, path: imagePath });
          }
        }
      }
    }
    
    // 사용 가능한 이미지가 있으면 랜덤 선택
    if (allImages.length > 0) {
      const randomIndex = Math.floor(Math.random() * allImages.length);
      const selectedImage = allImages[randomIndex];
      usedImages.add(selectedImage.path);
      return selectedImage.path;
    }
    
    // 모든 이미지가 사용되었으면 usedImages 초기화하고 다시 시도
    if (usedImages.size > 0 && allImages.length === 0) {
      usedImages.clear();
      // 재귀 호출로 다시 시도
      return getCruiseImage(keyword, excludeImages);
    }
    
    // 모든 시도 실패 시 기본 이미지
    return '/images/ai-cruise-logo.png';
  } catch (error) {
    logger.error('[COMMUNITY BOT] 크루즈정보사진 이미지 가져오기 실패', { error: error instanceof Error ? error.message : String(error) });
    return '/images/ai-cruise-logo.png';
  }
}

/**
 * 날씨 정보 가져오기 (서울 기준)
 */
async function getWeatherInfo(): Promise<{ temp: number; description: string; icon: string } | null> {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      logger.warn('[COMMUNITY BOT] OpenWeather API 키가 없습니다.');
      return null;
    }
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Seoul,kr&appid=${apiKey}&units=metric&lang=kr`,
      { next: { revalidate: 3600 } } // 1시간 캐시
    );
    
    if (!response.ok) {
      throw new Error(`날씨 API 요청 실패: ${response.status}`);
    }
    
    const data = await response.json();
    const weatherEmoji: { [key: string]: string } = {
      'Clear': '☀️',
      'Clouds': '☁️',
      'Rain': '🌧️',
      'Drizzle': '🌦️',
      'Thunderstorm': '⛈️',
      'Snow': '❄️',
      'Mist': '🌫️',
      'Fog': '🌫️'
    };
    
    return {
      temp: Math.round(data.main.temp),
      description: data.weather[0].description,
      icon: weatherEmoji[data.weather[0].main] || '🌤️'
    };
  } catch (error) {
    logger.error('[COMMUNITY BOT] 날씨 정보 가져오기 실패', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 환율 정보 가져오기
 */
async function getExchangeRate(): Promise<{ usd: number; eur: number; jpy: number } | null> {
  try {
    const response = await fetch(
      'https://api.exchangerate-api.com/v4/latest/USD',
      { next: { revalidate: 3600 } } // 1시간 캐시
    );
    
    if (!response.ok) {
      throw new Error(`환율 API 요청 실패: ${response.status}`);
    }
    
    const data = await response.json();
    const krwRate = data.rates?.KRW || 1380;
    const eurRate = data.rates?.EUR || 0.92;
    const jpyRate = data.rates?.JPY || 150;
    
    return {
      usd: Math.round(krwRate),
      eur: Math.round(krwRate / eurRate),
      jpy: Number((krwRate / jpyRate).toFixed(2))
    };
  } catch (error) {
    logger.error('[COMMUNITY BOT] 환율 정보 가져오기 실패', { error: error instanceof Error ? error.message : String(error) });
    // 기본값 반환
    return {
      usd: 1380,
      eur: 1500,
      jpy: 9.2
    };
  }
}

/**
 * 주식시장 정보 가져오기
 */
async function getStockMarketInfo(): Promise<{ kospi: number; kosdaq: number; nasdaq: number } | null> {
  try {
    // Alpha Vantage API 또는 다른 무료 API 사용
    // 여기서는 기본값 반환 (실제 API 연동 필요 시 추가)
    // 참고: 실제 주식 API는 API 키가 필요하며, 무료 티어가 제한적입니다.
    
    // 기본값 반환 (실제로는 API에서 가져와야 함)
    return {
      kospi: 2650,
      kosdaq: 850,
      nasdaq: 15500
    };
  } catch (error) {
    logger.error('[COMMUNITY BOT] 주식시장 정보 가져오기 실패', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 크루즈뉘우스 형식의 게시글 생성
 */
export async function generateCruisedotNews(): Promise<{ title: string; highlight: string; html: string; category: string } | null> {
  try {
    // 주제 랜덤 선택
    const topic = NEWS_TOPICS[Math.floor(Math.random() * NEWS_TOPICS.length)];
    
    // 날씨, 환율, 증시 정보 가져오기
    const [weatherInfo, exchangeRate, stockMarket] = await Promise.all([
      getWeatherInfo(),
      getExchangeRate(),
      getStockMarketInfo()
    ]);
    
    const prompt = `크루즈뉘우스 본사에서 발행하는 크루즈 뉴스 기사를 카피라이터처럼 소통하듯이 작성해주세요.

주제: ${topic.name}
이모지: ${topic.emoji}

글쓰기 스타일:
- 독자와 대화하듯이 친근하고 자연스러운 톤
- 카피라이터처럼 설득력 있고 읽기 쉬운 문장
- 블로그 형식: 문장은 간결하게 2-3줄씩 구성
- 행간을 넓게 하여 가독성 좋게 작성
- 이모티콘을 적절히 사용하여 친근함 표현
- 강조할 부분은 형광펜 효과나 색깔로 표시

요구사항:
- 총 글자수: 약 5000자 정도
- 제목: 20-40자, 이모티콘 포함, 매력적이고 정보성 있는 제목
- 핵심 문장(highlight): 50-80자, 독자가 가장 먼저 알아야 할 핵심 정보
- 본문: 5-7개의 섹션으로 구성
- 각 섹션: 제목 + 본문 (본문은 2-3줄씩 나누어 작성, 각 문단은 간결하게)
- 강조 효과: 중요한 숫자나 키워드는 형광펜 효과나 색깔로 표시
  - 빨간색 강조: <span class="highlight-red">텍스트</span>
  - 파란색 강조: <span class="highlight-blue">텍스트</span>
  - 노란색 강조: <span class="highlight-yellow">텍스트</span>
  - 빨간색 텍스트: <span class="text-red">텍스트</span>
  - 파란색 텍스트: <span class="text-blue">텍스트</span>
- 이미지 설명: 각 이미지에 대한 적절한 설명 작성 (이모티콘 포함)
- 이모티콘: 각 섹션 제목과 본문에 적절히 사용

응답 형식:
제목: [제목 이모티콘 포함]
핵심문장: [핵심 문장]
섹션1제목: [첫 번째 섹션 제목 이모티콘 포함]
섹션1내용: [첫 번째 섹션 내용, 2-3줄씩 나누어 작성\n각 문단은 간결하게\n강조할 부분은 HTML 태그로 표시]
이미지1설명: [첫 번째 이미지 설명 이모티콘 포함]
섹션2제목: [두 번째 섹션 제목 이모티콘 포함]
섹션2내용: [두 번째 섹션 내용, 2-3줄씩 나누어 작성\n각 문단은 간결하게]
이미지2설명: [두 번째 이미지 설명 이모티콘 포함]
섹션3제목: [세 번째 섹션 제목 이모티콘 포함]
섹션3내용: [세 번째 섹션 내용, 2-3줄씩 나누어 작성]
섹션4제목: [네 번째 섹션 제목 이모티콘 포함]
섹션4내용: [네 번째 섹션 내용, 2-3줄씩 나누어 작성]
섹션5제목: [다섯 번째 섹션 제목 이모티콘 포함]
섹션5내용: [다섯 번째 섹션 내용, 2-3줄씩 나누어 작성]
마무리: [마무리 문장, 2-3문장 이모티콘 포함]`;

    const response = await askGemini([
      { role: 'user', content: prompt }
    ], 0.8);

    if (!response || !response.text) {
      logger.error('[COMMUNITY BOT] 크루즈뉘우스 AI 응답 없음');
      return null;
    }

    const text = response.text.trim();
    
    // 응답 파싱
    const titleMatch = text.match(/제목:\s*(.+?)(?:\n|$)/);
    const highlightMatch = text.match(/핵심문장:\s*(.+?)(?:\n|$)/);
    const section1TitleMatch = text.match(/섹션1제목:\s*(.+?)(?:\n|$)/);
    const section1ContentMatch = text.match(/섹션1내용:\s*([\s\S]+?)(?=\n(?:섹션2제목|이미지1설명)|$)/);
    const image1DescMatch = text.match(/이미지1설명:\s*(.+?)(?:\n|$)/);
    const section2TitleMatch = text.match(/섹션2제목:\s*(.+?)(?:\n|$)/);
    const section2ContentMatch = text.match(/섹션2내용:\s*([\s\S]+?)(?=\n(?:섹션3제목|이미지2설명)|$)/);
    const image2DescMatch = text.match(/이미지2설명:\s*(.+?)(?:\n|$)/);
    const section3TitleMatch = text.match(/섹션3제목:\s*(.+?)(?:\n|$)/);
    const section3ContentMatch = text.match(/섹션3내용:\s*([\s\S]+?)(?=\n(?:섹션4제목|마무리)|$)/);
    const section4TitleMatch = text.match(/섹션4제목:\s*(.+?)(?:\n|$)/);
    const section4ContentMatch = text.match(/섹션4내용:\s*([\s\S]+?)(?=\n(?:섹션5제목|마무리)|$)/);
    const section5TitleMatch = text.match(/섹션5제목:\s*(.+?)(?:\n|$)/);
    const section5ContentMatch = text.match(/섹션5내용:\s*([\s\S]+?)(?=\n(?:마무리)|$)/);
    const summaryMatch = text.match(/마무리:\s*([\s\S]+?)(?:\n|$)/);

    if (!titleMatch || !highlightMatch) {
      logger.error('[COMMUNITY BOT] 크루즈뉘우스 파싱 실패');
      return null;
    }

    const title = titleMatch[1].trim();
    const highlight = highlightMatch[1].trim();
    
    // 이미지 가져오기 (중복 방지)
    const image1 = await getCruiseImage(topic.keyword);
    const image2 = await getCruiseImage(topic.keyword, [image1]);
    
    // 블록 구성: 이미지-글-이미지-글 형식
    const blocks: NewsBlock[] = [];
    
    // 날씨/환율/증시 정보 블록 (상단)
    if (weatherInfo || exchangeRate || stockMarket) {
      blocks.push({
        id: `info-${Date.now()}`,
        type: 'info',
        weather: weatherInfo || undefined,
        exchangeRate: exchangeRate || undefined,
        stockMarket: stockMarket || undefined
      } as NewsInfoBlock);
    }
    
    // Intro 블록
    blocks.push({
      id: `intro-${Date.now()}`,
      type: 'intro',
      kicker: `${topic.emoji} ${topic.name.toUpperCase()}`,
      lead: highlight
    } as NewsIntroBlock);
    
    // 첫 번째 섹션
    if (section1TitleMatch && section1ContentMatch) {
      blocks.push({
        id: `section-1-${Date.now()}`,
        type: 'section',
        heading: section1TitleMatch[1].trim(),
        body: section1ContentMatch[1].trim(),
        listItems: []
      } as NewsSectionBlock);
    }
    
    // 첫 번째 이미지
    blocks.push({
      id: `image-1-${Date.now()}`,
      type: 'image',
      src: image1,
      alt: image1DescMatch?.[1]?.trim() || '크루즈 여행 이미지',
      caption: image1DescMatch?.[1]?.trim() || '크루즈 여행의 아름다운 순간'
    } as NewsImageBlock);
    
    // 두 번째 섹션
    if (section2TitleMatch && section2ContentMatch) {
      blocks.push({
        id: `section-2-${Date.now()}`,
        type: 'section',
        heading: section2TitleMatch[1].trim(),
        body: section2ContentMatch[1].trim(),
        listItems: []
      } as NewsSectionBlock);
    }
    
    // 두 번째 이미지
    blocks.push({
      id: `image-2-${Date.now()}`,
      type: 'image',
      src: image2,
      alt: image2DescMatch?.[1]?.trim() || '크루즈 여행 이미지',
      caption: image2DescMatch?.[1]?.trim() || '크루즈 여행의 특별한 경험'
    } as NewsImageBlock);
    
    // 세 번째 섹션
    if (section3TitleMatch && section3ContentMatch) {
      blocks.push({
        id: `section-3-${Date.now()}`,
        type: 'section',
        heading: section3TitleMatch[1].trim(),
        body: section3ContentMatch[1].trim(),
        listItems: []
      } as NewsSectionBlock);
    }
    
    // 네 번째 섹션
    if (section4TitleMatch && section4ContentMatch) {
      blocks.push({
        id: `section-4-${Date.now()}`,
        type: 'section',
        heading: section4TitleMatch[1].trim(),
        body: section4ContentMatch[1].trim(),
        listItems: []
      } as NewsSectionBlock);
    }
    
    // 다섯 번째 섹션
    if (section5TitleMatch && section5ContentMatch) {
      blocks.push({
        id: `section-5-${Date.now()}`,
        type: 'section',
        heading: section5TitleMatch[1].trim(),
        body: section5ContentMatch[1].trim(),
        listItems: []
      } as NewsSectionBlock);
    }
    
    // 마무리
    if (summaryMatch) {
      blocks.push({
        id: `summary-${Date.now()}`,
        type: 'summary',
        title: '마무리',
        body: summaryMatch[1].trim()
      } as NewsSummaryBlock);
    }
    
    // HTML 생성
    const html = buildNewsHtml({
      title,
      highlight,
      blocks
    });
    
    return {
      title,
      highlight,
      html,
      category: 'cruisedot-news'
    };
  } catch (error) {
    logger.error('[COMMUNITY BOT] 크루즈뉘우스 생성 실패', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * AI를 사용하여 크루즈 관련 게시글 생성 (유튜브 댓글 스타일 참고)
 */
async function generatePost(): Promise<{ title: string; content: string; category: string } | null> {
  try {
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const lengthRange = selectPostLengthRange();
    const useEmoji = shouldUseEmoji();
    
    const prompt = `유튜브 크루즈 영상 댓글을 참고하여 크루즈 여행 커뮤니티 게시글을 작성해주세요.

참고할 유튜브 댓글 스타일:
- 실제 사람들이 정말 궁금해하고 도움이 필요한 질문들
- 행복하고 즐거워하는 감정 표현
- 구체적이고 실용적인 경험 공유
- 친근하고 자연스러운 말투
- 한국어 이모티콘 다양하게 적극 사용: ㅋㅋ, ㅎㅎ, ㅋ.., ㅎ..., ^^, :), ㅎㅎㅎㅎㅎㅎ, ㅋㅋㅋㅋㅋㅋㅋ, ㅋㅋㅋ, ㅎㅎㅎ, ㅠㅠ, ㅠ, ㅜㅜ, ^_^, @_@ 등
${useEmoji ? '- 이모지(이모지)도 1-2개 사용 가능' : '- 이모지(이모지)는 사용하지 마세요'}
- 짧고 간결하지만 진심이 담긴 표현
- 질문도 하고 답도 하고, 경험 공유도 하고, 다양한 형태로 작성

요구사항:
- 카테고리: ${category === 'travel-tip' ? '여행팁' : category === 'qna' ? '질문답변' : '관광지추천'}
- 실제 크루즈 여행객이 유튜브 댓글에 쓸 것처럼 자연스럽고 진솔한 톤
- 제목: 15-35자 정도, 궁금증이나 감동을 담은 제목
- 내용: ${lengthRange.min}-${lengthRange.max}자 정도, 구체적이고 실용적이며 감정이 담긴 내용
- 유튜브 댓글처럼 "정말 궁금해요", "도움 부탁드려요", "너무 좋았어요" 같은 표현 사용
- 한국어 이모티콘(ㅋㅋ, ㅎㅎ, ㅋ.., ㅎ..., ^^, :), ㅎㅎㅎㅎㅎㅎ, ㅋㅋㅋㅋㅋㅋㅋ 등)을 다양하게 자연스럽게 사용하여 감정 표현
- 질문형 게시글도 작성 가능 (예: "이거 궁금한데요?", "혹시 아시는 분 계신가요?")
- 답변형 게시글도 작성 가능 (예: "제 경험으로는...", "저는 이렇게 했어요")
- 경험 공유형 게시글도 작성 가능 (예: "저도 거기 갔었는데...", "정말 좋았어요!")
- 매번 다른 스타일로 작성하여 중복되지 않도록
- 한국어로 작성
- 반드시 ${lengthRange.min}자 이상 ${lengthRange.max}자 이내로 작성하세요

응답 형식:
제목: [제목]
내용: [내용]`;

    const response = await askGemini([
      { role: 'user', content: prompt }
    ], 0.8);

    if (!response || !response.text) {
      logger.error('[COMMUNITY BOT] AI 응답 없음');
      return null;
    }

    const text = response.text.trim();
    const titleMatch = text.match(/제목:\s*(.+?)(?:\n|$)/);
    const contentMatch = text.match(/내용:\s*(.+?)(?:\n|$)/s);

    if (!titleMatch || !contentMatch) {
      // 형식이 다르면 전체를 제목으로, 나머지를 내용으로
      const lines = text.split('\n').filter(l => l.trim());
      const title = lines[0]?.replace(/^제목:\s*/, '').trim() || '크루즈 여행 후기';
      let content = lines.slice(1).join('\n').replace(/^내용:\s*/, '').trim() || text;
      
      // 길이 범위에 맞게 조정
      if (content.length > lengthRange.max) {
        content = content.substring(0, lengthRange.max);
      }
      
      return {
        title: title.substring(0, 100),
        content,
        category
      };
    }

    const title = titleMatch[1].trim().substring(0, 100);
    let content = contentMatch[1].trim();
    
    // 길이 범위에 맞게 조정
    if (content.length > lengthRange.max) {
      content = content.substring(0, lengthRange.max);
    }
    
    return {
      title,
      content,
      category
    };
  } catch (error) {
    logger.error('[COMMUNITY BOT] 게시글 생성 실패', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 댓글이 부정적인지 감지
 */
async function detectNegativeSentiment(commentContent: string): Promise<boolean> {
  try {
    const prompt = `다음 댓글이 부정적(불만, 비판, 실망, 불만족 등)인지 판단해주세요.

댓글: "${commentContent}"

부정적인 표현 예시:
- "별로였어요", "실망했어요", "비추해요", "안 좋았어요"
- "비싸요", "불편했어요", "서비스가 나빠요"
- "추천 안 해요", "후회했어요", "별로예요"

긍정적이거나 중립적인 표현은 부정적이 아닙니다:
- "궁금해요", "어떤가요?", "추천해주세요"
- "좋았어요", "만족했어요", "추천해요"

응답 형식:
부정적이면: "YES"
부정적이 아니면: "NO"
댓글만 작성 (다른 설명 없이)`;

    const response = await askGemini([
      { role: 'user', content: prompt }
    ], 0.7);

    if (!response || !response.text) {
      return false;
    }

    const result = response.text.trim().toUpperCase();
    return result.includes('YES');
  } catch (error) {
    logger.error('[COMMUNITY BOT] 감정 분석 실패', { error: error instanceof Error ? error.message : String(error) });
    return false; // 에러 시 부정적이 아니라고 가정
  }
}

/**
 * 부정적 댓글에 대한 긍정적 대응 댓글 생성
 */
async function generatePositiveResponse(negativeComment: string, postTitle: string, postContent: string): Promise<string | null> {
  try {
    const useEmoji = shouldUseEmoji();
    
    const prompt = `다음 부정적인 댓글에 대해 긍정적이고 도움이 되는 대응 댓글을 작성해주세요.

부정적 댓글: "${negativeComment}"
게시글 제목: ${postTitle}
게시글 내용: ${postContent}

요구사항:
- 부정적인 내용을 직접 반박하지 않고, 긍정적인 관점으로 대응
- 공감과 이해를 표현하면서도 긍정적인 해결책이나 다른 관점 제시
- 친근하고 자연스러운 말투
- 20-70자 정도의 짧고 간결한 댓글
- 한국어 이모티콘 적극 사용: ^^, ㅋㅋㅋ, ㅋㅋ, ㅎㅎ, ㅠㅠ, ㅠ, ㅜㅜ, ^_^, @_@ 등
${useEmoji ? '- 이모지(이모지)도 1개 정도 사용 가능' : '- 이모지(이모지)는 사용하지 마세요'}
- 한국어로 작성
- 댓글만 작성 (다른 설명 없이)

예시:
- "아쉽게 느끼셨군요. 저는 이렇게 해서 좋았어요..."
- "그런 경험도 있으시군요. 저는 이 부분이 좋았는데..."
- "이해해요. 다음에는 이렇게 해보시면 어떨까요?"`;

    const response = await askGemini([
      { role: 'user', content: prompt }
    ], 0.8);

    if (!response || !response.text) {
      return null;
    }

    const comment = response.text.trim().substring(0, 200);
    return comment;
  } catch (error) {
    logger.error('[COMMUNITY BOT] 긍정적 대응 댓글 생성 실패', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 댓글 길이 범위 선택 (10자, 30자, 50자, 100자, 150자 골고루)
 */
function selectCommentLengthRange(): { min: number; max: number } {
  const random = Math.random();
  
  if (random < 0.2) {
    // 20%: 10자
    return { min: 8, max: 12 };
  } else if (random < 0.4) {
    // 20%: 30자
    return { min: 25, max: 35 };
  } else if (random < 0.6) {
    // 20%: 50자
    return { min: 45, max: 55 };
  } else if (random < 0.8) {
    // 20%: 100자
    return { min: 90, max: 110 };
  } else {
    // 20%: 150자
    return { min: 140, max: 160 };
  }
}

/**
 * 게시글에 맞는 자연스러운 댓글 생성 (유튜브 댓글 스타일)
 */
async function generateComment(postTitle: string, postContent: string, postCategory: string): Promise<string | null> {
  try {
    const lengthRange = selectCommentLengthRange();
    const useEmoji = shouldUseEmoji();
    
    const prompt = `유튜브 크루즈 영상 댓글 스타일을 참고하여 다음 게시글에 대한 자연스러운 댓글을 작성해주세요.

게시글 제목: ${postTitle}
게시글 내용: ${postContent}
카테고리: ${postCategory}

참고할 유튜브 댓글 스타일:
- 실제 사람들이 정말 궁금해하고 도움이 필요한 질문들
- 행복하고 즐거워하는 감정 표현 ("너무 좋았어요!", "정말 추천해요!")
- 공감과 격려 ("저도 궁금했어요", "도움됐어요 감사합니다")
- 구체적인 경험 공유 ("저도 거기 갔었는데...", "저는 이렇게 했어요")
- 친근하고 자연스러운 말투
- 한국어 이모티콘 다양하게 적극 사용: ㅋㅋ, ㅎㅎ, ㅋ.., ㅎ..., ^^, :), ㅎㅎㅎㅎㅎㅎ, ㅋㅋㅋㅋㅋㅋㅋ, ㅋㅋㅋ, ㅎㅎㅎ, ㅠㅠ, ㅠ, ㅜㅜ, ^_^, @_@ 등
${useEmoji ? '- 이모지(이모지)도 1개 정도 사용 가능' : '- 이모지(이모지)는 사용하지 마세요'}
- 짧고 간결하지만 진심이 담긴 표현
- 질문도 하고 답도 하고, 경험 공유도 하고, 다양한 형태로 작성

요구사항:
- 실제 유튜브 댓글처럼 자연스럽고 진솔한 톤
- ${lengthRange.min}-${lengthRange.max}자 정도의 짧고 간결한 댓글
- 게시글 내용과 관련된 공감, 질문, 조언, 경험 공유
- 한국어 이모티콘(ㅋㅋ, ㅎㅎ, ㅋ.., ㅎ..., ^^, :), ㅎㅎㅎㅎㅎㅎ, ㅋㅋㅋㅋㅋㅋㅋ 등)을 다양하게 자연스럽게 사용하여 감정 표현
- 질문형 댓글도 작성 가능 (예: "이거 궁금한데요?", "혹시 아시는 분 계신가요?")
- 답변형 댓글도 작성 가능 (예: "제 경험으로는...", "저는 이렇게 했어요")
- 공감형 댓글도 작성 가능 (예: "저도 궁금했어요!", "정말 좋은 정보네요!")
- 매번 다른 스타일로 작성하여 중복되지 않도록
- 한국어로 작성
- 댓글만 작성 (다른 설명 없이)
- "정말", "너무", "진짜", "꼭", "감사합니다" 같은 표현 자연스럽게 사용
- 반드시 ${lengthRange.min}자 이상 ${lengthRange.max}자 이내로 작성하세요`;

    const response = await askGemini([
      { role: 'user', content: prompt }
    ], 0.9);

    if (!response || !response.text) {
      logger.error('[COMMUNITY BOT] 댓글 AI 응답 없음');
      return null;
    }

    let comment = response.text.trim();
    
    // 길이 범위에 맞게 조정
    if (comment.length > lengthRange.max) {
      comment = comment.substring(0, lengthRange.max);
    }
    
    return comment;
  } catch (error) {
    logger.error('[COMMUNITY BOT] 댓글 생성 실패', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 대댓글 길이 범위 선택 (10자, 30자, 50자, 100자, 150자 골고루)
 */
function selectReplyLengthRange(): { min: number; max: number } {
  const random = Math.random();
  
  if (random < 0.2) {
    // 20%: 10자
    return { min: 8, max: 12 };
  } else if (random < 0.4) {
    // 20%: 30자
    return { min: 25, max: 35 };
  } else if (random < 0.6) {
    // 20%: 50자
    return { min: 45, max: 55 };
  } else if (random < 0.8) {
    // 20%: 100자
    return { min: 90, max: 110 };
  } else {
    // 20%: 150자
    return { min: 140, max: 160 };
  }
}

/**
 * 댓글에 대한 자연스러운 대댓글 생성 (AI끼리 대화)
 */
async function generateReply(commentContent: string, commentAuthor: string, postTitle: string): Promise<string | null> {
  try {
    const lengthRange = selectReplyLengthRange();
    const useEmoji = shouldUseEmoji();
    
    const prompt = `다음 댓글에 대한 자연스러운 대댓글을 작성해주세요. 실제 사람들이 댓글에 답하는 것처럼 자연스럽게 대화하듯이 작성해주세요.

원본 댓글: "${commentContent}"
댓글 작성자: ${commentAuthor}
게시글 제목: ${postTitle}

요구사항:
- 댓글 내용에 자연스럽게 반응 (공감, 질문, 추가 정보, 경험 공유 등)
- 실제 사람들이 댓글에 답하는 것처럼 자연스러운 대화 톤
- ${lengthRange.min}-${lengthRange.max}자 정도의 짧고 간결한 대댓글
- 한국어 이모티콘 다양하게 적극 사용: ㅋㅋ, ㅎㅎ, ㅋ.., ㅎ..., ^^, :), ㅎㅎㅎㅎㅎㅎ, ㅋㅋㅋㅋㅋㅋㅋ, ㅋㅋㅋ, ㅎㅎㅎ, ㅠㅠ, ㅠ, ㅜㅜ, ^_^, @_@ 등
${useEmoji ? '- 이모지(이모지)도 1개 정도 사용 가능' : '- 이모지(이모지)는 사용하지 마세요'}
- 질문형 대댓글도 작성 가능 (예: "이거 궁금한데요?", "혹시 더 자세히 알려주실 수 있나요?")
- 답변형 대댓글도 작성 가능 (예: "제 경험으로는...", "저는 이렇게 했어요")
- 공감형 대댓글도 작성 가능 (예: "저도 그렇게 생각해요!", "정말 좋은 정보네요!")
- 매번 다른 스타일로 작성하여 중복되지 않도록
- 한국어로 작성
- 대댓글만 작성 (다른 설명 없이)
- "맞아요", "저도", "그렇군요", "추가로", "정말", "너무", "진짜" 같은 자연스러운 연결 표현 사용
- 반드시 ${lengthRange.min}자 이상 ${lengthRange.max}자 이내로 작성하세요`;

    const response = await askGemini([
      { role: 'user', content: prompt }
    ], 0.85);

    if (!response || !response.text) {
      return null;
    }

    let reply = response.text.trim();
    
    // 길이 범위에 맞게 조정
    if (reply.length > lengthRange.max) {
      reply = reply.substring(0, lengthRange.max);
    }
    
    return reply;
  } catch (error) {
    logger.error('[COMMUNITY BOT] 대댓글 생성 실패', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 봇 사용자 계정 확인 또는 생성
 */
async function getOrCreateBotUser() {
  try {
    // 봇 사용자 확인
    let botUser = await prisma.user.findUnique({
      where: { id: BOT_USER_ID }
    });

    if (!botUser) {
      // 봇 사용자 생성
      botUser = await prisma.user.create({
        data: {
          id: BOT_USER_ID,
          name: '크루즈봇',
          phone: '01000000000',
          email: 'bot@cruisedot.com',
          password: 'bot1234',
          role: 'community',
          onboarded: true
        }
      });
      logger.log('[COMMUNITY BOT] 봇 사용자 생성 완료');
    }

    return botUser;
  } catch (error) {
    logger.error('[COMMUNITY BOT] 봇 사용자 확인 실패', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * POST: 봇 실행 (외부 cron 서비스에서 호출)
 * 
 * 서버 부하 최적화:
 * - AI 호출: 최대 8-10회 (게시글 1, 댓글 1, 기존 게시글 댓글 2-3, 대댓글 1-2, 감정 분석 1-2, 긍정적 대응 1-2)
 * - 예상 실행 시간: 20-30초 (각 AI 호출당 2-3초)
 * - 5분 간격 실행이므로 충분한 여유
 * - 타임아웃: 60초 (안전장치)
 */
export async function POST(req: Request) {
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 60000; // 60초 타임아웃
  
  try {
    // 보안: Cron 비밀 키 확인
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
    }

    logger.log('[COMMUNITY BOT] 봇 실행 시작...');

    // 타임아웃 체크 함수
    const checkTimeout = () => {
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        throw new Error('봇 실행 시간 초과 (60초)');
      }
    };

    // 봇 사용자 확인
    checkTimeout();
    const botUser = await getOrCreateBotUser();
    if (!botUser) {
      return NextResponse.json({ ok: false, error: '봇 사용자 확인 실패' }, { status: 500 });
    }

    // 크루즈뉘우스 생성 (하루 1개씩) - 봇 활성화 상태와 무관하게 항상 실행
    let newsCreated = false;
    try {
      checkTimeout();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // 오늘 이미 크루즈뉘우스가 생성되었는지 확인
      const existingNews = await prisma.communityPost.findFirst({
        where: {
          userId: botUser.id,
          category: 'cruisedot-news',
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });
      
      if (!existingNews) {
        logger.log('[COMMUNITY BOT] 크루즈뉘우스 생성 시작...');
        const newsData = await generateCruisedotNews();
        
        if (newsData) {
          const newsPost = await prisma.communityPost.create({
            data: {
              userId: botUser.id,
              title: newsData.title,
              content: newsData.html,
              category: newsData.category,
              authorName: '크루즈뉘우스 본사',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          
          newsCreated = true;
          logger.log('[COMMUNITY BOT] 크루즈뉘우스 생성 완료:', newsPost.id);
        } else {
          logger.log('[COMMUNITY BOT] 크루즈뉘우스 생성 실패');
        }
      } else {
        logger.log('[COMMUNITY BOT] 오늘 이미 크루즈뉘우스가 생성되어 있음');
      }
    } catch (error) {
      logger.error('[COMMUNITY BOT] 크루즈뉘우스 생성 중 오류 (무시)', { error: error instanceof Error ? error.message : String(error) });
    }

    // 봇 활성화 상태 확인 (커뮤니티 게시글/댓글/대댓글에만 적용)
    const botConfig = await prisma.systemConfig.findUnique({
      where: { configKey: 'community_bot_active' },
    });

    const isBotActive = botConfig?.configValue === 'true';
    
    if (!isBotActive) {
      logger.log('[COMMUNITY BOT] 봇이 비활성화되어 있습니다. 커뮤니티 활동을 건너뜁니다.');
      return NextResponse.json({ 
        ok: true, 
        message: '크루즈뉘우스는 생성되었지만, 봇이 비활성화되어 커뮤니티 활동은 하지 않습니다.',
        isActive: false,
        newsCreated 
      });
    }

    // 1. 일반 게시글 생성
    checkTimeout();
    const postData = await generatePost();
    if (!postData) {
      return NextResponse.json({ ok: false, error: '게시글 생성 실패' }, { status: 500 });
    }

    logger.log('[COMMUNITY BOT] 게시글 생성 완료:', postData.title);

    // 2. 게시글 저장 (2023년 6월 1일부터 현재까지 랜덤 날짜)
    const postDate = getRandomPostDate();
    const post = await prisma.communityPost.create({
      data: {
        userId: botUser.id,
        title: postData.title,
        content: postData.content,
        category: postData.category,
        authorName: KOREAN_NICKNAMES[Math.floor(Math.random() * KOREAN_NICKNAMES.length)],
        createdAt: postDate,
        updatedAt: postDate
      }
    });
    
    logger.log(`[COMMUNITY BOT] 게시글 날짜: ${postDate.toISOString()}`);
    logger.log('[COMMUNITY BOT] 게시글 저장 완료:', post.id);

    // 3. 댓글 생성 (게시글에 맞는 자연스러운 댓글)
    checkTimeout();
    const commentContent = await generateComment(postData.title, postData.content, postData.category);
    
    if (commentContent) {
      // 댓글 작성자 (봇이 아닌 다른 사용자처럼 보이게)
      const commentAuthor = KOREAN_NICKNAMES[Math.floor(Math.random() * KOREAN_NICKNAMES.length)];
      // 게시글 날짜 기준 7일 이내 랜덤 날짜
      const commentDate = getRandomCommentDate(postDate);
      
      await prisma.communityComment.create({
        data: {
          postId: post.id,
          userId: botUser.id, // 봇 계정이지만 다른 닉네임 사용
          content: commentContent,
          authorName: commentAuthor,
          createdAt: commentDate,
          updatedAt: commentDate
        }
      });
      
      logger.log(`[COMMUNITY BOT] 댓글 날짜: ${commentDate.toISOString()}`);

      // 게시글 댓글 수 업데이트
      await prisma.communityPost.update({
        where: { id: post.id },
        data: {
          comments: { increment: 1 }
        }
      });

      logger.log('[COMMUNITY BOT] 댓글 저장 완료');
    }

    // 4. 기존 게시글에 댓글/대댓글 생성 (2-3개 게시글)
    let existingPostCommentsCreated = 0;
    let repliesCreated = 0;
    try {
      // 활성 게시글 중 랜덤으로 2-3개 선택
      const activePosts = await prisma.communityPost.findMany({
        where: {
          isDeleted: false
        },
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          createdAt: true // 게시글 날짜 필요
        },
        take: 50, // 최근 50개 중에서 선택
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (activePosts.length > 0) {
        // 랜덤으로 2-3개 선택
        const selectedPosts = activePosts
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(3, activePosts.length));

        for (const selectedPost of selectedPosts) {
          try {
            checkTimeout(); // 각 게시글 처리 전 타임아웃 체크
            
            // 기존 게시글에 댓글 생성
            const commentContent = await generateComment(
              selectedPost.title,
              selectedPost.content || '',
              selectedPost.category || 'travel-tip'
            );

            if (commentContent) {
              const commentAuthor = KOREAN_NICKNAMES[Math.floor(Math.random() * KOREAN_NICKNAMES.length)];
              // 게시글 날짜 기준 7일 이내 랜덤 날짜
              const postCreatedAt = selectedPost.createdAt ? new Date(selectedPost.createdAt) : new Date();
              const commentDate = getRandomCommentDate(postCreatedAt);
              
              const newComment = await prisma.communityComment.create({
                data: {
                  postId: selectedPost.id,
                  userId: botUser.id,
                  content: commentContent,
                  authorName: commentAuthor,
                  createdAt: commentDate,
                  updatedAt: commentDate
                }
              });

              // 게시글 댓글 수 업데이트
              await prisma.communityPost.update({
                where: { id: selectedPost.id },
                data: {
                  comments: { increment: 1 }
                }
              });

              existingPostCommentsCreated++;
              logger.log(`[COMMUNITY BOT] 기존 게시글 ${selectedPost.id}에 댓글 생성 완료`);

              // 50% 확률로 대댓글 생성 (AI끼리 대화)
              if (Math.random() > 0.5) {
                checkTimeout();
                const replyContent = await generateReply(
                  commentContent,
                  commentAuthor,
                  selectedPost.title
                );

                if (replyContent) {
                  const replyAuthor = KOREAN_NICKNAMES[Math.floor(Math.random() * KOREAN_NICKNAMES.length)];
                  // 댓글 날짜 기준, 게시글 기준 7일 이내 랜덤 날짜
                  const replyDate = getRandomReplyDate(commentDate, postCreatedAt);
                  
                  await prisma.communityComment.create({
                    data: {
                      postId: selectedPost.id,
                      userId: botUser.id,
                      content: replyContent,
                      authorName: replyAuthor,
                      parentCommentId: newComment.id,
                      createdAt: replyDate,
                      updatedAt: replyDate
                    }
                  });

                  // 게시글 댓글 수 업데이트
                  await prisma.communityPost.update({
                    where: { id: selectedPost.id },
                    data: {
                      comments: { increment: 1 }
                    }
                  });

                  repliesCreated++;
                  logger.log(`[COMMUNITY BOT] 댓글 ${newComment.id}에 대댓글 생성 완료`);
                }
              }
            }
          } catch (error) {
            logger.error(`[COMMUNITY BOT] 게시글 ${selectedPost.id} 댓글 생성 실패 (무시)`, { error: error instanceof Error ? error.message : String(error) });
          }
        }
      }
    } catch (error) {
      logger.error('[COMMUNITY BOT] 기존 게시글 댓글 생성 실패 (무시)', { error: error instanceof Error ? error.message : String(error) });
    }

    // 5. 부정적 댓글 감지 및 긍정적 대응 (최근 댓글 중 1-2개 확인)
    let positiveResponsesCreated = 0;
    try {
      // 최근 댓글 중 봇이 작성하지 않은 댓글 확인 (실제 유저 댓글)
      const recentComments = await prisma.communityComment.findMany({
        where: {
          userId: { not: botUser.id }, // 봇이 아닌 실제 유저 댓글만
          parentCommentId: null, // 대댓글이 아닌 댓글만
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 최근 24시간 내
          }
        },
        include: {
          Post: {
            select: {
              id: true,
              title: true,
              content: true,
              createdAt: true // 게시글 날짜 필요
            }
          }
        },
        take: 10,
        orderBy: {
          createdAt: 'desc'
        }
      });

      // 랜덤으로 1-2개 선택하여 부정적 댓글 감지
      const commentsToCheck = recentComments
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(2, recentComments.length));

      for (const comment of commentsToCheck) {
        try {
          checkTimeout(); // 각 댓글 처리 전 타임아웃 체크
          
          // 부정적 댓글 감지
          const isNegative = await detectNegativeSentiment(comment.content);
          
          if (isNegative) {
            // 이미 긍정적 대응이 있는지 확인 (중복 방지)
            const existingResponse = await prisma.communityComment.findFirst({
              where: {
                postId: comment.postId,
                parentCommentId: comment.id,
                userId: botUser.id
              }
            });

            if (!existingResponse && comment.Post) {
              checkTimeout();
              
              // 긍정적 대응 댓글 생성
              const positiveResponse = await generatePositiveResponse(
                comment.content,
                comment.Post.title,
                comment.Post.content || ''
              );

              if (positiveResponse) {
                const responseAuthor = KOREAN_NICKNAMES[Math.floor(Math.random() * KOREAN_NICKNAMES.length)];
                // 부정적 댓글 날짜 기준, 게시글 기준 7일 이내 랜덤 날짜
                const commentCreatedAt = comment.createdAt ? new Date(comment.createdAt) : new Date();
                // 게시글 날짜 가져오기
                const postCreatedAt = comment.Post?.createdAt ? new Date(comment.Post.createdAt) : commentCreatedAt;
                const responseDate = getRandomReplyDate(commentCreatedAt, postCreatedAt);
                
                await prisma.communityComment.create({
                  data: {
                    postId: comment.postId,
                    userId: botUser.id,
                    content: positiveResponse,
                    authorName: responseAuthor,
                    parentCommentId: comment.id,
                    createdAt: responseDate,
                    updatedAt: responseDate
                  }
                });

                // 게시글 댓글 수 업데이트
                await prisma.communityPost.update({
                  where: { id: comment.postId },
                  data: {
                    comments: { increment: 1 }
                  }
                });

                positiveResponsesCreated++;
                logger.log(`[COMMUNITY BOT] 부정적 댓글 ${comment.id}에 긍정적 대응 생성 완료`);
              }
            }
          }
        } catch (error) {
          logger.error(`[COMMUNITY BOT] 댓글 ${comment.id} 감정 분석 실패 (무시)`, { error: error instanceof Error ? error.message : String(error) });
        }
      }
    } catch (error) {
      logger.error('[COMMUNITY BOT] 부정적 댓글 대응 실패 (무시)', { error: error instanceof Error ? error.message : String(error) });
    }

    // 6. 기존 게시글에 좋아요와 뷰 증가 (5분마다 4개씩)
    try {
      const activePosts = await prisma.communityPost.findMany({
        where: {
          isDeleted: false
        },
        select: {
          id: true
        },
        take: 100
      });

      if (activePosts.length > 0) {
        const selectedPosts = activePosts
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(4, activePosts.length));

        for (const selectedPost of selectedPosts) {
          await prisma.communityPost.update({
            where: { id: selectedPost.id },
            data: {
              likes: { increment: 4 },
              views: { increment: 4 }
            }
          });
        }

        logger.log(`[COMMUNITY BOT] ${selectedPosts.length}개 게시글에 좋아요/뷰 증가 완료`);
      }
    } catch (error) {
      logger.error('[COMMUNITY BOT] 좋아요/뷰 증가 실패 (무시)', { error: error instanceof Error ? error.message : String(error) });
    }

    const executionTime = Date.now() - startTime;
    logger.log(`[COMMUNITY BOT] 봇 실행 완료 (${executionTime}ms)`);
    
    return NextResponse.json({
      ok: true,
      message: '게시글과 댓글이 생성되었습니다.',
      newsCreated,
      post: {
        id: post.id,
        title: post.title,
        category: post.category
      },
      commentCreated: !!commentContent,
      existingPostComments: existingPostCommentsCreated,
      replies: repliesCreated,
      positiveResponses: positiveResponsesCreated,
      executionTime: `${executionTime}ms`
    });
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    logger.error('[COMMUNITY BOT] 오류', { error: error instanceof Error ? error.message : String(error), executionTime: `${executionTime}ms` });

    return NextResponse.json({
      ok: false,
      error: '봇 실행 실패',
      executionTime: `${executionTime}ms`
    }, { status: 500 });
  }
}

/**
 * GET: 테스트용 (실제 운영에서는 제거 권장)
 */
export async function GET(req: Request) {
  try {
    // 개발 환경에서만 허용
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: '프로덕션에서는 GET 메서드를 사용할 수 없습니다.' }, { status: 403 });
    }

    logger.log('[COMMUNITY BOT] 테스트 실행...');

    // 봇 사용자 확인
    const botUser = await getOrCreateBotUser();
    if (!botUser) {
      return NextResponse.json({ ok: false, error: '봇 사용자 확인 실패' }, { status: 500 });
    }

    // 게시글 생성 테스트
    const postData = await generatePost();
    if (!postData) {
      return NextResponse.json({ ok: false, error: '게시글 생성 실패' }, { status: 500 });
    }

    // 댓글 생성 테스트
    const commentContent = await generateComment(postData.title, postData.content, postData.category);

    return NextResponse.json({
      ok: true,
      message: '테스트 완료 (실제 저장 안 함)',
      generatedPost: postData,
      generatedComment: commentContent
    });
  } catch (error: any) {
    logger.error('[COMMUNITY BOT] 테스트 오류', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({
      ok: false,
      error: '테스트 실패',
    }, { status: 500 });
  }
}
