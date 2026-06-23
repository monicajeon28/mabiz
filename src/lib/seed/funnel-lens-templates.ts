#!/usr/bin/env npx tsx
/**
 * Funnel Lens Templates Seed Script
 *
 * 렌즈별 기본 퍼널 템플릿을 DB에 로드합니다.
 * 모든 조직이 공유하는 PUBLIC 템플릿입니다 (organizationId = GLOBAL_ORG_ID).
 *
 * 실행 방법:
 *   npx tsx src/lib/seed/funnel-lens-templates.ts
 *
 * 구조:
 *   - Funnel (10개): L0-L10 렌즈별 기본 템플릿
 *     - FunnelSmsMessage (4개/Funnel): Day 0-3 SMS 시퀀스
 *     - FunnelEmailMessage (4개/Funnel): Day 0-3 이메일 시퀀스
 *
 * 2026-06-24 작성
 */

// 환경변수 미리 로드
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
  console.error('설정 방법: export DATABASE_URL="postgresql://..."');
  process.exit(1);
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 전역 조직 ID (모든 조직이 공유하는 템플릿용)
const GLOBAL_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-cruisedot-main';

const FUNNEL_LENS_TEMPLATES: Record<string, any> = {
  L0: {
    name: "L0: 부재중 고객 자동메시지",
    description: "3-12개월 이상 구매이력 없는 고객 재활성화",
    lensType: "L0",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님, 안녕하세요? 저는 {담당자}입니다. 당신을 정말 그리워했어요. 지난 크루즈 때의 그 순간 기억나시나요? 우리와 함께였던 날들이 특별했어요.",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "{고객명}님, 당신이 간 크루즈에서 만났던 사람들이 당신을 찾고 있어요. 우리 다시 만날까요? [지금 보기]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "돌아오신 분들을 위해 특별히 준비했어요. 30% 할인 쿠폰! 이번 주말까지만 사용 가능해요. [쿠폰 받기]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "{고객명}님을 초대합니다. [지금 예약하기] 버튼을 클릭해주세요. 당신의 꿈의 크루즈가 시작됩니다. 🚢",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "당신을 정말 그리워했어요 - {고객명}님 특별 초대",
        bodyHtml: '<p>{고객명}님, 안녕하세요?</p><p>저는 {담당자}입니다. 당신을 정말 그리워했어요.</p><p>지난 크루즈 때의 그 순간 기억나시나요? 우리와 함께였던 날들이 특별했어요.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 보기</a></p>',
        previewText: "당신을 정말 그리워했어요",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "{고객명}님, 당신의 친구들이 기다리고 있어요",
        bodyHtml: '<p>{고객명}님,</p><p>당신이 간 크루즈에서 만났던 사람들이 당신을 찾고 있어요.</p><p>우리 다시 만날까요?</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">다시 만나기</a></p>',
        previewText: "당신의 친구들이 기다리고 있어요",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "특별 이벤트: {고객명}님을 위한 30% 할인 쿠폰",
        bodyHtml: '<p>{고객명}님,</p><p>돌아오신 분들을 위해 특별히 준비했어요.</p><p><strong>30% 할인 쿠폰!</strong></p><p>이번 주말까지만 사용 가능해요.</p><p><a href="#" style="background-color: #E74C3C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">쿠폰 받기</a></p>',
        previewText: "30% 할인 쿠폰이 기다리고 있어요",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "{고객명}님을 초대합니다 - 크루즈의 꿈을 시작하세요",
        bodyHtml: '<p>{고객명}님,</p><p>당신의 꿈의 크루즈가 시작됩니다.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 예약하기</a></p><p>더 이상 기다릴 필요 없어요.</p>',
        previewText: "당신의 꿈의 크루즈가 시작됩니다",
        pasonaStage: "ACTION",
      },
    ],
  },
  L1: {
    name: "L1: 가격 민감 고객 자동메시지",
    description: "가격 이의 또는 예산 부족 신호 감지",
    lensType: "L1",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님, 알아요. 가격이 비싸 보여요. 하지만 크루즈 1회 = 기억 무조건 남아요. 400% ROI 효과! [비교 보기]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "경쟁사 대비: Royal은 300만원 → 우리는 250만원. 5가지 추가 포함 무료! [비교표]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "{상품명} = 월 5만원씩 50개월 무이자 할부. 신용카드로 쉽게 결제 가능! [할부계산기]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "{고객명}님, 이 가격은 내일까지만! 5% 추가 할인까지 해드려요. [지금 신청하기]",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "가격이 비싼가요? - {고객명}님을 위한 가치 분석",
        bodyHtml: '<p>{고객명}님,</p><p>크루즈 1회 = 기억 무조건 남아요.</p><p><strong>400% ROI 효과!</strong></p><p><a href="#" style="background-color: #FFD700; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 4px;">가치 분석 보기</a></p>',
        previewText: "가격이 비싼가요? 가치를 비교해보세요",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "{고객명}님, 경쟁사 대비 25% 저렴합니다",
        bodyHtml: '<p>{고객명}님,</p><p><strong>Royal: 300만원</strong><br/><strong>우리: 250만원</strong></p><p>5가지 추가 포함 무료!</p><p><a href="#" style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">비교표 보기</a></p>',
        previewText: "경쟁사보다 25% 저렴합니다",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "무이자 할부 가능 - 월 5만원씩",
        bodyHtml: '<p>{고객명}님,</p><p><strong>{상품명}</strong></p><p>월 5만원씩 50개월 무이자 할부</p><p>신용카드로 쉽게 결제 가능!</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">할부계산기</a></p>',
        previewText: "월 5만원씩 무이자 할부 가능합니다",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "내일까지만! 5% 추가 할인 쿠폰",
        bodyHtml: '<p>{고객명}님,</p><p>이 가격은 <strong>내일까지만!</strong></p><p>5% 추가 할인까지 해드려요.</p><p><a href="#" style="background-color: #E74C3C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 신청하기</a></p>',
        previewText: "내일까지만 5% 추가 할인",
        pasonaStage: "ACTION",
      },
    ],
  },
  L2: {
    name: "L2: 준비 불안감 자동메시지",
    description: "여행 준비 복잡도로 인한 구매 지연",
    lensType: "L2",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님, 여행 준비가 복잡하다고 생각하세요? 아니에요! 우리가 3단계로 아주 쉽게 도와드려요.",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "Step 1: 원하는 날짜 선택. Step 2: 선실 선택. Step 3: 예약 완료! 그게 전부예요. [가이드 보기]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "10년간 5만 명 고객 만족. 평점 4.9⭐ (리뷰 3,247개). [고객 후기 보기]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "{고객명}님, 더 이상 고민하지 마세요. 우리가 24시간 지원해드려요. [지금 시작하기]",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "복잡해 보이나요? - 3단계면 완료됩니다",
        bodyHtml: '<p>{고객명}님,</p><p>여행 준비가 복잡하다고 생각하세요?</p><p>아니에요! 우리가 3단계로 아주 쉽게 도와드려요.</p><p><a href="#" style="background-color: #FF8C00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">3단계 가이드 보기</a></p>',
        previewText: "3단계면 준비 완료됩니다",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "3단계 예약 프로세스",
        bodyHtml: '<p>{고객명}님,</p><p><strong>Step 1:</strong> 원하는 날짜 선택<br/><strong>Step 2:</strong> 선실 선택<br/><strong>Step 3:</strong> 예약 완료!</p><p>그게 전부예요.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 시작</a></p>',
        previewText: "3단계 프로세스입니다",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "10년간 5만 명이 신뢰했습니다 - 평점 4.9⭐",
        bodyHtml: '<p>{고객명}님,</p><p>10년간 5만 명 고객 만족</p><p><strong>평점 4.9⭐</strong> (리뷰 3,247개)</p><p><a href="#" style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">고객 후기 보기</a></p>',
        previewText: "10년간 5만 명이 선택했습니다",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "더 이상 고민하지 마세요 - 24시간 지원",
        bodyHtml: '<p>{고객명}님,</p><p>더 이상 고민하지 마세요.</p><p>우리가 <strong>24시간 지원</strong>해드려요.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 시작하기</a></p>',
        previewText: "24시간 지원해드립니다",
        pasonaStage: "ACTION",
      },
    ],
  },
  L3: {
    name: "L3: 경쟁사 비교 고객 자동메시지",
    description: "경쟁사 검색 또는 비교 신호 감지",
    lensType: "L3",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님, 우리 vs Royal vs Carnival. 객관적으로 비교해봤어요. 우리만의 장점이 뭐냐면? [비교표 보기]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "우리만 제공: 온천, 한식요리, VIP라운지. Royal에는 없어요! [차별성 자세히 보기]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "선택한 이유? 87% \"한국 고객센터\", 92% \"가성비 최고\". [고객 후기 100개 보기]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "결정해야 할 시간이에요. 우리 선택하시고 후회 없으실 거예요. [지금 예약하기]",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "비교하셨나요? - {고객명}님을 위한 객관적 분석",
        bodyHtml: '<p>{고객명}님,</p><p>우리 vs Royal vs Carnival</p><p>객관적으로 비교해봤어요.</p><p><a href="#" style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">비교표 보기</a></p>',
        previewText: "객관적 비교를 보세요",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "우리만 제공합니다 - 온천, 한식, VIP라운지",
        bodyHtml: '<p>{고객명}님,</p><p>우리만 제공:</p><p><strong>온천 + 한식요리 + VIP라운지</strong></p><p>Royal에는 없어요!</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">차별성 자세히 보기</a></p>',
        previewText: "우리만의 차별성을 보세요",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "왜 선택했나요? - 고객 선택 이유 TOP 10",
        bodyHtml: '<p>{고객명}님,</p><p>선택한 이유:</p><p><strong>87%</strong> \"한국 고객센터\"<br/><strong>92%</strong> \"가성비 최고\"</p><p><a href="#" style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">고객 후기 100개 보기</a></p>',
        previewText: "고객들의 선택 이유를 보세요",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "결정의 시간 - 우리를 선택하세요",
        bodyHtml: '<p>{고객명}님,</p><p>결정해야 할 시간이에요.</p><p>우리 선택하시고 후회 없으실 거예요.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 예약하기</a></p>',
        previewText: "우리를 선택하세요",
        pasonaStage: "ACTION",
      },
    ],
  },
  L4: {
    name: "L4: 서류/절차 복잡 자동메시지",
    description: "여권/APIS 신청 또는 서류 관련 문의",
    lensType: "L4",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님, 여권/APIS? 우리가 자동으로 체크해드려요. 5분 걸려요. [지금 시작하기]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "여권 사진 업로드 → APIS 자동 신청 → 완료! 번거로움 없어요. [자동화 보기]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "100% 안전해요. 개인정보 암호화(AES-256) + 자동 삭제(30일후). [보안 정책 보기]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "[지금 시작]하면 내일부터 자동 준비 시작해요. 걱정 없어요! 🎉",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "여권/APIS 자동화 - 5분이면 끝납니다",
        bodyHtml: '<p>{고객명}님,</p><p>여권/APIS 준비가 복잡해 보이나요?</p><p>우리가 <strong>자동으로 체크</strong>해드려요. 5분 걸려요.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 시작하기</a></p>',
        previewText: "5분이면 여권/APIS 준비 완료",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "자동화 프로세스 - 사진 업로드만 하면 됩니다",
        bodyHtml: '<p>{고객명}님,</p><p><strong>Step 1:</strong> 여권 사진 업로드<br/><strong>Step 2:</strong> APIS 자동 신청<br/><strong>Step 3:</strong> 완료!</p><p>번거로움 없어요.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">자동화 보기</a></p>',
        previewText: "자동화 프로세스를 확인하세요",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "100% 안전 - 개인정보 암호화 + 자동 삭제",
        bodyHtml: '<p>{고객명}님,</p><p>100% 안전해요.</p><p><strong>개인정보 암호화</strong> (AES-256)<br/><strong>자동 삭제</strong> (30일후)</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">보안 정책 보기</a></p>',
        previewText: "개인정보 보호가 최우선입니다",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "지금 시작하세요 - 내일부터 자동 준비",
        bodyHtml: '<p>{고객명}님,</p><p>[지금 시작]하면 <strong>내일부터 자동 준비</strong> 시작해요.</p><p>걱정 없어요!</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 시작하기</a></p>',
        previewText: "내일부터 자동 준비 시작",
        pasonaStage: "ACTION",
      },
    ],
  },
  L5: {
    name: "L5: 가족동의 필요 자동메시지",
    description: "가족/배우자 동의 필요한 구매 신호",
    lensType: "L5",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님 + 가족. 크루즈는 함께하는 추억이에요. 아내분께 이것 보여주세요! [함께 보기]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "4인 가족 패키지: 어른 2명 + 아이 2명. 아이 50% 할인! 아이들이 정말 좋아해요. [패키지 보기]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "가족이 함께 보낸 크루즈 = 최고의 추억. 아이도 \"또 가고싶어요\"라고 말해요. [후기 보기]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "[가족 모두 보기] 링크로 공유하세요. 함께 결정하면 더 좋아요! 🎉",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "가족과 함께 만드는 추억 - {고객명}님 + 가족 특별 초대",
        bodyHtml: '<p>{고객명}님,</p><p>크루즈는 <strong>함께하는 추억</strong>이에요.</p><p>아내분께 이것 보여주세요!</p><p><a href="#" style="background-color: #9B59B6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">함께 보기</a></p>',
        previewText: "가족과 함께 추억을 만드세요",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "4인 가족 패키지 - 아이 50% 할인",
        bodyHtml: '<p>{고객명}님,</p><p><strong>4인 가족 패키지</strong></p><p>어른 2명 + 아이 2명</p><p><strong>아이 50% 할인!</strong></p><p>아이들이 정말 좋아해요.</p><p><a href="#" style="background-color: #9B59B6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">패키지 보기</a></p>',
        previewText: "가족 패키지 - 아이 50% 할인",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "가족의 추억 - 고객 후기에서 확인하세요",
        bodyHtml: '<p>{고객명}님,</p><p>가족이 함께 보낸 크루즈 = <strong>최고의 추억</strong></p><p>아이도 \"또 가고싶어요\"라고 말해요.</p><p><a href="#" style="background-color: #9B59B6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">후기 보기</a></p>',
        previewText: "가족의 추억을 보세요",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "함께 결정하세요 - 가족 모두를 위해",
        bodyHtml: '<p>{고객명}님,</p><p>[가족 모두 보기] 링크로 공유하세요.</p><p><strong>함께 결정</strong>하면 더 좋아요!</p><p><a href="#" style="background-color: #9B59B6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">가족 모두 보기</a></p>',
        previewText: "함께 결정하세요",
        pasonaStage: "ACTION",
      },
    ],
  },
  L6: {
    name: "L6: 타이밍/손실회피 자동메시지",
    description: "제한된 시간 또는 선실 한정 상황",
    lensType: "L6",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "지금만 20% 할인이에요. 지나가면 정가로 구매해야 해요. {고객명}님, 시간이 별로 없어요. [지금 보기]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "명일 자정 마감! 선실 3개만 남았어요. 30% 할인은 더 빨리 끝날 거예요. [지금 신청]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "결정 완료했으신가요? 지금이 최고의 시간이에요. 더 이상 기다릴 수 없어요. [마지막 기회]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "[지금 예약 완료]하세요. 더 이상 기다리지 마세요. 이게 마지막 기회예요! ⏰",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "지금만 20% 할인 - 시간이 별로 없어요",
        bodyHtml: '<p>{고객명}님,</p><p>지금만 <strong>20% 할인</strong>이에요.</p><p>지나가면 정가로 구매해야 해요.</p><p>시간이 별로 없어요.</p><p><a href="#" style="background-color: #E74C3C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 보기</a></p>',
        previewText: "지금만 20% 할인입니다",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "명일 자정 마감! 선실 3개만 남았어요",
        bodyHtml: '<p>{고객명}님,</p><p><strong>명일 자정 마감!</strong></p><p>선실 3개만 남았어요.</p><p>30% 할인은 더 빨리 끝날 거예요.</p><p><a href="#" style="background-color: #E74C3C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 신청</a></p>',
        previewText: "명일 자정 마감입니다",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "결정의 시간 - 지금이 최고예요",
        bodyHtml: '<p>{고객명}님,</p><p>결정 완료했으신가요?</p><p><strong>지금이 최고의 시간</strong>이에요.</p><p>더 이상 기다릴 수 없어요.</p><p><a href="#" style="background-color: #E74C3C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">마지막 기회</a></p>',
        previewText: "지금이 최고입니다",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "이게 마지막 기회입니다 - 지금 완료하세요",
        bodyHtml: '<p>{고객명}님,</p><p>[지금 예약 완료]하세요.</p><p><strong>더 이상 기다리지 마세요.</strong></p><p>이게 <strong>마지막 기회</strong>예요!</p><p><a href="#" style="background-color: #E74C3C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 예약 완료</a></p>',
        previewText: "마지막 기회입니다",
        pasonaStage: "ACTION",
      },
    ],
  },
  L7: {
    name: "L7: 시설/편의성 중심 자동메시지",
    description: "시설 또는 편의성 관련 질문",
    lensType: "L7",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님, {상품명}의 시설이 정말 좋아요. 온천, 스파, 뷔페 24시간! [시설 보기]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "[360도 가상투어] 보세요. 선실, 레스토랑, 카지노 다 볼 수 있어요. [투어 시작]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "\"시설이 진짜 좋았어요!\" \"돌아오고 싶어요\" [고객 후기 100개 보기]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "이 최고급 시설 경험해보세요. [지금 예약]하세요! 🌟",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "최고급 시설 - {상품명}의 모든 것",
        bodyHtml: '<p>{고객명}님,</p><p><strong>{상품명}</strong>의 시설이 정말 좋아요.</p><p>온천, 스파, 뷔페 24시간!</p><p><a href="#" style="background-color: #3498DB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">시설 보기</a></p>',
        previewText: "최고급 시설을 확인하세요",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "360도 가상투어 - 선실, 레스토랑, 카지노 전체 보기",
        bodyHtml: '<p>{고객명}님,</p><p><strong>[360도 가상투어]</strong> 보세요.</p><p>선실, 레스토랑, 카지노 다 볼 수 있어요.</p><p><a href="#" style="background-color: #3498DB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">투어 시작</a></p>',
        previewText: "가상투어를 시작하세요",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "고객 후기 - 시설의 품질을 증명합니다",
        bodyHtml: '<p>{고객명}님,</p><p>\"<strong>시설이 진짜 좋았어요!</strong>\"</p><p>\"돌아오고 싶어요\"</p><p><a href="#" style="background-color: #3498DB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">고객 후기 100개 보기</a></p>',
        previewText: "고객들의 평가를 보세요",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "최고급 시설 경험하세요 - 지금 예약",
        bodyHtml: '<p>{고객명}님,</p><p>이 최고급 시설 경험해보세요.</p><p><a href="#" style="background-color: #3498DB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 예약</a></p>',
        previewText: "최고급 시설을 경험하세요",
        pasonaStage: "ACTION",
      },
    ],
  },
  L8: {
    name: "L8: 건강/안전 우려 자동메시지",
    description: "건강 또는 안전 관련 우려",
    lensType: "L8",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님, 건강 안전은 최우선이에요. 탑승 전 무료 건강검사! [안전 정책 보기]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "혹시 모를 경우 격리실 24/7 준비. 의료진도 상주해요. 안심하세요. [준비상황]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "질병보험 자동 포함. 일일 보장금 50만원! 완벽한 보호예요. [보험 안내]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "안전하게 떠나세요. [지금 예약]하시면 건강검사 무료 제공! 🏥",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "건강 안전이 최우선 - {고객명}님을 위한 안전 정책",
        bodyHtml: '<p>{고객명}님,</p><p><strong>건강 안전은 최우선</strong>이에요.</p><p>탑승 전 <strong>무료 건강검사!</strong></p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">안전 정책 보기</a></p>',
        previewText: "건강 안전이 최우선입니다",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "24/7 의료진 상주 - 완벽한 준비",
        bodyHtml: '<p>{고객명}님,</p><p>혹시 모를 경우:</p><p><strong>격리실 24/7 준비</strong><br/><strong>의료진 상주</strong></p><p>안심하세요.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">준비상황</a></p>',
        previewText: "24/7 의료진이 준비되어 있습니다",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "질병보험 자동 포함 - 일일 보장금 50만원",
        bodyHtml: '<p>{고객명}님,</p><p><strong>질병보험 자동 포함</strong></p><p>일일 보장금 50만원!</p><p>완벽한 보호예요.</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">보험 안내</a></p>',
        previewText: "자동보험으로 완벽하게 보호됩니다",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "안전하게 떠나세요 - 건강검사 무료 제공",
        bodyHtml: '<p>{고객명}님,</p><p><strong>안전하게 떠나세요.</strong></p><p>[지금 예약]하시면 <strong>건강검사 무료 제공!</strong></p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 예약</a></p>',
        previewText: "건강검사 무료 제공합니다",
        pasonaStage: "ACTION",
      },
    ],
  },
  L9: {
    name: "L9: 선물/특별날 자동메시지",
    description: "생일, 기념일 등 특별한 날짜 관련",
    lensType: "L9",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님, 남편/아내 생일인가요? 크루즈가 최고의 선물이에요! [선물 패키지]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "선박 위에서 본 바다 석양. 이것보다 로맨틱한 건 없어요. [추억 갤러리]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "샴페인 + 디너 + 케이크 세트. 특가 29.9만원! 따뜻한 추억을 만들어요. [패키지 보기]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "[지금 예약]하세요. 당신의 사랑이 빛날 그 순간 준비해드려요! 💕",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "최고의 선물 - {고객명}님의 특별한 순간",
        bodyHtml: '<p>{고객명}님,</p><p>남편/아내 생일인가요?</p><p><strong>크루즈가 최고의 선물</strong>이에요!</p><p><a href="#" style="background-color: #F39C12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">선물 패키지</a></p>',
        previewText: "크루즈가 최고의 선물입니다",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "로맨틱한 추억 - 바다 석양을 함께하세요",
        bodyHtml: '<p>{고객명}님,</p><p>선박 위에서 본 바다 석양.</p><p>이것보다 로맨틱한 건 없어요.</p><p><a href="#" style="background-color: #F39C12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">추억 갤러리</a></p>',
        previewText: "로맨틱한 추억을 만드세요",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "특별 패키지 - 샴페인 + 디너 + 케이크",
        bodyHtml: '<p>{고객명}님,</p><p><strong>샴페인 + 디너 + 케이크 세트</strong></p><p>특가 29.9만원!</p><p>따뜻한 추억을 만들어요.</p><p><a href="#" style="background-color: #F39C12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">패키지 보기</a></p>',
        previewText: "특별 패키지를 확인하세요",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "당신의 사랑이 빛날 그 순간 - 지금 예약하세요",
        bodyHtml: '<p>{고객명}님,</p><p>[지금 예약]하세요.</p><p>당신의 <strong>사랑이 빛날 그 순간</strong> 준비해드려요!</p><p><a href="#" style="background-color: #F39C12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 예약</a></p>',
        previewText: "특별한 순간을 준비하세요",
        pasonaStage: "ACTION",
      },
    ],
  },
  L10: {
    name: "L10: 즉시 구매 의향 자동메시지",
    description: "구매 의도 높음 (클로징)",
    lensType: "L10",
    sms: [
      {
        order: 1,
        daysAfter: 0,
        content: "{고객명}님만을 위해. 10% 추가 할인! 지금 예약 시에만! [지금 신청]",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        content: "선실 3개 남음. 결정을 미루면 다음 배는 2026년 8월이에요! [선실 확인]",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        content: "결제 화면을 열었어요. 마지막 한 발짝이에요! [계속 진행]",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        content: "[예약 완료]를 클릭하세요! 당신의 꿈의 크루즈가 시작돼요! 🎉",
        pasonaStage: "ACTION",
      },
    ],
    email: [
      {
        order: 1,
        daysAfter: 0,
        subject: "10% 추가 할인 - {고객명}님만을 위해",
        bodyHtml: '<p>{고객명}님만을 위해.</p><p><strong>10% 추가 할인!</strong></p><p>지금 예약 시에만!</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">지금 신청</a></p>',
        previewText: "10% 추가 할인 기회입니다",
        pasonaStage: "PROBLEM",
      },
      {
        order: 2,
        daysAfter: 1,
        subject: "선실 3개 남음 - 다음은 8월이에요",
        bodyHtml: '<p>{고객명}님,</p><p><strong>선실 3개 남음</strong></p><p>결정을 미루면 다음 배는 <strong>2026년 8월</strong>이에요!</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">선실 확인</a></p>',
        previewText: "선실이 거의 다 찼습니다",
        pasonaStage: "SOLUTION",
      },
      {
        order: 3,
        daysAfter: 2,
        subject: "결제 준비 완료 - 마지막 한 발짝",
        bodyHtml: '<p>{고객명}님,</p><p>결제 화면을 열었어요.</p><p><strong>마지막 한 발짝</strong>이에요!</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">계속 진행</a></p>',
        previewText: "결제 준비 완료입니다",
        pasonaStage: "OFFER",
      },
      {
        order: 4,
        daysAfter: 3,
        subject: "당신의 꿈의 크루즈가 시작됩니다 - 예약 완료하세요",
        bodyHtml: '<p>{고객명}님,</p><p>[예약 완료]를 클릭하세요!</p><p><strong>당신의 꿈의 크루즈</strong>가 시작돼요!</p><p><a href="#" style="background-color: #27AE60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">예약 완료</a></p>',
        previewText: "꿈의 크루즈가 시작됩니다",
        pasonaStage: "ACTION",
      },
    ],
  },
};

