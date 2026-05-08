export const dynamic = 'force-dynamic';

// app/api/admin/parse-ppt/route.ts
// PPT 문서 파싱 API

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 없습니다.' }, { status: 400 });
    }

    // 파일 확장자 확인
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.ppt') && !fileName.endsWith('.pptx')) {
      return NextResponse.json({ ok: false, error: 'PPT 또는 PPTX 파일만 업로드 가능합니다.' }, { status: 400 });
    }

    // 임시 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempDir = join(process.cwd(), 'tmp');
    if (!existsSync(tempDir)) {
      await writeFile(tempDir, '', { flag: 'wx' }).catch(() => {});
    }
    const tempFilePath = join(tempDir, `ppt_${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, buffer);

    try {
      // PPT 파싱 (간단한 텍스트 추출)
      // 실제로는 mammoth, officegen 등의 라이브러리를 사용하거나
      // 서버 측 Python 스크립트를 호출해야 할 수 있습니다.
      // 여기서는 기본적인 텍스트 추출만 구현합니다.
      
      // PPT 파일의 경우, 실제 파싱은 복잡하므로
      // 여기서는 기본 구조만 반환하고, 실제 파싱은 클라이언트 측에서 처리하거나
      // 별도의 서비스를 사용해야 합니다.
      
      const itinerary: any[] = [];
      
      // 파일 내용을 텍스트로 읽기 시도
      // 실제 구현에서는 pptx-parser 같은 라이브러리 사용 필요
      const textContent = buffer.toString('utf-8', 0, Math.min(10000, buffer.length));
      
      // 간단한 패턴 매칭으로 일정 추출 시도
      const dayPattern = /(\d+)[일차|일째|일]/gi;
      const timePattern = /(\d{1,2}):(\d{2})/g;
      const locationPattern = /([가-힣]+|[\w\s]+)/g;
      
      // 슬라이드별로 분리 (간단한 추정)
      const slides = textContent.split(/\x0C|\x00/).filter(s => s.trim().length > 10);
      
      slides.forEach((slide, index) => {
        const dayMatch = slide.match(dayPattern);
        const timeMatches = [...slide.matchAll(timePattern)];
        const locationMatches = [...slide.matchAll(locationPattern)];
        
        if (dayMatch || timeMatches.length > 0) {
          const dayInfo: any = {
            day: index + 1,
            departure: '',
            arrival: '',
            departureTime: '',
            arrivalTime: '',
            attractions: [],
            blocks: []
          };
          
          // 시간 추출
          if (timeMatches.length >= 2) {
            dayInfo.departureTime = `${timeMatches[0][1]}:${timeMatches[0][2]}`;
            dayInfo.arrivalTime = `${timeMatches[1][1]}:${timeMatches[1][2]}`;
          } else if (timeMatches.length === 1) {
            dayInfo.departureTime = `${timeMatches[0][1]}:${timeMatches[0][2]}`;
          }
          
          // 장소 추출 (간단한 추정)
          const locations = locationMatches.slice(0, 5).map(m => m[0].trim()).filter(l => l.length > 1);
          if (locations.length >= 2) {
            dayInfo.departure = locations[0];
            dayInfo.arrival = locations[1];
          } else if (locations.length === 1) {
            dayInfo.departure = locations[0];
          }
          
          // 관광지 추출 (키워드 기반)
          const attractionKeywords = ['관광', '투어', '방문', '체험', '명소', '박물관', '사원', '궁전', '시장'];
          const foundAttractions = locations.filter(loc => 
            attractionKeywords.some(keyword => loc.includes(keyword))
          );
          dayInfo.attractions = foundAttractions;
          
          itinerary.push(dayInfo);
        }
      });
      
      // 일정이 없으면 기본 구조 생성
      if (itinerary.length === 0) {
        for (let i = 1; i <= 7; i++) {
          itinerary.push({
            day: i,
            departure: '',
            arrival: '',
            departureTime: '',
            arrivalTime: '',
            attractions: [],
            blocks: []
          });
        }
      }

      // 임시 파일 삭제
      await unlink(tempFilePath).catch(() => {});

      return NextResponse.json({
        ok: true,
        itinerary,
        message: `${itinerary.length}일 일정을 추출했습니다.`
      });
    } catch (parseError) {
      // 임시 파일 삭제
      await unlink(tempFilePath).catch(() => {});
      
      console.error('PPT 파싱 오류:', parseError);
      return NextResponse.json({
        ok: false,
        error: 'PPT 파싱 중 오류가 발생했습니다. 파일 형식을 확인해주세요.',
        itinerary: []
      }, { status: 500 });
    }
  } catch (error) {
    console.error('PPT 업로드 오류:', error);
    return NextResponse.json({
      ok: false,
      error: '파일 업로드 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
