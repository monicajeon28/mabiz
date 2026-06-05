import { logger } from '@/lib/logger';
import { sendEmail, getOrgEmailConfig } from '@/lib/email';

/**
 * Loop 5: Email 자동화 (Day 0 + Day 2)
 * PASONA 프레임워크 + HTML 템플릿
 */

export type Segment = 'A' | 'B' | 'C' | 'D' | 'E';
export type ABVariant = 'a' | 'b';

interface EmailSendResult {
  success: boolean;
  error?: string;
}

/**
 * Segment별 이메일 제목 생성
 */
function getEmailSubject(
  segment: Segment,
  day: number,
  variant: ABVariant = 'a'
): string {
  const subjects: Record<Segment, Record<number, Record<ABVariant, string>>> = {
    A: {
      0: {
        a: '🎁 신혼 부부를 위한 럭셀리 허니문 크루즈 - 50% 할인',
        b: '당신의 특별한 추억을 위한 제안입니다',
      },
      2: {
        a: '24시간 남았어요 - 프리미엄 허니문 패키지 한정 혜택',
        b: '마지막 예약 기회: 당신을 위한 객실이 남아있습니다',
      },
    },
    B: {
      0: {
        a: '👨‍👩‍👧‍👦 가족과 함께하는 특별한 추억 - 4인 정가 패키지',
        b: '자녀와의 소중한 경험을 선물해보세요',
      },
      2: {
        a: '내일 자정 마감 - 패밀리 크루즈 특별 가격 마지막 기회',
        b: '아이들이 잊지 못할 경험, 지금 예약하세요',
      },
    },
    C: {
      0: {
        a: '🌍 유럽 16개 항구 탐방 - 문화여행 전문 크루즈',
        b: '세계 문화를 경험하는 우아한 여정',
      },
      2: {
        a: '오늘이 마지막입니다 - 유럽 탐방 패키지 한정 예약',
        b: '문화 여행을 꿈꾸셨다면, 지금이 기회입니다',
      },
    },
    D: {
      0: {
        a: '👑 럭셀리한 경험을 원하시나요? VIP 크루즈 -30%',
        b: '인생 마지막 우아한 경험, 크루즈닷이 준비했습니다',
      },
      2: {
        a: '한정 객실 2개 남음 - VIP 크루즈 가격 인상 전 예약',
        b: '소수정원 VIP 경험, 더 이상 기다릴 수 없습니다',
      },
    },
    E: {
      0: {
        a: '🏥 건강하고 안전한 휴식 - 시니어 맞춤 의료 동반 크루즈',
        b: '건강하게 즐기는 특별한 크루즈 경험',
      },
      2: {
        a: '내일 마감 - 의료진 동반 시니어 크루즈 최후 예약',
        b: '건강하고 안전한 경험, 마지막 기회입니다',
      },
    },
  };

  return subjects[segment]?.[day]?.[variant] || '크루즈닷 특별 제안';
}

/**
 * Day 0 Welcome Email HTML 생성
 */