async function seedFunnelLensTemplates() {
  try {
    console.log('🌱 Funnel SMS/Email 렌즈 템플릿 Seeding 시작...\n');

    // Find or create global org
    let globalOrg = await prisma.organization.findFirst({
      where: {
        slug: 'mabiz-admin',
      },
    });

    if (!globalOrg) {
      console.log('⚠️  Global Admin org not found. Using first org...');
      const firstOrg = await prisma.organization.findFirst();
      if (!firstOrg) {
        throw new Error('No organizations found in database');
      }
      globalOrg = firstOrg;
    }

    console.log(`✅ Target Org: ${globalOrg.id} (${globalOrg.name})\n`);

    let totalSmsCount = 0;
    let totalEmailCount = 0;
    let totalFunnelCount = 0;

    // Process L0-L10 templates
    for (const lensKey in FUNNEL_LENS_TEMPLATES) {
      const template = FUNNEL_LENS_TEMPLATES[lensKey];

      // Check duplicate
      const existingSms = await prisma.funnelSms.findFirst({
        where: {
          organizationId: globalOrg.id,
          title: template.name,
        },
      });

      if (existingSms) {
        console.log(`⏭️  ${template.name} 이미 존재, 스킵`);
        continue;
      }

      // 1. Create FunnelSms
      const funnelSms = await prisma.funnelSms.create({
        data: {
          organizationId: globalOrg.id,
          title: template.name,
          description: template.description,
          lensType: template.lensType,
          visibility: 'PUBLIC',
          isTemplate: true,
          sendHour: 10,
          sendMinute: 0,
          isActive: true,
          createdByRole: 'ADMIN',
          riskScore: 0,
        },
      });

      totalFunnelCount++;
      console.log(`✅ FunnelSms: ${template.name}`);

      // 2. Create FunnelSmsMessages (Day 0-3)
      for (const msg of template.sms) {
        await prisma.funnelSmsMessage.create({
          data: {
            funnelSmsId: funnelSms.id,
            order: msg.order,
            daysAfter: msg.daysAfter,
            content: msg.content,
            msgType: 'SMS',
          },
        });
        totalSmsCount++;
      }

      console.log(`   └─ SMS 메시지 4개 (Day 0-3)\n`);

      // 3. Create FunnelEmail
      const funnelEmail = await prisma.funnelEmail.create({
        data: {
          organizationId: globalOrg.id,
          title: template.name,
          description: template.description,
          lensType: template.lensType,
          visibility: 'PUBLIC',
          isTemplate: true,
          sendHour: 10,
          sendMinute: 0,
          isActive: true,
          createdByRole: 'ADMIN',
          riskScore: 0,
        },
      });

      totalFunnelCount++;
      console.log(`✅ FunnelEmail: ${template.name}`);

      // 4. Create FunnelEmailMessages (Day 0-3)
      for (const msg of template.email) {
        await prisma.funnelEmailMessage.create({
          data: {
            funnelEmailId: funnelEmail.id,
            order: msg.order,
            daysAfter: msg.daysAfter,
            subject: msg.subject,
            bodyHtml: msg.bodyHtml,
            previewText: msg.previewText,
          },
        });
        totalEmailCount++;
      }

      console.log(`   └─ Email 메시지 4개 (Day 0-3)\n`);
    }

    console.log('\n✨ Funnel SMS/Email 렌즈 템플릿 Seeding 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 생성 통계:');
    console.log(`  • Funnel (SMS/Email): ${totalFunnelCount}개`);
    console.log(`  • SMS 메시지: ${totalSmsCount}개`);
    console.log(`  • Email 메시지: ${totalEmailCount}개`);
    console.log(`  • 합계 메시지: ${totalSmsCount + totalEmailCount}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return {
      funnelCount: totalFunnelCount,
      smsMessageCount: totalSmsCount,
      emailMessageCount: totalEmailCount,
    };
  } catch (error) {
    console.error('❌ Seeding 오류:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedFunnelLensTemplates();
