// lib/affiliate/document-generator.ts
// 서류 생성 유틸리티 (타사 비교 견적서, 구매확인서, 환불완료증서)

import prisma from '@/lib/prisma';

/**
 * 타사 비교 견적서 생성
 * - 고객에게 여러 상품 옵션을 비교하여 제공하는 견적서
 */
export async function generateComparisonQuote(data: {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  productCode: string;
  productName?: string;
  ourPrice: number;
  competitorPrices: Array<{
    companyName: string;
    price: number;
    notes?: string;
  }>;
  headcount?: number;
  cabinType?: string;
  fareCategory?: string;
  responsibleName: string;
  responsibleRole: '대리점장' | '판매원';
  saleId?: number;
  leadId?: number;
}) {
  const formattedOurPrice = data.ourPrice.toLocaleString('ko-KR');
  const formattedDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // SMS/카카오톡용 간단한 템플릿
  const smsTemplate = `[타사 비교 견적서]

${data.customerName}님, 견적서를 준비했습니다!

📦 상품: ${data.productName || data.productCode}
💰 우리 가격: ${formattedOurPrice}원
${data.headcount ? `👥 인원수: ${data.headcount}명` : ''}
${data.cabinType ? `🛏️ 객실타입: ${data.cabinType}` : ''}

타사 가격 비교:
${data.competitorPrices.map((cp, idx) => `${idx + 1}. ${cp.companyName}: ${cp.price.toLocaleString('ko-KR')}원${cp.notes ? ` (${cp.notes})` : ''}`).join('\n')}

담당 ${data.responsibleRole}: ${data.responsibleName}

자세한 내용은 이메일로 발송해드렸습니다.
문의사항이 있으시면 언제든지 연락주세요! 🛳️`;

  // 이메일용 HTML 템플릿
  const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .info-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; }
    .comparison-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden; }
    .comparison-table th { background: #667eea; color: white; padding: 12px; text-align: left; }
    .comparison-table td { padding: 12px; border-bottom: 1px solid #eee; }
    .comparison-table tr:last-child td { border-bottom: none; }
    .our-price { background: #e8f5e9; font-weight: bold; }
    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>타사 비교 견적서</h1>
      <p>${data.customerName}님을 위한 맞춤 견적서입니다</p>
    </div>
    <div class="content">
      <p>안녕하세요, <strong>${data.customerName}</strong>님,</p>
      <p>요청하신 크루즈 여행 상품에 대한 견적서를 준비했습니다. 타사 가격과 비교하여 최적의 옵션을 제안해드립니다.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #667eea;">상품 정보</h3>
        <div class="info-row">
          <span class="label">상품명</span>
          <span class="value">${data.productName || data.productCode}</span>
        </div>
        ${data.headcount ? `<div class="info-row"><span class="label">인원수</span><span class="value">${data.headcount}명</span></div>` : ''}
        ${data.cabinType ? `<div class="info-row"><span class="label">객실타입</span><span class="value">${data.cabinType}</span></div>` : ''}
        ${data.fareCategory ? `<div class="info-row"><span class="label">요금카테고리</span><span class="value">${data.fareCategory}</span></div>` : ''}
        <div class="info-row">
          <span class="label">견적일자</span>
          <span class="value">${formattedDate}</span>
        </div>
        <div class="info-row">
          <span class="label">담당 ${data.responsibleRole}</span>
          <span class="value">${data.responsibleName}</span>
        </div>
      </div>

      <div class="info-box">
        <h3 style="margin-top: 0; color: #667eea;">가격 비교</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>업체명</th>
              <th>가격</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr class="our-price">
              <td><strong>우리 상품</strong></td>
              <td><strong>${formattedOurPrice}원</strong></td>
              <td><strong>추천</strong></td>
            </tr>
            ${data.competitorPrices.map(cp => `
              <tr>
                <td>${cp.companyName}</td>
                <td>${cp.price.toLocaleString('ko-KR')}원</td>
                <td>${cp.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <p>추가 문의사항이 있으시면 언제든지 연락주세요.</p>
      <p>즐거운 여행 되세요! 🛳️</p>
      
      <div class="footer">
        <p>본 견적서는 ${formattedDate} 기준으로 작성되었으며, 가격은 변동될 수 있습니다.</p>
        <p>본 메일은 자동으로 발송된 메일입니다.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    sms: smsTemplate,
    email: emailTemplate,
    subject: `[타사 비교 견적서] ${data.productName || data.productCode} 견적서`,
  };
}

/**
 * 환불완료증서 생성
 * - 환불 처리가 완료된 고객에게 발송하는 증서
 */
export async function generateRefundCertificate(data: {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  productCode: string;
  productName?: string;
  originalSaleAmount: number;
  refundAmount: number;
  refundDate: string;
  refundReason: string;
  orderCode: string;
  responsibleName: string;
  responsibleRole: '대리점장' | '판매원';
  saleId: number;
}) {
  const formattedOriginalAmount = data.originalSaleAmount.toLocaleString('ko-KR');
  const formattedRefundAmount = data.refundAmount.toLocaleString('ko-KR');
  const formattedRefundDate = new Date(data.refundDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // SMS/카카오톡용 간단한 템플릿
  const smsTemplate = `[환불완료증서]

${data.customerName}님, 환불 처리가 완료되었습니다!

📦 상품: ${data.productName || data.productCode}
💰 원래 결제금액: ${formattedOriginalAmount}원
💵 환불금액: ${formattedRefundAmount}원
📅 환불일자: ${formattedRefundDate}
📋 주문번호: ${data.orderCode}
📝 환불사유: ${data.refundReason}

담당 ${data.responsibleRole}: ${data.responsibleName}

환불금은 영업일 기준 3-5일 내에 입금됩니다.
추가 문의사항이 있으시면 언제든지 연락주세요.`;

  // 이메일용 HTML 템플릿
  const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f5576c; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .info-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; }
    .refund-amount { font-size: 24px; font-weight: bold; color: #f5576c; text-align: center; padding: 20px; background: #fff5f5; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
    .notice { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>환불완료증서</h1>
      <p>환불 처리가 완료되었습니다</p>
    </div>
    <div class="content">
      <p>안녕하세요, <strong>${data.customerName}</strong>님,</p>
      <p>요청하신 환불 처리가 완료되었습니다. 아래 내용을 확인해주세요.</p>
      
      <div class="refund-amount">
        환불금액: ${formattedRefundAmount}원
      </div>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #f5576c;">환불 정보</h3>
        <div class="info-row">
          <span class="label">상품명</span>
          <span class="value">${data.productName || data.productCode}</span>
        </div>
        <div class="info-row">
          <span class="label">주문번호</span>
          <span class="value">${data.orderCode}</span>
        </div>
        <div class="info-row">
          <span class="label">원래 결제금액</span>
          <span class="value">${formattedOriginalAmount}원</span>
        </div>
        <div class="info-row">
          <span class="label">환불금액</span>
          <span class="value"><strong>${formattedRefundAmount}원</strong></span>
        </div>
        <div class="info-row">
          <span class="label">환불일자</span>
          <span class="value">${formattedRefundDate}</span>
        </div>
        <div class="info-row">
          <span class="label">환불사유</span>
          <span class="value">${data.refundReason}</span>
        </div>
        <div class="info-row">
          <span class="label">담당 ${data.responsibleRole}</span>
          <span class="value">${data.responsibleName}</span>
        </div>
      </div>
      
      <div class="notice">
        <strong>안내사항:</strong><br>
        환불금은 영업일 기준 3-5일 내에 결제하신 수단으로 입금됩니다.<br>
        카드 결제의 경우, 카드사 정책에 따라 환불 처리가 지연될 수 있습니다.
      </div>
      
      <p>추가 문의사항이 있으시면 언제든지 연락주세요.</p>
      
      <div class="footer">
        <p>본 메일은 자동으로 발송된 메일입니다.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    sms: smsTemplate,
    email: emailTemplate,
    subject: `[환불완료증서] ${data.productName || data.productCode} 환불 완료`,
  };
}