function generateDay0EmailHTML(
  segment: Segment,
  variant: ABVariant,
  contactName?: string,
  contactId?: string
): string {
  const name = contactName ? contactName.split(' ')[0] : '고객님';

  const segmentData: Record<
    Segment,
    { title: string; subtitle: string; benefits: string[]; price: string; image: string }
  > = {
    A: {
      title: '신혼부부를 위한 럭셀리 허니문',
      subtitle: '로맨틱한 지중해에서 둘만의 추억을 만들어보세요',
      benefits: [
        '스위트룸 업그레이드 무료',
        '샴페인 저녁 디너 2회 포함',
        '커플 스파 체험 무료',
        '해변 로맨틱 프러포즈 세팅',
      ],
      price: '550만원 → 275만원 (50% 할인)',
      image: 'https://cruisedot.com/images/honeymoon.jpg',
    },
    B: {
      title: '가족과 함께하는 즐거운 크루즈',
      subtitle: '아이들이 안전하게 즐길 수 있는 모든 것이 준비되어 있습니다',
      benefits: [
        '4인 가족실 예약',
        '키즈 클럽 무제한 이용',
        '가족 디너 쿠폰 4매',
        '수영장 VIP 라운지 액세스',
      ],
      price: '정가 유지 (조기 예약 특혜)',
      image: 'https://cruisedot.com/images/family.jpg',
    },
    C: {
      title: '문화를 경험하는 우아한 여정',
      subtitle: '유럽 16개 항구에서 세계 문화를 만나다',
      benefits: [
        '14박 15일 완전 일정',
        '가이드 투어 포함 (8개 항구)',
        '저녁 문화공연 8회',
        '와인 테이스팅 세미나',
      ],
      price: '850만원 → 680만원 (20% 할인)',
      image: 'https://cruisedot.com/images/europe.jpg',
    },
    D: {
      title: '럭셀리한 경험의 정점',
      subtitle: '세계 최고급 크루즈에서 경험하는 진정한 품격',
      benefits: [
        '그랜드 스위트 할당 (한정 3개)',
        '컨시어지 서비스 24시간',
        'a la carte 다이닝 무료',
        '프라이빗 비치 클럽 액세스',
      ],
      price: '1,200만원 → 840만원 (30% 할인)',
      image: 'https://cruisedot.com/images/luxury.jpg',
    },
    E: {
      title: '건강하고 안전한 특별 경험',
      subtitle: '의료진과 함께하는 편안한 크루즈 여정',
      benefits: [
        '선박 내 24시간 의료 서비스',
        '무염식/저염식 식사 맞춤',
        '혈압/혈당 모니터링 서비스',
        '이동 보조 기구 무료 대여',
      ],
      price: '620만원 → 580만원 (특가)',
      image: 'https://cruisedot.com/images/senior.jpg',
    },
  };

  const data = segmentData[segment];

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailSubject(segment, 0, variant)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #0066cc, #0099ff); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 40px 20px; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #333; }
    .offer-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
    .price { font-size: 24px; color: #d73f3f; font-weight: bold; margin: 15px 0; }
    .benefits { list-style: none; padding: 0; margin: 20px 0; }
    .benefits li { padding: 8px 0; padding-left: 24px; position: relative; color: #555; }
    .benefits li:before { content: '✓'; position: absolute; left: 0; color: #28a745; font-weight: bold; }
    .cta-button { display: inline-block; background: #0066cc; color: white; padding: 15px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚢 크루즈닷</h1>
      <p>${data.subtitle}</p>
    </div>

    <div class="content">
      <p class="greeting">${name}님께,</p>

      <p>당신을 위해 특별히 준비한 패키지가 있습니다.</p>

      <div class="offer-box">
        <h2 style="margin: 0 0 10px 0; color: #333;">${data.title}</h2>
        <p style="margin: 10px 0; color: #666;">${data.subtitle}</p>
        <div class="price">${data.price}</div>
        <p style="margin: 10px 0; color: #d73f3f; font-weight: bold;">⏰ 내일 오후까지만 유효합니다!</p>
      </div>

      <h3 style="color: #333;">이 패키지에 포함된 것</h3>
      <ul class="benefits">
        ${data.benefits.map((b) => `<li>${b}</li>`).join('')}
      </ul>

      <p style="color: #666; line-height: 1.6;">
        크루즈닷의 고객 96% 이상이 재예약을 선택합니다.<br>
        왜일까요? 직접 확인해보세요.
      </p>

      <center>
        <a href="https://cruisedot.com/book?segment=${segment}&variant=${variant}" class="cta-button">
          지금 예약하기
        </a>
      </center>

      <p style="margin-top: 30px; color: #999; font-size: 14px;">
        이 가격은 내일 자정까지만 유효합니다.<br>
        선금 0원, 취소 수수료 무료 정책도 계속 적용됩니다.
      </p>
    </div>

    <div class="footer">
      <p>© 2026 cruisedot.com | 문의: ${process.env.BRAND_CONTACT_EMAIL ?? 'contact@cruisedot.com'}</p>
      <p>
        <a href="${process.env.UNSUBSCRIBE_BASE_URL ? `${process.env.UNSUBSCRIBE_BASE_URL}?contactId=${contactId}` : '#'}" style="color: #0066cc; text-decoration: none;">수신거부</a> |
        <a href="#" style="color: #0066cc; text-decoration: none;">개인정보처리방침</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Day 2 Follow-up Email HTML 생성 (상세 버전)
 */
function generateDay2EmailHTML(
  segment: Segment,
  variant: ABVariant,
  contactName?: string,
  contactId?: string
): string {
  const name = contactName ? contactName.split(' ')[0] : '고객님';

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailSubject(segment, 2, variant)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #cc0000, #ff3333); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .urgent { background: #ffe6e6; border-left: 4px solid #cc0000; padding: 20px; margin: 20px; }
    .content { padding: 40px 20px; }
    .cta-button { display: inline-block; background: #cc0000; color: white; padding: 15px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; font-size: 16px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
    .inventory { background: #f0f0f0; padding: 15px; border-radius: 4px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ 마지막 기회입니다</h1>
      <p>내일 자정까지만 이 가격이 유지됩니다</p>
    </div>

    <div class="urgent">
      <h2 style="margin: 0; color: #cc0000;">⚠️ ${name}님, 더 이상 기다릴 수 없습니다</h2>
      <p style="margin: 10px 0;">
        어제 보낸 특별 제안을 아직 예약하지 못하셨다면,<br>
        <strong>지금이 절대 마지막 기회입니다.</strong>
      </p>
    </div>

    <div class="content">
      <h3 style="color: #333;">현재 예약 현황</h3>
      <div class="inventory">
        <p style="margin: 0;">
          <strong>⭐ 한정 객실: 1-2개 남음</strong><br>
          ${segment === 'A' ? '프리미엄 스위트' : segment === 'B' ? '패밀리 스위트' : segment === 'C' ? '발코니 스위트' : segment === 'D' ? '그랜드 스위트' : '의료진 동반실'}만 남아 있습니다.
        </p>
      </div>

      <h3 style="color: #333;">왜 이제 결정해야 할까요?</h3>
      <ul style="color: #555; line-height: 1.8;">
        <li>✈️ <strong>가격 인상</strong> - 내일 자정 후 정가 적용</li>
        <li>📍 <strong>객실 선택 제한</strong> - 한정 객실이 거의 없습니다</li>
        <li>🎯 <strong>최고 조건 보증</strong> - 지금이 최저가입니다</li>
      </ul>

      <h3 style="color: #333; margin-top: 30px;">마지막 확인</h3>
      <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 15px 0;">
        <p style="margin: 0;">
          <strong style="color: #0066cc;">선금</strong>: 0원<br>
          <strong style="color: #0066cc;">취소 수수료</strong>: 무료<br>
          <strong style="color: #0066cc;">출발일</strong>: 다음달 10일<br>
          <strong style="color: #cc0000;">가격</strong>: 지금 가격 보장
        </p>
      </div>

      <center>
        <a href="https://cruisedot.com/book?segment=${segment}&variant=${variant}&source=day2email" class="cta-button">
          지금 예약 확정하기
        </a>
      </center>

      <p style="margin-top: 30px; color: #cc0000; font-weight: bold; text-align: center;">
        24시간 후 이 가격과 혜택은 더 이상 유효하지 않습니다.
      </p>
    </div>

    <div class="footer">
      <p>© 2026 cruisedot.com | 긴급 문의: ${process.env.BRAND_CONTACT_PHONE ?? '1644-1234'}</p>
      <p>
        <a href="${process.env.UNSUBSCRIBE_BASE_URL ? `${process.env.UNSUBSCRIBE_BASE_URL}?contactId=${contactId}` : '#'}" style="color: #cc0000; text-decoration: none;">수신거부</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Day 0 Welcome Email 발송
 */
export async function sendDay0Email(
  organizationId: string,
  contactId: string,
  email: string,
  segment: Segment,
  contactName?: string,
  variant: ABVariant = 'a'
): Promise<EmailSendResult> {
  try {
    // 이메일 설정 조회
    const emailConfig = await getOrgEmailConfig(organizationId);

    if (!emailConfig || !emailConfig.isActive) {
      logger.warn('[Loop5 Email] 이메일 설정이 없거나 비활성화됨', { organizationId });
      return {
        success: false,
        error: 'Email configuration not found or inactive',
      };
    }

    // 이메일 형식 검증
    if (!email || !email.includes('@')) {
      return { success: false, error: 'invalid_email' };
    }

    // HTML 생성
    const html = generateDay0EmailHTML(segment, variant, contactName, contactId);
    const subject = getEmailSubject(segment, 0, variant);

    // 발송
    const success = await sendEmail({
      smtpHost: emailConfig.smtpHost,
      smtpPort: emailConfig.smtpPort,
      smtpUser: emailConfig.smtpUser,
      smtpPassEncrypted: emailConfig.smtpPassEncrypted,
      senderName: emailConfig.senderName,
      senderEmail: emailConfig.senderEmail,
      to: email,
      subject,
      html,
    });

    logger.log('[Loop5 Email] Day 0 발송', {
      contactId,
      email,
      success,
    });

    return { success };
  } catch (error: unknown) {
    logger.error('[sendDay0Email] 오류', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Day 2 Follow-up Email 발송
 */
export async function sendDay2Email(
  organizationId: string,
  contactId: string,
  email: string,
  segment: Segment,
  contactName?: string,
  variant: ABVariant = 'a'
): Promise<EmailSendResult> {
  try {
    const emailConfig = await getOrgEmailConfig(organizationId);

    if (!emailConfig || !emailConfig.isActive) {
      logger.warn('[Loop5 Email] 이메일 설정이 없거나 비활성화됨', { organizationId });
      return {
        success: false,
        error: 'Email configuration not found or inactive',
      };
    }

    // 이메일 형식 검증
    if (!email || !email.includes('@')) {
      return { success: false, error: 'invalid_email' };
    }

    const html = generateDay2EmailHTML(segment, variant, contactName, contactId);
    const subject = getEmailSubject(segment, 2, variant);

    const success = await sendEmail({
      smtpHost: emailConfig.smtpHost,
      smtpPort: emailConfig.smtpPort,
      smtpUser: emailConfig.smtpUser,
      smtpPassEncrypted: emailConfig.smtpPassEncrypted,
      senderName: emailConfig.senderName,
      senderEmail: emailConfig.senderEmail,
      to: email,
      subject,
      html,
    });

    logger.log('[Loop5 Email] Day 2 발송', {
      contactId,
      email,
      success,
    });

    return { success };
  } catch (error: unknown) {
    logger.error('[sendDay2Email] 오류', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
